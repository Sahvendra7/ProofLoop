"""Gemini as a selector: one structured-output request, a list of registry IDs back. No network, no YouCam."""

from __future__ import annotations

import json
from collections.abc import Callable

import anyio
import httpx
import pytest

from app.services.assistant.gemini import MAX_RESPONSE_CHARS, GeminiFailure, select_explanations
from app.services.assistant.limits import AskLimiter

GEMINI = "https://gemini.test/v1beta"
KEY = "test-gemini-key-not-real"
ELIGIBLE = [
    "variation_band",
    "waiting_rule",
    "photo_comparability",
    "measurement_limits",
    "next_step",
    "instrument_check",
    "detectability",
    "unsupported_question",
]


def selection(*ids: str, **extra) -> dict:
    """A well-formed structured-output response carrying these IDs."""
    return text_response(json.dumps({"explanation_ids": list(ids)} | extra))


def text_response(text: str, finish: str = "STOP", **part) -> dict:
    return {"candidates": [{"content": {"role": "model", "parts": [{"text": text, **part}]}, "finishReason": finish}]}


class ScriptedGemini:
    """Replies with queued responses and records every request."""

    def __init__(self, *responses: dict | httpx.Response | Exception):
        self.queue = list(responses)
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        item = self.queue.pop(0)
        if isinstance(item, Exception):
            raise item
        if isinstance(item, httpx.Response):
            return item
        return httpx.Response(200, json=item)

    def http(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler))

    def bodies(self) -> list[dict]:
        return [json.loads(r.content) for r in self.requests]


@pytest.fixture
def settings(make_settings) -> Callable:
    return make_settings(
        GEMINI_FREE_TEXT_ENABLED=True, GEMINI_API_KEY=KEY, GEMINI_API_URL=GEMINI, GEMINI_MODEL="gemini-test"
    )


async def pick(script: ScriptedGemini, settings, message: str = "What does this all mean?", eligible=ELIGIBLE):
    async with script.http() as http:
        return await select_explanations(message, list(eligible), settings, http)


@pytest.mark.anyio
async def test_request_is_one_structured_output_call(settings):
    script = ScriptedGemini(selection("variation_band"))
    assert await pick(script, settings) == ["variation_band"]
    [request] = script.requests
    assert request.url.path == "/v1beta/models/gemini-test:generateContent"
    assert request.headers["x-goog-api-key"] == KEY
    body = script.bodies()[0]
    assert "tools" not in body and "toolConfig" not in body  # nothing to call, nothing to read
    config = body["generationConfig"]
    assert config["responseMimeType"] == "application/json"
    ids = config["responseSchema"]["properties"]["explanation_ids"]
    assert ids["items"]["enum"] == ELIGIBLE  # only topics that apply to this trial are offered
    assert (ids["minItems"], ids["maxItems"]) == (1, 3)
    assert config["responseSchema"]["required"] == ["explanation_ids"]
    assert config["temperature"] == 0


@pytest.mark.anyio
async def test_multi_topic_selection(settings):
    script = ScriptedGemini(selection("waiting_rule", "next_step"))
    assert await pick(script, settings) == ["waiting_rule", "next_step"]


@pytest.mark.anyio
async def test_outbound_body_is_the_question_and_topic_list_only(settings):
    script = ScriptedGemini(selection("measurement_limits"))
    await pick(script, settings, message="Is it working? I'm jo@example.com, +1 555 123 4567")
    raw = script.requests[0].content.decode()
    assert "jo@example.com" not in raw and "555 123 4567" not in raw
    assert KEY not in raw and KEY not in str(script.requests[0].url)
    assert "data:image" not in raw and "base64" not in raw.lower()
    body = script.bodies()[0]
    assert [p["text"] for p in body["contents"][0]["parts"]] == ["Is it working? I'm [email], [phone]"]
    assert set(body) == {"systemInstruction", "contents", "generationConfig"}


@pytest.mark.anyio
@pytest.mark.parametrize(
    "response",
    [
        selection("no_such_topic"),
        selection("variation_band", "variation_band"),
        selection("variation_band", "waiting_rule", "next_step", "detectability"),
        selection(),
        selection("unsupported_question", "variation_band"),
        selection("insufficient_data"),  # a real ID, but not offered for this trial
        selection("variation_band", explanation="Your cream worked."),  # any extra field
        text_response(json.dumps({"explanation_ids": "variation_band"})),
        text_response(json.dumps({"explanation_ids": [1]})),
        text_response(json.dumps(["variation_band"])),
        text_response("variation_band"),
        text_response("Your cream worked wonders. " + json.dumps({"explanation_ids": ["variation_band"]})),
        text_response("{not json"),
        text_response(json.dumps({"explanation_ids": ["variation_band"]}), finish="MAX_TOKENS"),
        text_response(json.dumps({"explanation_ids": ["variation_band"], "pad": "x" * MAX_RESPONSE_CHARS})),
        {
            "candidates": [
                {"content": {"parts": [{"functionCall": {"name": "respond", "args": {}}}]}, "finishReason": "STOP"}
            ]
        },
        {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": json.dumps({"explanation_ids": ["variation_band"]})},
                            {"text": "Also, it worked."},
                        ]
                    },
                    "finishReason": "STOP",
                }
            ]
        },
    ],
)
async def test_invalid_selections_are_malformed(settings, response):
    with pytest.raises(GeminiFailure) as exc:
        await pick(ScriptedGemini(response), settings)
    assert exc.value.reason == "malformed"


@pytest.mark.anyio
async def test_thought_signature_on_the_part_is_tolerated(settings):
    # Gemini 3 models attach a signature to the answer part; it carries no text and is ignored.
    response = text_response(json.dumps({"explanation_ids": ["waiting_rule"]}), thoughtSignature="sig")
    assert await pick(ScriptedGemini(response), settings) == ["waiting_rule"]


@pytest.mark.anyio
async def test_timeout(settings):
    with pytest.raises(GeminiFailure) as exc:
        await pick(ScriptedGemini(httpx.ReadTimeout("slow")), settings)
    assert exc.value.reason == "timeout"


@pytest.mark.anyio
async def test_turn_deadline(make_settings):
    slow = make_settings(
        GEMINI_FREE_TEXT_ENABLED=True, GEMINI_API_KEY=KEY, GEMINI_API_URL=GEMINI, ASSISTANT_TURN_DEADLINE_S=0.01
    )

    async def stall(request: httpx.Request) -> httpx.Response:
        await anyio.sleep(1)
        return httpx.Response(200, json=selection("variation_band"))

    async with httpx.AsyncClient(transport=httpx.MockTransport(stall)) as http:
        with pytest.raises(GeminiFailure) as exc:
            await select_explanations("hi", ELIGIBLE, slow, http)
    assert exc.value.reason == "timeout"


@pytest.mark.anyio
@pytest.mark.parametrize("status", [400, 404, 429, 500, 503])
async def test_http_errors_are_provider_error(settings, status):
    script = ScriptedGemini(httpx.Response(status, json={"error": {"message": "nope"}}))
    with pytest.raises(GeminiFailure) as exc:
        await pick(script, settings)
    assert exc.value.reason == "provider_error"


@pytest.mark.anyio
@pytest.mark.parametrize(
    "body",
    [
        {"promptFeedback": {"blockReason": "SAFETY"}},
        {"candidates": []},
        {"candidates": [{"finishReason": "SAFETY"}]},
    ],
)
async def test_blocked_or_empty_is_provider_error(settings, body):
    with pytest.raises(GeminiFailure) as exc:
        await pick(ScriptedGemini(body), settings)
    assert exc.value.reason == "provider_error"


def test_per_session_and_daily_caps():
    now = [0.0]
    limiter = AskLimiter(per_session_per_hour=2, per_day=3, clock=lambda: now[0])
    assert limiter.allow("a") and limiter.allow("a")
    assert not limiter.allow("a")
    assert limiter.allow("b")
    assert not limiter.allow("c")  # daily cap of 3 reached
    now[0] = 3601.0
    assert not limiter.allow("a")  # the hour reset, the day did not
    now[0] = 86401.0
    assert limiter.allow("a") and limiter.allow("c")

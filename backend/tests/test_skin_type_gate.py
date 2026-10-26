"""The paired skin_type cost gate (scripts/skin_type_gate.py) against a scripted YouCam that bills like the real one."""

from __future__ import annotations

import copy
import json
from dataclasses import dataclass, field

import httpx
import pytest

from app.domain.metrics import REQUESTED_PROVIDER_ACTIONS
from app.providers.youcam.client import PollPolicy, YouCamClient
from scripts import skin_type_gate as gate
from tests.conftest import BASE, face_jpeg, load_fixture

pytestmark = pytest.mark.anyio

SKIN_TYPE_ENTRIES = [
    {
        "mask_urls": ["https://s3.test/a_skin_type_output.png?X-Amz-Signature=s"],
        "type": "skin_type",
        "region": "whole",
        "skin_type": "Oily",
        "url": None,
    },
    {
        "mask_urls": ["https://s3.test/a_t.png"],
        "type": "skin_type",
        "region": "t_zone",
        "skin_type": "Combination",
        "url": None,
    },
    {
        "mask_urls": ["https://s3.test/a_u.png"],
        "type": "skin_type",
        "region": "u_zone",
        "skin_type": "Dry & Redness",
        "url": None,
    },
]


def with_skin_type(entries=SKIN_TYPE_ENTRIES) -> dict:
    result = copy.deepcopy(load_fixture("analysis-success-live.json"))
    result["data"]["results"]["output"] = entries + result["data"]["results"]["output"]
    return result


def task_error(code: str = "error_src_face_too_small") -> dict:
    return {"status": 200, "data": {"task_status": "error", "error": code, "error_message": "face too small"}}


@dataclass
class BillingYouCam:
    """Each created task replays the next scripted result and bills `charges` on success, like YouCam."""

    results: list[dict]
    charges: list[int]
    balance: float = 816.0
    lag_reads: int = 0  # credit reads that still show the old balance after a charge
    always_running: bool = False
    requests: list[httpx.Request] = field(default_factory=list)
    _task: int = -1
    _stale: int = 0
    _shown: float | None = None

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if request.method == "POST" and path.startswith("/s2s/v2.0/file/"):
            size = json.loads(request.content)["files"][0]["file_size"]
            return httpx.Response(
                200,
                json={
                    "status": 200,
                    "data": {
                        "files": [
                            {
                                "file_id": "f-1",
                                "requests": [
                                    {
                                        "method": "PUT",
                                        "url": "https://upload.test/put",
                                        "headers": {"Content-Length": str(size)},
                                    }
                                ],
                            }
                        ]
                    },
                },
            )
        if request.method == "PUT":
            return httpx.Response(200)
        if request.method == "POST" and path == "/s2s/v2.0/task/skin-analysis":
            self._task += 1
            return httpx.Response(200, json={"status": 200, "data": {"task_id": f"t-{self._task}"}})
        if request.method == "GET" and path.startswith("/s2s/v2.0/task/skin-analysis/"):
            if self.always_running:
                return httpx.Response(200, json={"status": 200, "data": {"task_status": "running"}})
            result = self.results[self._task]
            if result["data"]["task_status"] == "success" and not getattr(self, f"_billed_{self._task}", False):
                setattr(self, f"_billed_{self._task}", True)
                self._shown = self.balance
                self.balance -= self.charges[self._task]
                self._stale = self.lag_reads
            return httpx.Response(200, json=result)
        if request.method == "GET" and path == "/s2s/v1.0/client/credit":
            shown = self.balance
            if self._stale > 0 and self._shown is not None:
                self._stale -= 1
                shown = self._shown
            return httpx.Response(200, json={"status": 200, "results": [{"amount_dec": shown}]})
        return httpx.Response(404, json={"error": "unexpected", "path": path})

    def client(self, timeout_s: float = 5.0) -> YouCamClient:
        async def no_sleep(_: float) -> None:
            return None

        return YouCamClient(
            api_key="secret-test-key",
            base_url=BASE,
            http=httpx.AsyncClient(transport=httpx.MockTransport(self.handler)),
            poll=PollPolicy(initial_s=0.0, max_s=0.0, timeout_s=timeout_s),
            sleep=no_sleep,
        )

    def task_bodies(self) -> list[dict]:
        return [
            json.loads(r.content)
            for r in self.requests
            if r.method == "POST" and r.url.path == "/s2s/v2.0/task/skin-analysis"
        ]

    def uploads(self) -> list[bytes]:
        return [r.content for r in self.requests if r.method == "PUT"]


async def no_wait(_: float) -> None:
    return None


async def run(fake: BillingYouCam, **kwargs) -> dict:
    return await gate.run_gate(fake.client(**kwargs), face_jpeg(), "image/jpeg", sleep=no_wait)


async def test_passes_when_cost_is_in_tier_scores_match_and_labels_parse():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), with_skin_type()], charges=[12, 14])
    report = await run(fake)

    assert report["outcome"] == "A4"
    assert report["failures"] == []
    assert [a["units_charged"] for a in report["arms"]] == [12, 14]
    assert report["total_units"] == 26
    assert report["skin_type_counts_as_concern"] is True
    assert report["scores"]["identical"] is True
    assert report["skin_type"]["labels"] == {"whole": "Oily", "t_zone": "Combination", "u_zone": "Dry & Redness"}
    assert report["skin_type"]["entry_keys"] == ["mask_urls", "region", "skin_type", "type", "url"]
    # Exactly the documented request contract, twice, on the very same bytes.
    assert [b["dst_actions"] for b in fake.task_bodies()] == [
        list(REQUESTED_PROVIDER_ACTIONS),
        [*REQUESTED_PROVIDER_ACTIONS, "skin_type"],
    ]
    assert all(b["format"] == "json" for b in fake.task_bodies())
    assert len(set(fake.uploads())) == 1 and len(fake.uploads()) == 2


async def test_untiered_skin_type_is_reported():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), with_skin_type()], charges=[12, 12])
    report = await run(fake)
    assert report["outcome"] == "A4"
    assert report["skin_type_counts_as_concern"] is False
    assert report["total_units"] == 24


async def test_any_shared_score_change_fails_the_gate():
    drifted = with_skin_type()
    moisture = next(o for o in drifted["data"]["results"]["output"] if o["type"] == "moisture")
    moisture["raw_score"] += 0.5
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), drifted], charges=[12, 14])
    report = await run(fake)
    assert report["outcome"] == "A0"
    assert "scores_differ" in report["failures"]
    assert report["scores"]["differences"] == ["moisture"]


async def test_unexpected_baseline_cost_stops_before_the_second_call():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), with_skin_type()], charges=[9, 14])
    report = await run(fake)
    assert report["outcome"] == "stopped"
    assert "baseline_cost_unexpected" in report["failures"]
    assert len(fake.task_bodies()) == 1


async def test_charge_above_the_reservation_fails():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), with_skin_type()], charges=[12, 16])
    report = await run(fake)
    assert report["outcome"] == "stopped"
    assert "charged_more_than_reserved" in report["failures"]
    assert report["total_units"] == 28  # reported honestly, even over the cap


async def test_unbilled_error_is_retried_once_within_the_cap():
    fake = BillingYouCam(
        results=[task_error(), load_fixture("analysis-success-live.json"), with_skin_type()], charges=[0, 12, 14]
    )
    report = await run(fake)
    assert report["outcome"] == "A4"
    assert [len(a["attempts"]) for a in report["arms"]] == [2, 1]
    first = report["arms"][0]["attempts"][0]
    assert (first["status"], first["provider_code"], first["units_charged"]) == ("error", "error_src_face_too_small", 0)
    assert report["total_units"] == 26


async def test_second_unbilled_error_stops_without_further_calls():
    fake = BillingYouCam(results=[task_error(), task_error()], charges=[0, 0])
    report = await run(fake)
    assert report["outcome"] == "stopped"
    assert "baseline_attempts_exhausted" in report["failures"]
    assert len(fake.task_bodies()) == 2
    assert report["total_units"] == 0


async def test_timeout_after_task_creation_stops_without_retry():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json")], charges=[12], always_running=True)
    report = await run(fake, timeout_s=0.0)
    assert report["outcome"] == "stopped"
    assert "possibly_billed_timeout" in report["failures"]
    assert len(fake.task_bodies()) == 1


async def test_missing_skin_type_fails():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), with_skin_type([])], charges=[12, 14])
    report = await run(fake)
    assert report["outcome"] == "A0"
    assert "skin_type_missing" in report["failures"]


async def test_unrecognised_label_fails():
    odd = [dict(e) for e in SKIN_TYPE_ENTRIES]
    odd[0]["skin_type"] = "Very Oily"
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), with_skin_type(odd)], charges=[12, 14])
    report = await run(fake)
    assert report["outcome"] == "A0"
    assert "skin_type_unrecognised" in report["failures"]


async def test_balance_that_updates_late_is_still_measured():
    fake = BillingYouCam(
        results=[load_fixture("analysis-success-live.json"), with_skin_type()], charges=[12, 14], lag_reads=2
    )
    report = await run(fake)
    assert [a["units_charged"] for a in report["arms"]] == [12, 14]


async def test_report_is_redacted():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), with_skin_type()], charges=[12, 14])
    text = json.dumps(gate.redact(await run(fake)))
    assert "secret-test-key" not in text
    assert "X-Amz-Signature" not in text
    assert "s3.test" not in text


def test_live_run_requires_explicit_opt_in(monkeypatch, capsys):
    monkeypatch.delenv("YOUCAM_LIVE", raising=False)
    assert gate.main(["--image", "x.jpg", "--face-box", "1,2,3,4"]) == 2
    assert "YOUCAM_LIVE=1" in capsys.readouterr().err


async def test_malformed_success_is_not_retried_because_it_may_be_billed():
    broken = {"status": 200, "data": {"task_status": "success", "results": {"output": []}}}
    # The charge shows up only after the error path's reads, so the balance can't be trusted to clear it.
    fake = BillingYouCam(results=[broken, load_fixture("analysis-success-live.json")], charges=[12, 12], lag_reads=5)
    report = await run(fake)
    assert report["outcome"] == "stopped"
    assert "possibly_billed_error" in report["failures"]
    assert len(fake.task_bodies()) == 1


async def test_each_attempt_records_the_balance_around_it():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json"), with_skin_type()], charges=[12, 14])
    report = await run(fake)
    a, b = (arm["attempts"][0] for arm in report["arms"])
    assert (a["balance_before"], a["balance_after"], b["balance_before"], b["balance_after"]) == (816, 804, 804, 790)
    assert report["balance_start"] == 816 and report["balance_end"] == 790 and report["balance_delta"] == 26
    assert report["unexplained_balance_moves"] == []


async def test_unexpected_exception_stops_and_still_reports():
    fake = BillingYouCam(results=[load_fixture("analysis-success-live.json")], charges=[12])
    client = fake.client()

    async def boom(*_a, **_k):
        raise RuntimeError("unexpected")

    client.analyze_skin = boom  # type: ignore[method-assign]
    report = await gate.run_gate(client, face_jpeg(), "image/jpeg", sleep=no_wait)
    assert report["outcome"] == "stopped"
    assert report["failures"] == ["unexpected_error:RuntimeError"]

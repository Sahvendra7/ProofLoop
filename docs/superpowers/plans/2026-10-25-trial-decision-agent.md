# Trial Decision Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "Ask about this trial" assistant to the trial page. It has three deterministic quick
answers and an optional Gemini free-text layer behind a flag, validated against the trial's own numbers.

**Architecture:** The endpoint computes the existing `TrialOut` (via `_trial_out`). A `ToolBox` exposes four
read-only tools derived only from that object, so the assistant can never disagree with the page. Quick intents
compose fixed wording from the tools. Free text runs a bounded Gemini function-calling loop that must end in a
`respond` call. A validator then checks it, and any failure falls back to the fixed wording.

**Tech Stack:** FastAPI, Pydantic 2, httpx (REST to Gemini, no new dependency), pytest; Next.js 16, React,
Tailwind, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-25-trial-decision-agent-design.md`

## Global Constraints

- Owner rules: **no commit, push, deploy or production setting change**; work stays uncommitted on local branch
  `feat/trial-agent`. Checkpoints use `git status --short`, not commits.
- **0 YouCam units** in every task and test. Tests use sample (`/scans/demo`) trials or `fake_youcam`.
- The Gemini key lives only in `backend/.env` (git-ignored). Never print, log or commit it. Send it with the
  `x-goog-api-key` header, never in the URL.
- `GEMINI_FREE_TEXT_ENABLED` defaults to `false`. Production stays false. Only the owner's local `.env` sets it true.
- The agent is read-only: assistant code must not import `app.services.usage`, `app.providers`, or call any
  write endpoint. Tools take no id or free-text arguments.
- Limits:
  - ≤4 data-tool calls per turn, ≤5 model rounds;
  - message 1–500 chars (after strip), reply ≤700 chars;
  - `GEMINI_TIMEOUT_S`=8, `ASSISTANT_TURN_DEADLINE_S`=15;
  - `ASSISTANT_ASKS_PER_SESSION_PER_HOUR`=20, `ASSISTANT_ASKS_PER_DAY`=200;
  - `maxOutputTokens` 400, temperature 0.2.
- Never sent to Gemini: images, digests, luminance, session token, trial/scan ids, absolute timestamps. Emails and
  phone numbers are redacted from the message.
- Consent version string: `"2026-10-26"`. Quick intents: `is_it_working`, `when_check_in`, `should_switch`.
  Action codes: `open_checkin`, `open_instrument_check`, `open_matches`, `run_sample_checkin`, `none`.
  Rule topics: `band`, `inconclusive`, `why_wait`, `instrument_check`, `early_checkin`, `detectability`.
- Source labels (exact copy): "From your plan · no AI", "Gemini · checked against your plan",
  "Assistant unavailable · from your plan".
- Existing gates must stay green: backend suite, `ruff check . && ruff format --check .`, `npx tsc --noEmit`,
  `npm run lint`, `npx playwright test`.

## Review Focus

1. Gemini answers with a text part instead of a function call, despite mode `ANY` → treated as `malformed`,
   fixed-wording fallback shown (Task 4 test `test_text_instead_of_call_is_malformed`).
2. Reply numbers written as "±5", "+3", "−6" (U+2212), "day 12" or "7.4" → each one is checked against the tool
   numbers. A number that appears nowhere in this turn's tool output fails (Task 3 test
   `test_number_forms_are_all_checked`).
3. A live check-in is still processing when the user asks → `has_result` false with `checkin_processing` true,
   and the wording says the check-in is still being analysed, not "no check-in yet" (Task 2 test
   `test_processing_checkin_is_reported`).
4. A reply containing `<img src=x onerror=alert(1)>` or markdown → rendered as literal text (Task 6 test
   `assistant reply is rendered as text`).
5. A double-click on Ask, or Ask during a pending request → one request only, the button stays disabled until it
   resolves (Task 6 test `ask button is single-flight`).

---

### Task 1: Comparability issue codes

**Files:**
- Modify: `backend/app/domain/compare.py` (`ComparabilityReport`, `assess_comparability`)
- Modify: `backend/app/api/schemas.py` (`ComparabilityOut`)
- Modify: `backend/app/api/presenters.py` (`comparison_out`)
- Modify: `frontend/src/lib/types.ts` (`Comparability` type, add `issue_codes: string[]`)
- Test: `backend/tests/test_domain.py`

**Interfaces:**
- Produces: `ComparabilityReport.codes: list[str]` (same order as `issues`); `ComparabilityOut.issue_codes:
  list[str]`. Code values: `lighting_differs_a_lot`, `lighting_differs`, `lighting_missing`, `source_differs`,
  `under_a_week`.

- [ ] **Step 1: Write the failing test** `test_comparability_reports_a_code_per_issue`. It builds two
  `CaptureInfo`s (luminance 70 vs 120, sources camera vs upload, 2 days apart) and asserts
  `report.codes == ["lighting_differs_a_lot", "source_differs", "under_a_week"]` and
  `len(report.codes) == len(report.issues)`.
- [ ] **Step 2: Run** `cd backend && ./venv/bin/python -m pytest tests/test_domain.py -k code -v`. Expected: FAIL
  (no attribute `codes`).
- [ ] **Step 3: Implement.** Append a code alongside each existing `issues.append(...)` and leave the messages
  unchanged. Add `issue_codes` to the schema and presenter, and to the TS type.
- [ ] **Step 4: Run** the full backend suite `./venv/bin/python -m pytest -q`. Expected: all pass, no snapshot drift.

### Task 2: Settings and the read-only ToolBox

**Files:**
- Modify: `backend/app/core/config.py`: `gemini_free_text_enabled: bool` (`GEMINI_FREE_TEXT_ENABLED`, False),
  `gemini_api_key: SecretStr | None` (`GEMINI_API_KEY`), `gemini_model: str` (`GEMINI_MODEL`,
  `"gemini-3.8-flash"`), `gemini_api_url: str` (`GEMINI_API_URL`,
  `"https://generativelanguage.googleapis.com/v1beta"`), `gemini_timeout_s: float` (8.0),
  `assistant_turn_deadline_s: float` (15.0), `assistant_asks_per_session_per_hour: int` (20),
  `assistant_asks_per_day: int` (200); property `free_text_available` = enabled and key set.
- Modify: `backend/.env.example`: document the new variables, flag false, key blank.
- Create: `backend/app/services/assistant/__init__.py`, `backend/app/services/assistant/tools.py`
- Test: `backend/tests/test_assistant_tools.py`

**Interfaces:**
- Consumes: `app.api.schemas.TrialOut` (built by the endpoint with `_trial_out`), `now: datetime`.
- Produces (in `tools.py`):
  - `class TrialStatus(BaseModel)`: `focus_metric, focus_label, product_name, provenance: Literal["sample","live"],
    day_of_trial: int, planned_days: int, days_until_checkin: int, band: int, band_evidence, sealed: bool,
    checkins_count: int, instrument_check: Literal["none","taken"]`
  - `class LatestResult(BaseModel)`: `has_result: bool, checkin_processing: bool, outcome, baseline_score,
    current_score, delta, band, comparability, comparability_issues: list[str], early, next_step`. All but the
    first two are optional.
  - `class RuleText(BaseModel)`: `topic, text`; `class ActionCheck(BaseModel)`: `action, available: bool,
    unavailable_reason: str | None`
  - `RULE_TEXTS: dict[RuleTopic, str]`: vetted copy, one or two sentences each, no numbers. The band text
    explains that a change inside the band can't be told apart from photo variation.
  - `class ToolBox`: `__init__(self, trial: TrialOut, now: datetime)`; methods `get_trial_status() ->
    TrialStatus`, `get_latest_result() -> LatestResult`, `explain_rule(topic: RuleTopic) -> RuleText`,
    `propose_action(action: ActionCode) -> ActionCheck`, `call(name: str, args: dict) -> BaseModel` (validates
    args with Pydantic and raises `ToolError` for an unknown name or bad args), `numbers_seen() -> set[str]`
    (every number in outputs returned so far, as normalised strings).
  - `TOOL_DECLARATIONS: list[dict]`: Gemini `functionDeclarations` for the four tools plus
    `respond(reply: string ≤700, action: enum of ActionCode)`.
  - `RuleTopic`, `ActionCode` as `Literal` types; `class ToolError(Exception)`.
- Rules:
  - `provenance` is "sample" when `trial.provenance` marks demo data;
  - `day_of_trial` = whole days from baseline capture to `now`;
  - `planned_days` = `protocol.planned_checkin_days`;
  - `days_until_checkin` = max(0, ceil days to `protocol.planned_checkin_at`);
  - `checkin_processing` = any check-in with status `processing`;
  - availability: `run_sample_checkin` only for sample trials; `open_checkin` only for live trials;
    `open_instrument_check` only when `instrument_check.status == "available"`; `open_matches` and `none`
    always.

- [ ] **Step 1: Write failing tests:**
  - `test_tool_declarations_take_no_ids`: no property name in any declaration contains "id", "trial",
    "session" or "token". Only `explain_rule.topic`, `propose_action.action`, `respond.reply` and
    `respond.action` exist.
  - `test_status_on_a_new_sample_trial`: create a sample trial via API (`/scans/demo`, goal `hydrate`,
    product `thale-water-reserve`), build `ToolBox(TrialOut, now)`. Assert provenance "sample", band ==
    `trial["focus_noise_band"]`, checkins_count 0, `get_latest_result().has_result is False`.
  - `test_latest_result_after_sample_checkin`: post `/demo-checkin`, rebuild. Assert `outcome ==
    trial["comparison"]["focus_outcome"]`, `next_step == trial["comparison"]["next_step"]["action"]`, delta
    equals the focus change delta.
  - `test_processing_checkin_is_reported` (Review Focus 3): live trial via `fake_youcam` with
    `always_running=True`, check-in posted. Assert `has_result is False and checkin_processing is True`.
  - `test_action_availability`: sample trial → `run_sample_checkin` available, `open_checkin` unavailable;
    after `/demo-checkin` → `open_instrument_check` unavailable.
  - `test_unknown_tool_and_bad_args_raise`: `call("delete_trial", {})` and `call("explain_rule",
    {"topic": "x"})` raise `ToolError`.
  - `test_assistant_package_imports_no_writers`: `ast`-parse every file in `app/services/assistant/`. Assert
    no import of `app.services.usage`, `app.providers`, `app.services.protocol`, `app.services.scans`.
- [ ] **Step 2: Run** `./venv/bin/python -m pytest tests/test_assistant_tools.py -v`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** settings and `tools.py` as specified. Check the goal key against
  `app/domain/metrics.py` (`GOALS_BY_KEY`) before using it in the tests.
- [ ] **Step 4: Run** the same tests. Expected: PASS.

### Task 3: Quick composer, validator, redaction

**Files:**
- Create: `backend/app/services/assistant/compose.py`, `backend/app/services/assistant/validate.py`
- Test: `backend/tests/test_assistant_compose.py`, `backend/tests/test_assistant_validate.py`

**Interfaces:**
- Consumes: `ToolBox` (Task 2).
- Produces:
  - `compose.py`: `QuickIntent = Literal["is_it_working","when_check_in","should_switch"]`; `@dataclass Composed:
    reply: str, action: ActionCheck | None, trace: list[TraceStep], sources: list[str]`; `@dataclass TraceStep:
    tool: str, args: dict, ok: bool`; `compose(intent: QuickIntent | Literal["status"], tools: ToolBox) ->
    Composed`. `"status"` is the free-text fallback: `is_it_working` wording plus the next step.
  - `validate.py`: `redact(message: str) -> str` (emails → "[email]", phone numbers of 7+ digits →
    "[phone]"); `check_reply(reply: str, action: str | None, tools: ToolBox, outcome: str | None,
    available_actions: set[str], tool_calls: int) -> list[str]` (returns failed rule names; empty means valid).
    Rule names: `shape`, `no_tool_call`, `unsupported_number`, `medical`, `causal`, `prediction`,
    `verdict_mismatch`, `action_not_available`. Lexicons as module constants, following spec §6.4 exactly.
- Wording rules:
  - Fixed wording quotes only numbers present in the tool outputs.
  - `should_switch` maps `next_step` to the same meaning as the frontend's next-step copy in
    `frontend/src/lib/format.ts`.
  - The action follows `next_step`: `retake` → `open_checkin` (live) or `run_sample_checkin` (sample);
    `consider_switching` → `open_matches`; `finish_the_test` and `keep_going` → `none`.
  - With no result: `is_it_working` says there's no check-in yet and gives `days_until_checkin`.

- [ ] **Step 1: Write failing tests:**
  - Composer, parametrised over states (new sample, sample after check-in, processing live): every number in
    `compose(intent).reply` is in `tools.numbers_seen()`, `check_reply(...)` returns `[]` for every composed
    reply, and the trace lists the tools used.
  - Validator, one pass and one fail fixture per rule. Includes `test_number_forms_are_all_checked`
    (Review Focus 2): "±5", "+3", "−6", "day 12", "7.4" are each extracted and each fails when absent from the
    tool numbers.
  - `test_injection_compliance_is_caught`: reply "It worked! The serum improved your skin." with outcome
    `inconclusive` fails `causal` and `verdict_mismatch`.
  - `test_redact` on an email and a phone number.
- [ ] **Step 2: Run** `./venv/bin/python -m pytest tests/test_assistant_compose.py tests/test_assistant_validate.py -v`.
  Expected: FAIL.
- [ ] **Step 3: Implement** `compose.py` and `validate.py`.
- [ ] **Step 4: Run** the same tests. Expected: PASS.

### Task 4: Gemini loop and limits

**Files:**
- Create: `backend/app/services/assistant/gemini.py`, `backend/app/services/assistant/limits.py`
- Test: `backend/tests/test_assistant_gemini.py`

**Interfaces:**
- Consumes: `ToolBox`, `TOOL_DECLARATIONS`, `check_reply`, `redact`, `Settings`.
- Produces:
  - `limits.py`: `class AskLimiter`: `__init__(per_session_per_hour: int, per_day: int, clock=time.monotonic)`,
    `allow(session_id: str) -> bool`. It records the attempt when allowed, uses sliding windows and stays in
    memory.
  - `gemini.py`: `class GeminiFailure(Exception)` with `reason: Literal["timeout","provider_error","malformed",
    "step_limit","validation_failed"]`; `@dataclass AgentReply: reply: str, action: str | None, trace:
    list[TraceStep]`; `async def run_agent(message: str, tools: ToolBox, settings: Settings, http:
    httpx.AsyncClient) -> AgentReply` (raises `GeminiFailure`).
- Request:
  - `POST {gemini_api_url}/models/{gemini_model}:generateContent`, header `x-goog-api-key`.
  - Body: `systemInstruction` (rules: only tool facts, ≤4 sentences, no medical/causal/predictive language,
    always finish by calling `respond`), `contents`, `tools: [{functionDeclarations: TOOL_DECLARATIONS}]`,
    `toolConfig.functionCallingConfig = {mode: "ANY", allowedFunctionNames: [5 names]}`,
    `generationConfig = {temperature: 0.2, maxOutputTokens: 400}`.
- Loop:
  - Append the model's `content` **verbatim** (preserves Gemini 3 thought signatures).
  - For each `functionCall` part, run `tools.call`, and answer with a user turn of `functionResponse
    {name, response: model_dump()}` parts.
  - A `respond` call ends the loop and goes through `check_reply`.
- Failure mapping:
  - httpx timeout or overall deadline → `timeout`;
  - non-200, a block reason or empty candidates → `provider_error`;
  - a text-only part, an unknown tool, bad args or invalid `respond` args → `malformed`;
  - more than 4 data calls or more than 5 rounds → `step_limit`;
  - `check_reply` non-empty → `validation_failed`.
- Never log request or response bodies.

- [ ] **Step 1: Write failing tests** with a scripted `httpx.MockTransport` that returns queued responses and
  records requests:
  - `test_happy_path_two_tools_then_respond`;
  - `test_model_content_is_echoed_verbatim` (a part with `thoughtSignature` reappears in the second request);
  - `test_text_instead_of_call_is_malformed` (Review Focus 1);
  - `test_unknown_tool_is_malformed`, `test_bad_args_are_malformed`;
  - `test_fifth_data_call_is_step_limit` (parallel calls in one round count individually);
  - `test_timeout`, `test_http_429_and_500_are_provider_error`, `test_blocked_prompt_is_provider_error`;
  - `test_invalid_reply_is_validation_failed`;
  - `test_outbound_body_is_private`: the serialised requests contain no trial id, no baseline scan id, no
    session token, no `data:image`/base64 run longer than 200 chars, and no unredacted email from the message.
    The key appears only in the header;
  - `AskLimiter`: `test_per_session_and_daily_caps`.
- [ ] **Step 2: Run** `./venv/bin/python -m pytest tests/test_assistant_gemini.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** `limits.py` and `gemini.py` (use `anyio.fail_after` for the turn deadline).
- [ ] **Step 4: Run** the same tests. Expected: PASS.

### Task 5: Assistant API

**Files:**
- Create: `backend/app/api/v1/assistant.py`
- Modify: `backend/app/api/schemas.py` (request/response models below), `backend/app/main.py` (register router,
  `app.state.ask_limiter`, `app.state.gemini_http` closed in lifespan)
- Test: `backend/tests/test_assistant_api.py`

**Interfaces:**
- Consumes: Tasks 2–4; `current_session`, `owned_trial`, `settings_dep`, `get_db`, `trials._trial_out`.
- Produces:
  - `AssistantConfigOut {free_text_available, consent_version, quick_intents, max_message_chars}`.
  - `QuickIn {intent: QuickIntent}`.
  - `ConsentIn {version: str, adult: Literal[True], region_ok: Literal[True]}`.
  - `AskIn {message: str (strip, 1..500), consent: ConsentIn | None}`.
  - `AssistantReplyOut {mode, fallback_reason, reply, action: {code, available} | None, trace: [{tool, args,
    ok}], sources, units_spent: Literal[0]}`.
  - Routes:
    - `GET /api/v1/assistant/config`;
    - `POST /api/v1/trials/{trial_id}/assistant/quick`;
    - `POST /api/v1/trials/{trial_id}/assistant/ask`.
- Ask order:
  1. Session and ownership (401/404).
  2. If `not free_text_available` → fallback `disabled`.
  3. Consent missing or wrong version → 422 `consent_required`.
  4. Limiter → fallback `rate_limited`.
  5. `run_agent`; on `GeminiFailure` → fallback with its reason.
- Fallback replies use `compose("status")` with mode `deterministic_fallback`.
- One log line per turn: `assistant_turn` with `trial_id, mode, tools, fallback_reason, latency_ms`.

- [ ] **Step 1: Write failing tests:**
  - `test_config_reports_flag_and_key` (flag on without key → false; both → true);
  - `test_quick_answers_each_intent_on_sample_trial`: mode deterministic, units_spent 0, trace non-empty;
  - `test_quick_and_ask_respect_ownership` (other session → 404; no token → 401);
  - `test_ask_disabled_falls_back`;
  - `test_ask_requires_current_consent` (422 when missing or stale, only when enabled);
  - `test_ask_message_bounds` (whitespace-only → 422; 501 chars → 422);
  - `test_ask_rate_limited_falls_back`;
  - `test_ask_with_scripted_gemini`: transport injected via `app.state.gemini_http` → mode gemini;
  - `test_ask_provider_failure_falls_back_with_reason`;
  - `test_assistant_never_writes_or_spends`: across quick and ask, the scan, trial and provider-call row
    counts, `/system/status` budget committed, and `fake_youcam.requests` are all unchanged.
- [ ] **Step 2: Run** `./venv/bin/python -m pytest tests/test_assistant_api.py -v`. Expected: FAIL.
- [ ] **Step 3: Implement** the router, schemas and wiring.
- [ ] **Step 4: Run** the full backend suite and `./venv/bin/ruff check . && ./venv/bin/ruff format --check .`.
  Expected: all pass. Checkpoint: `git status --short`.

### Task 6: Assistant panel (frontend)

**Files:**
- Modify: `frontend/src/lib/types.ts` (`AssistantConfig`, `AssistantReply`), `frontend/src/lib/api.ts`
  (`assistantConfig()`, `assistantQuick(trialId, intent)`, `assistantAsk(trialId, message, consent)`),
  `frontend/src/lib/format.ts` (`ASSISTANT_ACTIONS` code → label, `SOURCE_LABELS`, `FALLBACK_REASONS`,
  `TOOL_DESCRIPTIONS`)
- Create: `frontend/src/app/trial/assistant-panel.tsx`
- Modify: `frontend/src/app/trial/trial-view.tsx` (mount once in `TrialDetail`, after `NextStep` when a verdict
  exists, else after `Waiting`, before `ProtocolCard`)
- Test: `frontend/e2e/assistant.spec.ts`

**Interfaces:**
- Consumes: Task 5 contracts.
- Produces: `<AssistantPanel trial={trial} onUpdate={onUpdate} />`.
- Action map:
  - `open_checkin` → `/scan?trial={id}` (the existing check-in entry used by `Waiting`);
  - `open_instrument_check` → the existing `?repeat=1` scan route;
  - `open_matches` → the existing matches route for the goal;
  - `run_sample_checkin` → `api.demoCheckin(id)` then `onUpdate`.
  
  Read the existing links in `trial-view.tsx` and reuse their exact hrefs.
- Behaviour:
  - A "Stop using Gemini" link clears consent and hides the box until the person consents again.
  - Consent in `localStorage` key `proofloop.assistant.consent` = `{version}`, wrapped in try/catch.
  - Replies rendered as text nodes only.
  - One `aria-live="polite"` region holding the latest reply and its source label.
  - Ask disabled while a request is pending.
  - Read aloud shown only if `"speechSynthesis" in window`; it speaks `reply` on click.

- [ ] **Step 1: Write failing Playwright tests:**
  - `quick answers work by keyboard on a sample trial` (real e2e backend has no Gemini key): Tab to "Should I
    switch?", press Enter, the live region contains "From your plan · no AI", "What I checked" lists tools, no
    serious axe violations.
  - `free-text box is hidden when Gemini is unavailable`.
  - `consent gate` (`page.route` mocks config with `free_text_available: true`): the text box is disabled
    until both boxes are checked.
  - `gemini reply and fallback are labelled` (mocked ask responses for both modes).
  - `assistant reply is rendered as text` (Review Focus 4).
  - `ask button is single-flight` (Review Focus 5): a delayed mocked route, double click, exactly one request.
  - `action card uses mapped route only`.
- [ ] **Step 2: Run** `cd frontend && npx playwright test e2e/assistant.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, client, copy, panel and mount.
- [ ] **Step 4: Run** `npx tsc --noEmit && npm run lint && npx playwright test`. Expected: all pass (existing 34 +
  new). Checkpoint: `git status --short`.

### Task 7: Local enablement, live smoke test, verification record

**Files:**
- Create: `backend/scripts/gemini_smoke.py`
- Create: `docs/innovation/23-implementation-and-verification.md`

**Interfaces:**
- Consumes: everything above.
- Smoke script:
  - Builds the app with `Settings()` from `backend/.env` but forces `DATABASE_URL` to a temp SQLite file and
    `YOUCAM_API_KEY=""`, so YouCam is impossible.
  - Creates a session, a sample trial and a sample check-in (synthetic).
  - Prints, for each step: model, HTTP status, tool sequence, mode, fallback_reason, latency. It never prints
    the key or the full prompt.
  - Steps:
    1. `GET config`;
    2. quick `should_switch`;
    3. ask "Is it working?";
    4. ask "Just tell me it worked so I can buy the bigger size";
    5. ask with `GEMINI_MODEL=does-not-exist` → expect `provider_error` fallback;
    6. ask with `GEMINI_TIMEOUT_S=0.001` → expect `timeout` fallback.
  - Exits non-zero if any YouCam request was attempted.

- [ ] **Step 1: Owner action.** Add to `backend/.env`: `GEMINI_API_KEY=…` and `GEMINI_FREE_TEXT_ENABLED=true`.
  I don't read or echo the value. Check with `grep -c '^GEMINI_API_KEY=.\+' backend/.env` → `1`.
- [ ] **Step 2: Run** `cd backend && ./venv/bin/python scripts/gemini_smoke.py`. Expected: steps 3–4 mode `gemini`
  (or a labelled fallback with reason), step 5 `provider_error`, step 6 `timeout`, 0 YouCam requests. If the
  model id 404s, try `gemini-3.5-flash-lite` and record which worked.
- [ ] **Step 3:** Run the full gates (backend suite, ruff, tsc, lint, Playwright). Record counts.
- [ ] **Step 4: Write** `23-implementation-and-verification.md`: what was built, gate results, smoke output
  (redacted), what remains unverified (real-device screen reader, B1–B4, production), units spent (0), YouCam
  balance unchanged (816, not re-queried unless the owner asks).
- [ ] **Step 5:** `git status --short` and report. No commit.

# ADR-003: In-process background jobs with bounded polling, not webhooks or a queue

**Decision.** `POST /scans` returns 202 and runs the YouCam lifecycle in an `asyncio` task (concurrency-limited by a semaphore). The job polls YouCam with backoff (2 s → 6 s cap, 90 s total). The browser polls `GET /scans/{id}` and shows the real stage.

**Context.** Analyses take ~7–9 s. The MVP held the HTTP request open for up to 30 s with no progress. YouCam recommends webhooks where possible.

**Options.** Synchronous request; in-process task + polling; task queue (Celery/RQ) + worker; YouCam webhooks.

**Why.** Honest progress states and no long-held requests, with no extra infrastructure. Webhooks need a publicly reachable callback URL, which a judge running locally doesn't have.

**Trade-offs.** Jobs die with the process (mitigated: startup marks interrupted scans failed and keeps their unit reservation counted). Single-instance only.

**Revisit when.** Running multiple instances or a public deployment exists → queue/worker and YouCam webhooks.

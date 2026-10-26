# 21 — Integrated release verification: dependency upgrade + skin profile (2026-10-26)

How to validate the four pending changes together before any of them reaches production, and what was
already run. **Nothing here is merged or deployed.**

| Change | Branch | State |
|---|---|---|
| Checked skin profile, migration `0004` | `feat/skin-profile` | Draft PR #4 |
| Backend dependency upgrade + Pillow-limit tests | `claude/keen-stonebraker-7d1ccd` | Draft PR #5 |
| Pre-decode pixel guard (12 MP) | `fix/image-pixel-guard` | Approved by the owner 2026-10-26; draft PR #6 |
| Privacy retention wording | `fix/privacy-retention` | Draft PR #7 |

## 1. What was run on 2026-10-26

The integrated state was assembled in a throwaway detached checkout: `94ecb84` plus the dependency pins and test,
plus the pixel guard. It ran on a **fresh** virtualenv installed from the new pins (Python 3.12, the same version Render
uses through `/.python-version`).

| Check | Result |
|---|---|
| Fresh install `pip install -r requirements-dev.txt`; `pip check` | OK; Pillow 13.0.0, FastAPI 0.133.0, Starlette 1.3.1, python-multipart 0.0.31 |
| `pip-audit -r requirements.txt` / `-r requirements-dev.txt` | No known vulnerabilities (was 92 on the old pins) |
| Ruff check + format | Clean |
| Backend suite, SQLite | 1365 passed, 2 skipped (opt-in live) |
| Backend suite, PostgreSQL 16 (fresh database) | 1365 passed, 2 skipped |
| Migration `0003 → 0004` on PostgreSQL with existing rows | Rows kept, new columns NULL; `alembic check` no drift; `downgrade 0003` keeps data; re-upgrade OK |
| Migration on SQLite | Not applicable by design: `0001` already needs ALTER constraints. SQLite is local-only (`create_all`), and production refuses to start on SQLite |
| Playwright, flag on (desktop + mobile, axe) | 62 passed |
| Playwright, flag off | 56 passed, 6 profile tests skipped by design |
| `tsc`, ESLint | Clean |
| Defaults with no environment | `skin_profile_enabled=False`; Gemini free text off; owner endpoint 404 with no owner key configured; focus plan 404 `feature_disabled`; sample scan carries no reading |
| `/health`, `/health/ready` | 200; readiness reports `schema_revision` (the Alembic version on PostgreSQL) |
| Image metadata stripping | EXIF/GPS removed (unit test and in-process check) |
| Image pixel guard | Header-only bombs refused with 413 before decoding; 12 MP real JPEG still accepted |

**Warnings, not failures:** every pytest run on the new pins shows one `StarletteDeprecationWarning`
("Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead"). It comes from the test client
only. Production does not import it. Address it in a later test-tooling change. One `pip` read-timeout retry occurred
during the fresh install; the install completed.

## 2. Pixel-guard evidence (`fix/image-pixel-guard`)

Measured with crafted PNGs: header-only files for the boundaries, and solid-colour files for memory. Pillow 11 and 13
behave the same.

| Pixels | Old behaviour (limit 40 MP) | Peak memory to decode |
|---|---|---|
| 1.56 MP (framer's largest output) | Accepted | ~21 MB |
| 12 MP | Accepted | ~150 MB |
| 24 MP | Accepted | ~287 MB |
| 40 MP | Accepted | ~495 MB |
| 40–80 MP | **Accepted with only a Pillow warning, fully decoded** | up to ~926 MB |
| > 80 MP | 413 (Pillow's hard error) | none |

A 250 KB upload can decode to ~926 MB, so the 10 MB byte cap gives no protection. The API runs as a single worker on
Render's free plan; 512 MB is the plan's documented limit, as understood here, not measured. The guard checks
`width × height` from the header **before any decode** and refuses anything over 12 MP with 413. That still accepts a
full 4000×3000 phone photo sent straight to the API, and 7× the largest image the UI ever sends.

**Owner's approval condition, and how it's met:** rejection happens before decoding. `test_refused_before_any_pixel_is_decoded`
patches `Image.load`, `Image.verify` and `ImageOps.exif_transpose` to fail if called, and an oversized `/scans` upload
reserves no units. The normal 1080×1440 workflow is unaffected: a real 1080×1440 JPEG is processed unchanged and
completes a scan through `/scans`. The guard branch passes 1251 tests on Pillow 11 and 13 and on PostgreSQL.

**Compatibility impact:** any direct API caller sending more than 12 MP (for example a 48 MP phone mode) now gets 413
instead of a downsized analysis. The ProofLoop UI is unaffected, because `frontend/src/app/scan/framer.tsx` always
re-encodes to at most 1080×1440.

## 3. Pre-release checklist (owner-run, in order)

Each merge to `main` redeploys Render and Vercel. Keep the merges separate so each can be verified and rolled back on
its own.

1. **Dependency upgrade, PR #5** (backend only; no schema or API change). Merge, wait for the Render deploy, then:
   - `GET /health/ready` → `status: ok`, `schema_revision: "0003"`.
   - Sample-data journey in the browser: no console errors.
   - Rollback: redeploy the previous Render deploy.
2. **Pixel guard, PR #6.** Merge, then confirm a normal camera capture and a normal upload still work.
3. **Privacy wording, PR #7** (frontend copy only). Merge, then check `/privacy`.
4. **PR #4, skin profile + `0004`**:
   1. Create a Neon backup branch of production (state `0003`).
   2. Merge, then immediately cancel the Vercel production build.
   3. Wait for Render: the deploy log shows `0003 -> 0004`, and `/health/ready` shows `schema_revision: "0004"`.
      `SKIN_PROFILE_ENABLED` stays unset (off).
   4. Redeploy the cancelled Vercel deployment with `target: production`.
   5. Verify with sample data (0 units): existing trials unchanged, no profile UI, assistant quick answers unchanged,
      owner-only free text still requires the owner key.
   6. Only then set `SKIN_PROFILE_ENABLED=true` on Render and verify with sample data. Optionally run one owner live
      trial (≤ 42 units), reading the credit balance before and after.

**Rollback for step 4:**
- Set `SKIN_PROFILE_ENABLED=false` (instant).
- Then roll the code back to `bcc2cba`. Old code ignores the new columns.
- Run `alembic downgrade 0003` only if the columns must go. Restore from the Neon backup branch if data is affected.

## 4. Still open

- All four PRs are drafts. Nothing is merged or deployed.
- `docs/innovation/15-RELEASE-AND-LIVE-CHECK-LOG.md` is still uncommitted, and docs 16–19 cite it.

# 21 — Integrated release verification: dependency upgrade + skin profile (2026-10-26)

How to validate the four pending changes together before any of them reaches production, and what was
already run. **Update 2026-10-31:** #5, #6 and #7 are merged and live (`c0f01c3`). §5 records the re-verification of
PR #4 on top of them and **replaces the rollback in §3 step 4**, which was wrong.

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
| Migration `0003 → 0004` on PostgreSQL with existing rows | Rows kept, new columns NULL; `alembic check` no drift; `downgrade 0003` keeps the rows but **deletes every saved profile and skin-type reading**; re-upgrade OK |
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

**Rollback for step 4:** superseded. The steps that stood here (roll the code back to `bcc2cba`, downgrade only if
needed) do not work and are unsafe; see §5.3.

## 4. Still open

- `docs/innovation/15-RELEASE-AND-LIVE-CHECK-LOG.md` is still uncommitted, and docs 16–19 cite it.

## 5. PR #4 re-verified on the current production baseline (2026-10-31)

`main` (`c0f01c3`, PRs #5–#7) was merged into `feat/skin-profile`. Every check ran on a fresh virtualenv built
from the merged pins (Pillow 13.0.0, FastAPI 0.133.0, Starlette 1.3.1), with no YouCam or Gemini key. No YouCam units were
spent.

### 5.1 Fixes made in this pass

- **Unreadable stored profile:** editing answers on a partially written `trials.profile_json` returned 500 (`KeyError`).
  It now returns 404 `profile_not_found`. The trial page loads with no profile instead of failing. Removal checks
  the stored column, not its parsed form, so even an unreadable profile can still be erased.
- **Removal works with the flag off; editing doesn't:** `DELETE /trials/{id}/profile` never needed the flag, but the
  trial page offered "Edit answers" even when the server would refuse it. That button now follows
  `skin_profile_enabled`. Turning the feature off (rollback step 1) therefore never traps anyone's answers.
- **Trial start after the flag is switched off:** a tab holding saved answers sent them with the trial, got
  404 `feature_disabled`, and could not start the trial at all. It now starts the trial without the profile. It
  also sends the profile only while the server reports the feature on.
- **Focus management in "Profile at the start" (WCAG 2.4.3):** each step replaced the button that had focus, and
  focus fell back to the page. Focus now goes:
  - to the form's first line on "Edit answers", and back to "Edit answers" on Cancel or Save;
  - to the question on "Remove profile", and back to "Remove profile" on Cancel;
  - to the "You removed your answers…" line after removal. That line is focused once, so it is read once.
- **Old-API compatibility:** the trial page treated a missing `baseline.skin_type` (an API without the field) as
  "reading requested", which showed a false "No profile was saved". It now uses `== null`.

### 5.2 Results

| Check | Result |
|---|---|
| Backend, SQLite | 1370 passed, 2 skipped (opt-in live YouCam) |
| Backend, PostgreSQL 17.11 (throwaway Docker, migrated per test) | 1370 passed, 2 skipped |
| Profile tests alone | 98 passed (3 new: ownership of edit/removal, removal with the flag off, unreadable stored profile) |
| Ruff check + format | Clean |
| Playwright, flag on (desktop + mobile, axe on profile pages) | 70 passed |
| Playwright, flag off | 58 passed, 12 skipped (the 6 profile tests × 2 viewports skip by design) |
| Profile spec repeated 6× (flake check) | 72/72 |
| **New frontend against the old API (`c0f01c3` backend), flag off** | 58 passed, 12 skipped. The Vercel-first window is safe, so cancelling the Vercel build is no longer needed |
| `tsc`, ESLint, `next build` | Clean |
| `pip-audit` (requirements, requirements-dev) | No known vulnerabilities |
| `npm audit --omit=dev` | 0 vulnerabilities. The full audit shows one moderate dev-only `minimatch` advisory through the ESLint toolchain. It predates this PR, which leaves `package-lock.json` unchanged |

**Migration rehearsal:** a fresh PostgreSQL 17 database, with old code `c0f01c3` and new code from this branch
running against it in turn.

| Step | Observed |
|---|---|
| Old code at 0003 creates a sample trial | 200; `/health/ready` reports `0003` |
| New code runs `alembic upgrade head` | `0003 -> 0004`; rows kept; new columns NULL; `alembic check` clean |
| Pre-0004 trial read by new code, flag off and on | JSON identical apart from the new `profile: null` / `skin_type: null` |
| New code, flag on, saves a profiled trial | Profile frozen; one scan reading, one trial profile stored |
| **Old code's start command against 0004** | `Can't locate revision identified by '0004'`: **old code cannot start** |
| New code runs `alembic downgrade 0003` | Both columns dropped; all rows kept; **the saved profile and the reading are gone** |
| **New code against the 0003 schema** | `UndefinedColumn scans.skin_type_json`: **new code cannot serve scans or trials** |
| Old code on the downgraded database | Both trials 200; `/health/ready` reports `0003` |
| Re-upgrade to 0004 | Works. The profiled trial now has `profile: null`, and its baseline reads "missing" (the reading was requested, but its value was deleted by the downgrade) |

### 5.3 Deployment and rollback (replaces §3 step 4)

**Deploy:**
1. Create a Neon backup branch of production `main` (state `0003`). Do not migrate until it shows `ready`.
2. Merge PR #4. Vercel and Render both deploy. The order no longer matters (§5.2): the new frontend works on the old API.
3. Render's start command runs `alembic upgrade head` (`0003 -> 0004`). Check that `/health/ready` reports
   `schema_revision: "0004"` and that the live deploy is the merge commit.
4. `SKIN_PROFILE_ENABLED` stays unset (off). Verify with sample data (0 units): existing trials unchanged, no profile UI,
   ledger unchanged.
5. Enabling the flag is a separate, owner-approved decision. It makes every new live baseline **14 units instead of
   12**, and a live trial ~42 units instead of 36.

**Rollback, tier 1 (use first; no schema change, no data loss):** set `SKIN_PROFILE_ENABLED=false` on Render.
- New baselines go back to 12 units. Focus plans and saving or editing profiles are refused.
- Saved profiles stay visible on their trials and can still be removed.
- A trial whose baseline already asked for the reading keeps doing so (14 units per scan), so a trial's scans stay
  comparable.
- The code stays at the PR #4 merge.

**Rollback, tier 2 (only if the PR #4 code itself must go):**
1. Do tier 1 first.
2. **Assess the loss.** The downgrade deletes every saved profile and every skin-type reading.
   - Count them: `select count(*) from trials where profile_json is not null` and
     `select count(*) from scans where skin_type_json is not null`.
   - Then create a second Neon backup branch (state `0004`), so the deleted data can still be recovered.
3. **Downgrade the database while the PR #4 code is still deployed.** Pre-#4 code cannot do it: it cannot start at
   0004. Use either:
   - `alembic downgrade 0003` run from the PR #4 code with the production `DATABASE_URL` (owner-run), or
   - the same statements in the Neon SQL editor, in one transaction:
     `ALTER TABLE trials DROP COLUMN profile_json; ALTER TABLE scans DROP COLUMN skin_type_json;
     UPDATE alembic_version SET version_num = '0003' WHERE version_num = '0004';`

   From this moment the running PR #4 API fails on scan and trial requests (`UndefinedColumn`) until step 4 lands.
   If it restarts instead, its start command re-applies 0004 with empty columns.
4. **Immediately redeploy the pre-#4 baseline `c0f01c3`.** This is the current `main`, with the #5–#7 fixes.
   - Render: deploy `dep-dbiierbm8hqs73et125g`, or the commit.
   - Vercel: `dpl_5oVEfdNjy3zYbAiHz9cFRLvDe5EL`.
   - **Never `bcc2cba`**: it brings back the 92 dependency advisories fixed in #5.
   - Because `main` still contains PR #4, the next push to `main` would bring 0004 back. Revert the PR #4 merge on
     `main` (`git revert -m 1 <merge>`) **after** the database is at 0003.
5. Verify `/health/ready` reports `0003`, the live deploy is `c0f01c3` (or the revert), and a sample-data journey works.
6. If the downgrade fails or data integrity is uncertain, restore from the Neon backup branch:
   - the step 2 branch keeps the profiles;
   - the pre-migration branch loses every write made since it was taken.

   Never improvise another downgrade.


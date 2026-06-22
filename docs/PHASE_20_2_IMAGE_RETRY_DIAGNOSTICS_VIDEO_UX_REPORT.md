# Phase 20.2 / 20.2.1 Report — Image Retry Diagnostics Hardening + Controlled Real Image Retry Evidence + Safe Restore

## Status
Implemented / verified / evidence captured / safe mode restored

## Objective
Preserve the diagnostics/retry hardening from Phase 20.2, run one controlled real Facebook image retry verification on exactly one connected target, capture safe evidence, and restore the workspace to the default Facebook safety boundary:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

## Scope
This combined verification outcome covers:

- safe provider-side Facebook Graph failure metadata surfacing
- retry safety interpretation in diagnostics snapshot output
- prevention of uncontrolled retry behavior for real Facebook image provider failures
- preservation of local-only video UX continuation
- preservation of blocked-safe Create Post / Bulk Create behavior when real publish is disabled
- exactly one controlled real Facebook image retry evidence run
- safe restore verification after the controlled run

## Files Changed
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_2_IMAGE_RETRY_DIAGNOSTICS_VIDEO_UX_REPORT.md`
- `docs/PHASE_20_2_1_CONTROLLED_IMAGE_RETRY_EVIDENCE_REPORT.md`

## Implementation / Verification Details

### 1. Diagnostics and retry hardening baseline
Phase 20.2 preserved the following behavior:

- failed real Facebook image publish responses carry safe structured metadata including:
  - `provider`
  - `endpointCategory`
  - `httpStatus`
  - `errorType`
  - `safeErrorMessage`
  - `retryable`
  - `timestamp`
  - sanitized nested response payload when available
- queue retry interpretation remains hardened for real Facebook image provider failures
- diagnostics evidence remains secret-safe
- local-only video UX continuation remains intact

Important schema correction remained valid:
- `PublishJob` does **not** have `responseData`
- safe failure evidence is read from `PublishAttempt.responseData`

### 2. Controlled real image retry execution
A single controlled real Facebook image retry was executed using one connected Facebook target only.

Controlled test artifacts:
- post `#24`
- job `#17`
- attempt `#21`

Observed final outcome:
- post `#24` final status: `failed`
- media type: `photo`
- media filename: `phase-20-2-1-normal-test-image.png`
- no remote Facebook post ID stored
- no `fb_sim_*` evidence present

### 3. Safe provider-path failure evidence
Safe provider metadata was captured on the failed controlled attempt.

Observed evidence:
- `provider=facebook`
- `endpointCategory=photo_upload`
- `httpStatus=500`
- `errorType=OAuthException`
- `graphErrorCode=1`
- `safeErrorMessage=An unknown error has occurred.`
- `retryable=true`

Interpretation:
- the real Facebook provider path was reached
- the publish did not succeed
- the resulting failure evidence remained sanitized and secret-safe

### 4. Snapshot / duplicate-job verification
Snapshot verification for posts `24, 23, 22, 21, 15, 14, 6` confirmed:

- post `#24`
  - `status=failed`
  - `attemptCount=1`
  - `failedJobCount=1`
  - `successfulJobCount=0`
  - `hasFbSimEvidence=false`

- post `#23`
  - remains blocked-safe from an earlier disabled-flag run
  - blocked error preserved

- post `#6`
  - remains safely interpreted as `needs_verification`
  - `fb_sim_*` remains non-real evidence only

Duplicate-job verification confirmed:
- no duplicate active jobs for post `#24`
- no duplicate active jobs for posts `#23`, `#22`, `#21`, `#15`, `#14`, `#6`

### 5. Safe restore verification
After the controlled run, the workspace was restored to:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Re-verified blocked-safe behavior:
- `AccountsPage`
  - `realPublishingEnabled=false`
  - `errors=[]`

- `CreatePostPage`
  - exact blocked message visible
  - no created post delta
  - no job delta
  - blocked count = `1`

- `BulkCreatePage`
  - exact blocked message visible
  - modal not opened while disabled
  - no created post delta
  - no job delta
  - blocked count = `1`

- `PostsPersistedBulkReview`
  - exact blocked message visible
  - modal not opened while disabled
  - no created post delta
  - no job delta

Interpretation:
- the workspace safely returned to blocked mode
- no automatic real publish occurred after restore
- queue/scheduler startup remained intact

## Verification

### Commands run
Verified with:
```bash
npx tsc --noEmit
npm run build
FACEBOOK_UI_ASSERT_ON_START=1 timeout 35s npm run dev
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
node scripts/snapshot-posts.mjs 24 23 22 21 15 14 6
```

### Verified runtime result
Observed:
- app starts
- queue starts
- scheduler starts
- final state restored to `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no automatic real publish occurred during the restore verification pass

## Safety Result
Preserved:
- `FACEBOOK_REAL_PUBLISH_ENABLED=false` default safety boundary at end of pass
- canonical Facebook Page scopes
- single real text publish implementation
- single real image publish implementation
- bulk publish safety gate
- local-only video foundation
- attempt timeline visibility
- `fb_sim_*` remains non-real evidence only
- old post `#6` remains safely interpreted as `needs_verification`

## Known Limitations
- the controlled real image retry in this pass failed with sanitized provider evidence instead of succeeding
- real Facebook video publish remains unsupported
- diagnostics retry safety is informational and does not replace explicit controlled confirmation flow
- packaging warnings about missing author/category/icon remain non-blocking metadata warnings
- older long-running terminals may still show stale diagnostics logs until restarted cleanly

## Conclusion
Phase 20.2 hardening remains preserved, and Phase 20.2.1 added one controlled real Facebook image retry evidence run with safe capture and safe restore. The workspace ends this pass in safe mode with:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

and current verification confirms:
- controlled evidence capture completed
- duplicate-job safety remained intact
- blocked-safe runtime behavior remains intact
- no secrets were exposed
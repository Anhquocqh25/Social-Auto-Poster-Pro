# Phase 20.2.1 Controlled Image Retry Evidence Report

## Status
Verified / evidence captured / safe mode restored / Phase 20.3 baseline preserved

## Objective
Capture one controlled real Facebook image retry evidence run on exactly one connected target, record safe provider-path evidence, confirm no `fb_sim_*` misclassification, and restore the workspace to:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

This document remains the canonical evidence reference for the closed Phase 20.2.1 run and was preserved unchanged in meaning during Phase 20.3.

## Controlled Test Boundary
This pass intentionally limited scope to:

- exactly one connected Facebook target
- exactly one queued image post
- exactly one queued publish job
- no bulk real publish
- no multi-Page real publish
- no automatic retry loop beyond the existing controlled pipeline
- no token/secret/callback/state exposure

## Controlled Test Setup

### Temporary runtime enablement
Temporarily set:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=true
```

then restarted the app in a clean runtime state.

### Test media
Controlled image used:
- filename: `phase-20-2-1-normal-test-image.png`
- media type: `photo`
- MIME type: `image/png`
- file size: `371` bytes

### Controlled records created
Created for this pass:
- post `#24`
- job `#17`

## Controlled Execution Result

### Final post result
Observed:
- post id: `24`
- final status: `failed`
- media type: `photo`
- media filename: `phase-20-2-1-normal-test-image.png`
- publishedAt: `null`
- remote Facebook post ID stored: no
- `fb_sim_*` evidence present: no

### Final job result
Observed:
- job id: `17`
- final status: `failed`
- retry count: `0`
- max retries: `3`
- error code: `1`
- safe error message: `An unknown error has occurred.`

### Final attempt result
Observed:
- attempt id: `21`
- attempt number: `1`
- final status: `failed`

## Safe Provider Metadata Evidence

Safe metadata captured in `PublishAttempt.responseData` included:

- `provider=facebook`
- `endpointCategory=photo_upload`
- `httpStatus=500`
- `errorType=OAuthException`
- `graphErrorCode=1`
- `safeErrorMessage=An unknown error has occurred.`
- `retryable=true`
- sanitized nested response payload present

Interpretation:
- the real Facebook image provider path was reached
- the publish failed on the provider side
- the evidence remained sanitized
- no token, page token, secret, callback URL, OAuth code, raw state, or tokenized Graph URL was surfaced

## Snapshot Evidence

### Post snapshot result
Verified with:

```bash
node scripts/snapshot-posts.mjs 24 23 22 21 15 14 6
```

Relevant snapshot observations:

- post `#24`
  - `status=failed`
  - `effectiveStatus=failed`
  - `attemptCount=1`
  - `failedJobCount=1`
  - `successfulJobCount=0`
  - `hasFbSimEvidence=false`
  - latest safe error:
    - `An unknown error has occurred.`

- post `#23`
  - remains blocked-safe from an earlier disabled-flag run
  - latest safe error:
    - `Real Facebook publishing remains disabled until Phase 7 publish enablement is explicitly turned on.`

- post `#6`
  - remains:
    - `effectiveStatus=needs_verification`
  - retains `fb_sim_*` evidence as non-real only

### Duplicate active job check
Verified:
- post `#24`: `hasDuplicateActiveJobs=false`
- post `#23`: `hasDuplicateActiveJobs=false`
- post `#22`: `hasDuplicateActiveJobs=false`
- post `#21`: `hasDuplicateActiveJobs=false`
- post `#15`: `hasDuplicateActiveJobs=false`
- post `#14`: `hasDuplicateActiveJobs=false`
- post `#6`: `hasDuplicateActiveJobs=false`

Interpretation:
- the controlled run did not create duplicate active jobs
- queue state remained clean after the attempt finished

## Safe Restore Result

### Restore action
Restored:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

then restarted the app.

### Safe-mode verification after restore
Observed after restore:
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`

Blocked-safe UI probe result:
- `AccountsPage`
  - `realPublishingEnabled=false`
  - `errors=[]`

- `CreatePostPage`
  - exact blocked message visible
  - `createdPostDelta=0`
  - `jobCountDelta=0`
  - `blockedCount=1`

- `BulkCreatePage`
  - exact blocked message visible
  - modal not opened while disabled
  - `createdPostDelta=0`
  - `jobCountDelta=0`
  - `blockedCount=1`

- `PostsPersistedBulkReview`
  - exact blocked message visible
  - modal not opened while disabled
  - `createdPostDelta=0`
  - `jobCountDelta=0`

Interpretation:
- the workspace safely returned to blocked mode
- no automatic real publish occurred after restore
- bulk/persisted review safety remained intact

## Phase 20.3 Preservation Note
In Phase 20.3:
- this evidence was preserved as the canonical image failure baseline
- no new real image retry was executed
- no meaning of this evidence changed
- the app remained acceptable because it:
  - recorded failure safely
  - did not fake success
  - did not count `fb_sim_*` as real Facebook success

Additional preserved image follow-up note:
- post `#22` image test hit Graph `/photos` and failed with Facebook HTTP `500`
- post `#24` controlled image retry also failed with Facebook HTTP `500`
- both failures were captured safely
- repeated image retry is not allowed in Phase 20.3
- future image follow-up should use:
  - normal user-provided image
  - one clear Page target
  - safe failure metadata
  - max 1 retry

## Safety / Security Result
Confirmed preserved:
- `FACEBOOK_REAL_PUBLISH_ENABLED=false` at end of pass
- canonical Facebook Page scopes unchanged
- no token exposure
- no page token exposure
- no encrypted token exposure
- no App Secret exposure
- no OAuth code exposure
- no callback URL exposure
- no raw OAuth state exposure
- no tokenized Graph URL exposure
- `fb_sim_*` still never counts as real Facebook success
- old post `#6` remains safely interpreted as `needs_verification`

## Known Limitations
- the controlled real image retry in this pass failed with sanitized provider evidence instead of succeeding
- real Facebook video publish remains unsupported
- diagnostics retry safety remains informational and does not replace explicit controlled confirmation flow
- older long-running terminals may still show stale diagnostics output until restarted cleanly

## Conclusion
Phase 20.2.1 successfully captured one controlled real Facebook image retry evidence run, confirmed the real provider path was reached, preserved safe evidence handling, and restored the workspace to:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

with no duplicate active jobs and no secret exposure introduced.

This report remains the canonical baseline reference for image failure follow-up during Phase 20.3 and until a later explicitly authorized image/video follow-up phase replaces it with new controlled evidence.
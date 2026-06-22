# Phase 20.4.1 — Controlled Real Video Single-Test Report

## 1. Summary
Phase 20.4.1 executed one **explicitly approved controlled single-test evidence pass** for the new real Facebook video foundation.

This pass:
- temporarily enabled:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=true`
- created exactly one local queued video candidate
- launched runtime once so queue/startup recovery could act on that candidate
- restored:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- recorded the truthful final outcome without claiming any unverified real Facebook success

## 2. Safety Boundary
Safe final boundary after the pass:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

This pass did **not**:
- claim a real Facebook video publish success
- treat `fb_sim_*` as real evidence
- expose access token, refresh token, page token, encrypted token, App Secret, OAuth code, callback URL, raw OAuth state, tokenized Graph URL, or tokenized upload URL
- change OAuth flow behavior
- narrow Facebook Page scopes
- enable bulk real video publish
- enable automatic retry for real Facebook video attempts
- remote edit/delete Facebook posts

## 3. Controlled Test Scope
Approved single-test scope used:

- exactly one local video candidate
- exactly one real account target
- exactly one runtime launch for queue/recovery handling
- no bulk publish
- no multi-Page execution
- no duplicate active job creation allowed

Controlled candidate created:
- post `#25`
- job `#18`

Media used:
- local file:
  - `.tmp/phase-20-4-1-media/phase-20-4-1-test-video.mp4`
- filename:
  - `phase-20-4-1-test-video.mp4`
- MIME:
  - `video/mp4`
- file size:
  - `3587`

## 4. Commands Executed
Executed in this pass:

```bash
node scripts/phase-20-4-1-controlled-real-video-single-test.cjs
timeout 150s npm run dev; node scripts/snapshot-posts.mjs 25 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
node scripts/snapshot-posts.mjs 25 24 23 22 21 15 14 6
```

## 5. Candidate Creation Result
`node scripts/phase-20-4-1-controlled-real-video-single-test.cjs` returned:

- `ok=true`
- `realAccountId=6`
- `maxPosts=1`
- `videoCount=1`

Created artifact:
- post `#25`
- job `#18`

## 6. Runtime Evidence Result
During the explicit temporary-enabled runtime launch:

- app started
- queue started
- scheduler started
- runtime saw:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=true`

Truthful observed evidence after launch:
- no publish success was recorded
- no `PublishAttempt` row was created for post `#25`
- no provider-attempt evidence was produced
- the queued test job did **not** reach provider execution

## 7. Final Database / Snapshot State
Final observed state for the single-test candidate:

### Post `#25`
- `status=scheduled`
- `effectiveStatus=scheduled`
- `publishedAtPresent=false`
- `mediaType=video`
- `mediaFileName=phase-20-4-1-test-video.mp4`
- `mediaFileSize=3587`
- `mediaMimeType=video/mp4`
- `mediaExtension=.mp4`
- `attemptCount=0`
- `successfulAttemptCount=0`
- `jobCount=1`
- `successfulJobCount=0`
- `failedJobCount=0`
- `pendingJobCount=0`
- `processingJobCount=0`
- `activeJobCount=0`
- `realVideoPublishSupported=false`

### Target state
- target Page remained:
  - `Nguyễn Khắc Anh.Quốc`
- target status remained:
  - `pending`

### Job `#18`
- final status:
  - `cancelled`
- final safe code:
  - `RECOVERED_ON_STARTUP`
- final safe message:
  - `Cancelled during startup recovery so the post can be safely re-queued.`

### Attempt timeline
- `PublishAttempt` rows created:
  - `0`

## 8. Duplicate Active Job Verification
Verified with snapshot evidence:

- post `#25`: `hasDuplicateActiveJobs=false`
- historical baseline posts remained without duplicate active jobs:
  - `#24`
  - `#23`
  - `#22`
  - `#21`
  - `#15`
  - `#14`
  - `#6`

## 9. Historical Safety Preservation
Preserved while running this pass:

- post `#24` remains canonical controlled real-image failure baseline
- post `#23` remains blocked-safe
- post `#22` remains blocked-safe
- posts `#21`, `#15`, `#14` remain published with safe suffix-only surfacing
- old post `#6` remains effectively `needs_verification`
- `fb_sim_*` remains non-real evidence only

## 10. Safe-Mode Restoration Result
After restoring `FACEBOOK_REAL_PUBLISH_ENABLED=false`, safe-mode runtime verification passed again.

Observed:
- `AccountsPage`: sanitized probe output, `realPublishingEnabled=false`, no errors
- `CreatePostPage`: exact blocked message visible, no post/job creation
- `BulkCreatePage`: blocked-safe behavior preserved, no modal bypass, no post/job creation
- `PostsPersistedBulkReview`: blocked-safe behavior preserved, no modal bypass, no post/job creation
- app starts
- queue starts
- scheduler starts

## 11. Security / Logging Result
Preserved in this pass:
- no access token exposure
- no refresh token exposure
- no page token exposure
- no encrypted token exposure
- no App Secret exposure
- no OAuth code exposure
- no callback URL exposure
- no raw OAuth state exposure
- no tokenized Graph URL exposure
- no tokenized upload URL exposure
- no fake success was surfaced
- no unsafe remote edit/delete behavior occurred

## 12. Interpretation
This pass produced **real evidence about the control path**, but **not** a real Facebook provider-attempt result.

What is now proven:
- the explicit single-test setup path can create exactly one controlled queued video candidate
- the workspace can restore safe default after the pass
- the app does not fake a real video success
- duplicate active jobs were not introduced

What is **not** yet proven:
- one real Facebook video queue attempt reaching provider execution
- one real Facebook video outcome of:
  - `published`
  - `failed`
  - `needs_verification`

The current blocker is:
- startup recovery cancelled job `#18` before any provider attempt or `PublishAttempt` artifact was recorded

## 13. Follow-Up Resolution
The blocker identified by this Phase 20.4.1 evidence pass was resolved immediately afterward in Phase 20.4.2.

Resolved follow-up outcome:
- startup recovery logic was hardened so fresh:
  - `queued` posts
  - `pending` jobs
  are preserved instead of being cancelled on app start
- the historical candidate:
  - post `#25`
  - job `#18`
  remains the canonical evidence of the pre-hardening startup recovery issue
- one new controlled candidate in Phase 20.4.2 then reached exactly one queue/provider attempt safely:
  - post `#26`
  - job `#19`
  - attempt `#22`
- the provider reached the real Facebook video upload path and produced a verification-needed honest local failure outcome instead of fake success

## 14. Recommended Next Task
Recommended next task:

**Phase 20.4.3 — Verified Facebook Video Outcome Classification + Attempt Snapshot Consistency**

Focus:
- preserve:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- preserve Phase 20.4.2 startup recovery hardening
- refine how verification-needed video acceptance is surfaced in:
  - attempt timeline
  - snapshot utility
  - post/job summaries
- preserve blocked-safe probes
- preserve no-duplicate-active-job behavior

## 15. Conclusion
Phase 20.4.1 completed successfully as a **controlled evidence pass** and remains important historical evidence.

Truthful final conclusion:
- one explicit single-test video candidate was created
- no provider-attempt artifact was reached for that specific candidate
- the pass exposed a real startup-recovery cancellation bug
- that bug was later fixed in Phase 20.4.2
- no real Facebook video success was claimed in this Phase 20.4.1 pass
- no fake success occurred
- no duplicate active jobs were introduced
- safe default was restored

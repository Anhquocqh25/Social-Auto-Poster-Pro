# Phase 20.4.2 — Startup Recovery Video Queue Hardening Report

## 1. Summary
Phase 20.4.2 completed the **startup recovery vs controlled real video queue execution hardening** required after the Phase 20.4.1 evidence pass.

> Note: Phase 20.4.3 later aligned verification-needed classification and snapshot normalization for the historical post `#26`. This Phase 20.4.2 report remains the canonical execution evidence report, while newer classification interpretation is documented separately.

This phase:
- identified the exact root cause that cancelled the queued real-video candidate before queue execution
- hardened startup recovery so fresh queued posts with pending jobs are preserved
- executed exactly one explicitly approved controlled real video follow-up run
- reached exactly one real Facebook video provider attempt
- preserved honest conservative outcome handling
- restored:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- re-verified blocked-safe runtime behavior after restore

## 2. Safety Boundary
Safe final boundary after the pass:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

This phase did **not**:
- claim an unverified real Facebook video success
- treat `fb_sim_*` as real evidence
- expose access token, refresh token, page token, encrypted token, App Secret, OAuth code, callback URL, raw OAuth state, tokenized Graph URL, or tokenized upload URL
- change OAuth flow behavior
- narrow Facebook Page scopes
- enable bulk real video publish
- enable automatic retry for real Facebook video attempts
- remote edit/delete Facebook posts

## 3. Restore Point / Backup
Created restore point:

```txt
_backups/phase-20-4-2-startup-recovery-video-queue-hardening-20260618-2001
```

Backed up artifacts:
- `src/services/ScheduleService.ts`
- `src/services/QueueService.ts`
- `src/services/PublishJobService.ts`
- `src/pages/CreatePostPage.tsx`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_4_1_CONTROLLED_REAL_VIDEO_SINGLE_TEST_REPORT.md`

## 4. Root Cause Identified
The exact root cause was verified from runtime evidence and code inspection:

- `ScheduleService.recoverInterruptedPosts()` treated every post with status:
  - `queued`
  - `posting`
  as interrupted startup state
- it then cancelled all matching jobs with status:
  - `pending`
  - `processing`
- therefore the Phase 20.4.1 candidate:
  - post `#25`
  - job `#18`
  was cancelled during startup recovery before queue processing created any `PublishAttempt`

Truthful historical evidence preserved:
- job `#18`
  - `status=cancelled`
  - `errorCode=RECOVERED_ON_STARTUP`
- post `#25`
  - `status=scheduled`
  - `effectiveStatus=scheduled`
- `PublishAttempt` count for post `#25`
  - `0`

## 5. Code Change Implemented
Updated file:
- `src/services/ScheduleService.ts`

Implemented hardening:
- preserve `queued` posts when:
  - active jobs are fresh `pending`
  - no `processing` jobs exist
- cancel only truly interrupted `processing` jobs during startup recovery
- downgrade `posting` back to `queued` when pending jobs still exist after restart
- safely fall back to:
  - `scheduled`
  - or `failed`
  only when queue state is genuinely interrupted or missing
- keep lock release / queue startup behavior intact
- do not fake success
- do not create duplicate active jobs

## 6. Baseline Verification Before Controlled Follow-Up
Verified in current workspace before the follow-up controlled run:

```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 25 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

Observed:
- TypeScript passed
- production build passed
- app started
- queue started
- scheduler started
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- blocked-safe probes remained intact
- no real publish occurred in dry verification
- Phase 20.4.1 evidence for post `#25` remained preserved

## 7. Controlled Follow-Up Scope
Approved follow-up scope used:
- exactly one new local video candidate
- exactly one real account target
- exactly one runtime launch for queue/provider execution
- no bulk publish
- no multi-Page execution
- no duplicate active job creation allowed

New controlled candidate created:
- post `#26`
- job `#19`

Media used:
- local file:
  - `.tmp/phase-20-4-1-media/phase-20-4-1-test-video.mp4`
- filename:
  - `phase-20-4-1-test-video.mp4`
- MIME:
  - `video/mp4`
- file size:
  - `3587`

## 8. Commands Executed
Executed in this phase:

```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 25 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

Temporary controlled enablement:
```bash
# .env.local
FACEBOOK_REAL_PUBLISH_ENABLED=true
```

Controlled candidate creation:
```bash
node - <<'NODE'
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const REAL_ACCOUNT_ID = 6;
const TEST_VIDEO_PATH = path.resolve(process.cwd(), ".tmp/phase-20-4-1-media/phase-20-4-1-test-video.mp4");
const CONTENT = "Controlled real video queue execution test — Phase 20.4.2";

(async () => {
  const stat = fs.statSync(TEST_VIDEO_PATH);
  const post = await prisma.post.create({
    data: {
      title: "Controlled real video queue execution test — Phase 20.4.2",
      content: CONTENT,
      mediaType: "video",
      mediaLocalPath: TEST_VIDEO_PATH,
      mediaFileName: path.basename(TEST_VIDEO_PATH),
      mediaFileSize: stat.size,
      mediaMimeType: "video/mp4",
      mediaExtension: ".mp4",
      status: "queued",
      postTargets: {
        create: [{ accountId: REAL_ACCOUNT_ID, status: "pending" }]
      }
    }
  });

  const job = await prisma.publishJob.create({
    data: {
      postId: post.id,
      accountId: REAL_ACCOUNT_ID,
      platform: "facebook",
      status: "pending",
      priority: 0,
      retryCount: 0,
      maxRetries: 0
    }
  });

  console.log(JSON.stringify({ postId: post.id, jobId: job.id }, null, 2));
})().finally(async () => {
  await prisma.$disconnect();
});
NODE
```

Controlled runtime execution:
```bash
timeout 150s npm run dev
node scripts/snapshot-posts.mjs 26 25 24 23 22 21 15 14 6
```

Safe-mode restoration:
```bash
# .env.local
FACEBOOK_REAL_PUBLISH_ENABLED=false
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
node scripts/snapshot-posts.mjs 26 25 24 23 22 21 15 14 6
```

## 9. Controlled Runtime Evidence
During the explicit temporary-enabled runtime launch:

- app started
- queue started
- scheduler started
- startup recovery preserved queued post `#26`
- queue picked:
  - job `#19`
- provider execution was reached
- real Facebook video upload path was reached
- safe endpoint category was:
  - `video_upload`

Observed provider evidence:
- Facebook accepted a video id
- safe suffix:
  - `895504`

Runtime evidence remained honest:
- no published success was claimed
- no duplicate active jobs were introduced
- no auto retry occurred

## 10. Final Database / Snapshot State

### Post `#26`
- `status=failed`
- `effectiveStatus=failed`
- `publishedAtPresent=false`
- `mediaType=video`
- `mediaFileName=phase-20-4-1-test-video.mp4`
- `mediaFileSize=3587`
- `mediaMimeType=video/mp4`
- `mediaExtension=.mp4`
- `attemptCount=1`
- `successfulAttemptCount=1`
- `jobCount=1`
- `successfulJobCount=0`
- `failedJobCount=1`
- `pendingJobCount=0`
- `processingJobCount=0`
- `activeJobCount=0`
- `latestSafeErrorMessage=Facebook video upload requires verification before it can be treated as published.`
- `realVideoPublishSupported=false`

### Target state for post `#26`
- target Page:
  - `Nguyễn Khắc Anh.Quốc`
- target status:
  - `failed`
- target error:
  - `Needs verification before this video can be treated as published.`

### Job `#19`
- final status:
  - `failed`
- final safe code:
  - `FACEBOOK_VIDEO_NEEDS_VERIFICATION`
- final safe message:
  - `Facebook accepted the video upload but final publish confirmation was not returned.`
- `retryCount=0`

### Attempt `#22`
- `attemptNumber=1`
- attempt row status:
  - `success`
- response payload:
  - `{"id":"763077486895504"}`

Interpretation:
- provider acceptance was recorded honestly
- local outcome remained conservative because stronger publish confirmation was not available
- the app did not fake a published result

## 11. Duplicate Active Job Verification
Verified with snapshot evidence:

- post `#26`: `hasDuplicateActiveJobs=false`
- post `#25`: `hasDuplicateActiveJobs=false`
- historical baseline posts also remained without duplicate active jobs:
  - `#24`
  - `#23`
  - `#22`
  - `#21`
  - `#15`
  - `#14`
  - `#6`

## 12. Safe-Mode Restoration Result
After restoring `FACEBOOK_REAL_PUBLISH_ENABLED=false`, safe-mode runtime verification passed again.

Observed:
- `AccountsPage`
  - sanitized probe output
  - `realPublishingEnabled=false`
  - `errors=[]`
- `CreatePostPage`
  - exact blocked message visible
  - no post/job creation
- `BulkCreatePage`
  - blocked-safe behavior preserved
  - no modal bypass
  - no post/job creation
- `PostsPersistedBulkReview`
  - blocked-safe behavior preserved
  - no modal bypass
  - no post/job creation
- app starts
- queue starts
- scheduler starts

## 13. Historical Safety Preservation
Preserved while running this phase:
- post `#24` remains canonical controlled real-image failure baseline
- post `#23` remains blocked-safe
- post `#22` remains blocked-safe
- posts `#21`, `#15`, `#14` remain published with safe suffix-only surfacing
- old post `#6` remains effectively `needs_verification`
- `fb_sim_*` remains non-real evidence only

## 14. Security / Logging Result
Preserved in this phase:
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

## 15. Interpretation
This phase successfully resolved the startup recovery blocker that Phase 20.4.1 exposed.

What is now proven:
- startup recovery no longer cancels fresh queued/pending controlled video work on app start
- the workspace can reach exactly one real Facebook video provider attempt safely
- the app records an honest conservative local result when Facebook accepts a video id but final publish confirmation is still insufficient
- duplicate active jobs were not introduced
- safe default can be restored after the controlled run

What is **not** yet proven:
- a verified end-to-end Facebook video local `published` outcome
- a cleaner unified classification between:
  - provider acceptance
  - verification-needed local outcome
  - attempt timeline semantics

## 16. Recommended Next Task
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

## 17. Conclusion
Phase 20.4.2 completed successfully.

Truthful final conclusion:
- the startup recovery cancellation bug was identified and fixed
- exactly one controlled real Facebook video provider attempt was reached
- no real Facebook video success was falsely claimed
- no fake success occurred
- no duplicate active jobs were introduced
- safe default was restored
# Phase 20.4 — Controlled Real Video Upload Foundation Report

## 1. Summary
Phase 20.4 implemented the first safe **controlled real Facebook video upload foundation** for the workspace.

This pass:
- added backend local-file multipart video upload groundwork
- added honest provider result semantics for video
- hardened queue behavior to avoid fake success and auto retry
- added Create Post confirmation UX for immediate video publish attempts
- preserved safe default:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- did **not** run a real Facebook video publish test

## 2. Safety Boundary
Safe default at the end of the pass:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

This phase did **not**:
- enable uncontrolled real publish
- auto retry real Facebook video attempts
- treat ambiguous upload state as success
- expose token/secret/callback/upload URLs
- run any controlled real video test
- run any bulk real video publish

## 3. Files Changed
Implementation files:
- `src/services/facebook/FacebookProviderTypes.ts`
- `src/services/facebook/FacebookPostProvider.ts`
- `src/services/facebook/FacebookService.ts`
- `src/services/QueueService.ts`
- `src/pages/CreatePostPage.tsx`
- `src/types/electron.d.ts`

Documentation/state files:
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_4_CONTROLLED_REAL_VIDEO_UPLOAD_FOUNDATION_REPORT.md`

## 4. Backup / Restore Point
Restore point created:
- `_backups/phase-20-4-controlled-real-video-upload-foundation-20260618-1824`

## 5. Provider Foundation Result
Implemented in provider/service layer:

### 5.1 Result contract
`FacebookPublishResult` now supports:
- `finalState='published'`
- `finalState='failed'`
- `finalState='needs_verification'`

This allows queue handling to distinguish:
- confirmed success
- confirmed failure
- accepted-but-not-safe-to-claim success

### 5.2 Video upload strategy
Real video groundwork now uses:
- backend local-file multipart upload
- Graph endpoint:
  - `POST /{pageId}/videos`

This replaces the earlier unsuitable first-rollout direction of relying on:
- `file_url`

### 5.3 Validation result
Implemented safe validation for:
- missing local video file
- unsupported video type
- local-file requirement for real video upload

### 5.4 Safe failure metadata
Video-safe metadata now aligns to:
- `endpointCategory='video_upload'`

No tokenized upload URL or tokenized Graph URL is surfaced.

## 6. Queue / Execution Result
Implemented in `src/services/QueueService.ts`:

### 6.1 Honest final-state handling
Queue now consumes provider `finalState`.

Behavior:
- `success + published` → normal publish success path
- `success + needs_verification` → not treated as published
- `failed` → explicit failed/blocked handling remains

### 6.2 No fake success
Ambiguous video outcomes are no longer silently converted into:
- local `published`
- successful job completion
- successful target completion

### 6.3 No auto retry
Real Facebook video attempts are intentionally treated as:
- non-auto-retryable

This prevents:
- blind exponential retry
- accidental duplicate real video publish attempts
- retrying ambiguous upload state without explicit user action

## 7. Create Post Confirmation UX Result
Implemented in `src/pages/CreatePostPage.tsx`.

### 7.1 Modal behavior
For immediate video publish attempts:
- modal opens before any queued job is created

### 7.2 Required confirmation controls
Implemented:
- checkbox confirmation
- typed confirmation:
  - `PUBLISH VIDEO`

Final confirm button remains disabled until both checks pass.

### 7.3 Warning content
The modal now warns that:
- a real Facebook video may be published
- upload may take time
- the app does not remote edit/delete Facebook video posts
- local delete does not delete a published Facebook video
- the flow remains queue-backed only

### 7.4 Disabled-safe behavior
When `FACEBOOK_REAL_PUBLISH_ENABLED=false`:
- blocked message remains visible
- no confirmation modal bypass occurs
- no queued job is created

## 8. Diagnostics / Type Contract Result
Aligned safe contract in `src/types/electron.d.ts`:

- safe failure endpoint category now includes:
  - `video_upload`

This keeps runtime/diagnostic typing consistent with the provider and queue changes.

## 9. Baseline Preservation Result
Preserved canonical Phase 20.2.1 evidence:
- post `#24`
- job `#17`
- attempt `#21`

Still preserved:
- no fake success
- no `fb_sim_*` counted as real success
- no duplicate active jobs introduced
- old post `#6` remains effectively `needs_verification`

## 10. Verification Commands
Verified with:

```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

## 11. Verification Result

### 11.1 Type/build result
- `npx tsc --noEmit` PASS
- `npm run build` PASS

### 11.2 Snapshot result
- `node scripts/snapshot-posts.mjs 24 23 22 21 15 14 6` PASS

Observed:
- post `#24` remains `failed`
- post `#23` remains blocked-safe
- post `#22` remains blocked-safe
- post `#21`, `#15`, `#14` remain published with safe suffix-only evidence
- post `#6` remains effectively `needs_verification`

### 11.3 Runtime probe result
- `FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev` PASS

Observed:
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no real publish occurred

### 11.4 UI blocked-safe result
Observed:
- `AccountsPage`: sanitized probe output, no errors
- `CreatePostPage`: exact blocked message visible, no post/job creation
- `BulkCreatePage`: blocked-safe behavior preserved
- `PostsPersistedBulkReview`: blocked-safe behavior preserved

## 12. Security / Safety Result
Preserved:
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

Also preserved:
- no OAuth flow change
- no Page-scope narrowing
- no remote edit/delete behavior
- no fake success semantics
- no automatic real-video retry

## 13. Known Limitations
Still intentionally limited in this phase:
- no controlled real video evidence run yet
- no bulk real video publish
- no multi-video publish
- no multi-Page real video publish
- no upload-progress polling UX yet
- no post-upload verification workflow yet beyond safe `needs_verification` handling
- no dedicated video evidence snapshot beyond the existing safe counters/contracts

## 14. Phase 20.4.1 Addendum
After explicit approval, a dedicated evidence follow-up pass was executed and recorded separately in:

- `docs/PHASE_20_4_1_CONTROLLED_REAL_VIDEO_SINGLE_TEST_REPORT.md`

Addendum summary:
- temporary enablement used:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=true`
- one local queued video candidate was created:
  - post `#25`
  - job `#18`
- truthful final outcome:
  - no `PublishAttempt` row was created
  - job `#18` ended:
    - `cancelled`
  - safe error code:
    - `RECOVERED_ON_STARTUP`
  - post `#25` remained:
    - `status=scheduled`
- no fake success occurred
- no duplicate active jobs were introduced
- safe default was restored:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

## 15. Recommended Next Task
Recommended next task:

**Phase 20.4.2 — Startup Recovery vs Controlled Real Video Queue Execution Hardening**

Focus:
- inspect why startup recovery cancelled job `#18` before provider execution
- preserve:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- preserve blocked-safe UI/runtime probes
- preserve no-duplicate-active-job behavior
- enable one future explicit controlled video test to reach exactly one queue/provider attempt safely

## 16. Conclusion
Phase 20.4 remains complete as an **implementation foundation** pass.

Updated verified outcome:
- safe groundwork exists
- dry verification passes
- safe default remains restored
- a separate explicit single-test evidence pass has now been recorded
- no real Facebook video provider attempt or success was falsely claimed

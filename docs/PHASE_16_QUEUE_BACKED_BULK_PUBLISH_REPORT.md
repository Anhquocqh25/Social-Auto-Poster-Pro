# Phase 16 — Queue-Backed Controlled Bulk Publish Report

## 1. Backup / Restore Point
- `_backups/phase-16-queue-backed-controlled-bulk-publish-20260613-1354`

## 2. Files Changed
- `src/pages/BulkCreatePage.tsx`
- `electron/main.ts`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_16_QUEUE_BACKED_BULK_PUBLISH_REPORT.md`

## 3. Baseline Result
Preserved in this phase:
- Phase 15 confirmation/safety UI
- single real text publish
- single real image publish
- Create Post
- Bulk Create
- CSV import
- per-row media
- View created posts
- Posts detail
- attempt timeline
- Accounts / Pages
- Diagnostics
- scheduler / queue
- VI/EN language switcher
- Vietnamese default
- `FACEBOOK_REAL_PUBLISH_ENABLED=false` safe baseline
- old post `#6` remains `needs_verification`
- `fb_sim_*` still never counts as real Facebook success

Verification:
- current workspace:
  - `npx tsc --noEmit` PASS
  - `npm run build` PASS
- repaired Linux runtime environment:
  - `/home/anh-quoc/projects/social-auto-poster-pro`
  - `npx tsc --noEmit` PASS
  - `npm run build` PASS
  - `npm run dev` startup PASS
  - app starts
  - queue starts
  - scheduler starts
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

## 4. Batch Safety Limit Result
Implemented:
- strict controlled bulk publish batch limit:
  - max `3` posts per batch
- if eligible rows exceed the limit:
  - selection is blocked
  - no auto-split
  - no silent queueing beyond the limit
- user-facing message:
  - `Controlled bulk publish is limited to 3 posts per batch. Reduce the selection and try again.`

## 5. Eligibility Rules Result
Implemented or surfaced in Phase 16:
- Missing target Page.
- Missing content or image.
- Image file is missing. Reattach the image.
- Unsupported media type.
- Real publish is disabled.
- Page readiness failed.
- Invalid row state.
- Batch limit exceeded.

Current limitation:
- because Bulk Create works from new unsaved rows rather than previously created posts, these existing-post state checks are not yet fully wired at row-review level in this pass:
  - Already published.
  - Needs verification.
  - Already queued or posting.
  - Cancelled post cannot be published.
  - Video is not supported in bulk publish yet.
  - Multi-image bulk publish is not supported yet.

## 6. Queue-Backed Execution Result
Implemented:
- after final confirmation, eligible rows create local posts with `status='queued'`
- `posts:create` remains the queue entry point
- queued posts create publish jobs through existing `publishJobService.createJobsForPost()`
- no direct Facebook Graph call is made from the UI
- Page/media metadata is preserved
- text/photo media intent is preserved
- created post ids are surfaced safely in the progress UI

Preserved:
- no fake success
- local posts are not marked `published` by the UI
- final publish status still depends on the existing provider/queue result path

## 7. Cancellation-Before-Start Result
Implemented:
- queued bulk posts can be cancelled before queue start
- UI only exposes cancellation when post status is still `queued`
- `posts:cancelScheduled` was hardened so it no longer cancels `processing` jobs
- if a job is already processing/posting, cancellation is blocked with a clear safe message
- no remote delete is attempted

UI explanation preserved:
- only queued jobs that have not started can be cancelled
- published Facebook posts are not deleted remotely

## 8. Progress UI Result
Upgraded from Phase 15 groundwork into queue-aware Phase 16 progress UI.

Shows:
- selected count
- eligible count
- queued count
- posting count
- published count
- failed count
- blocked count
- cancelled count
- per-post status
- safe message per post
- View in Posts button

Behavior:
- progress panel polls current local post status through `posts:getById`
- progress never shows tokens or secrets
- status badges reflect queue-backed lifecycle

## 9. Posts / Attempt Timeline Integration Result
Preserved and supported:
- queue-created bulk posts appear in Posts through the normal local post path
- statuses remain aligned with existing post lifecycle:
  - queued
  - posting
  - published
  - failed
  - blocked
  - cancelled
- Page metadata remains preserved
- media metadata remains preserved
- attempt timeline remains preserved through existing queue/job/attempt infrastructure
- safe external id suffix behavior remains preserved
- no full tokenized URLs are shown
- `fb_sim_*` is still never treated as real success
- old post `#6` remains `needs_verification`

## 10. Controlled Real Test Result
Controlled real bulk test:
- NOT RUN in this pass

Current state:
- `FACEBOOK_REAL_PUBLISH_ENABLED=false` remains preserved

## 11. Preserved Functionality Result
Confirmed preserved by code inspection and verification:
- single text publish
- single image publish
- Create Post
- Bulk Create
- CSV import
- per-row media
- View created posts
- Posts detail
- attempt timeline
- Accounts / Pages
- Diagnostics
- scheduler / queue
- VI/EN switcher
- Vietnamese default
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- old post `#6` remains `needs_verification`
- `fb_sim_*` never counts as real success

## 12. Safety / Security Result
Confirmed preserved:
- no access token exposure
- no refresh token exposure
- no page access token exposure
- no encrypted token exposure
- no App Secret exposure
- no OAuth code exposure
- no callback URL exposure
- no raw OAuth state exposure
- no tokenized Graph URL exposure
- no OAuth flow changes
- no Facebook scope narrowing
- no fake real-publish success
- no remote edit/delete behavior introduced
- no automatic background publish introduced
- no direct Graph publish call from the UI introduced

## 13. Build / Runtime Result
Verified in current workspace:
- `npx tsc --noEmit` PASS
- `npm run build` PASS

Verified in repaired Linux environment:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `npm run dev` startup PASS

Runtime confirmation:
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`

Packaging notes:
- AppImage requires `libfuse2` / `libfuse2t64` to run directly
- `linux-unpacked` can be used for local testing
- missing author/category/icon warnings remain non-blocking

## 14. Docs Updated
Updated:
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_16_QUEUE_BACKED_BULK_PUBLISH_REPORT.md`

## 15. Known Limitations
- explicit manual UI verification of the new queue-backed Phase 16 flow is still recommended
- controlled real bulk publish test was not run
- row-review eligibility currently models new Bulk Create rows, not previously created existing posts
- existing-post states are not yet fully modeled at review layer:
  - already published
  - needs_verification
  - already queued/posting
  - cancelled
  - multi-image
  - video
- queue-backed controlled bulk execution currently relies on the existing queue infrastructure rather than a dedicated bulk orchestration IPC/service

## 16. Revert Instructions
To revert Phase 16:
1. Revert:
   - `src/pages/BulkCreatePage.tsx`
   - `electron/main.ts`
   - `CURRENT_TASK.md`
   - `PROJECT_STATE.md`
   - `docs/RUNTIME_TEST_REPORT.md`
   - `docs/PHASE_16_QUEUE_BACKED_BULK_PUBLISH_REPORT.md`
2. Keep:
   - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
   - canonical Facebook Page scopes
   - controlled real text/image publish implementation
   - queue/scheduler/runtime fixes from prior phases
3. Restore from:
   - `_backups/phase-16-queue-backed-controlled-bulk-publish-20260613-1354`
4. Re-run:
   - `npx tsc --noEmit`
   - `npm run build`
   - `npm run dev`

## 17. Exact Manual Test For User
Recommended exact manual test:

### With `FACEBOOK_REAL_PUBLISH_ENABLED=false`
1. Open **Bulk Create**
2. Verify existing behaviors still work:
   - add image per row
   - replace/remove image
   - CSV import with `mediaPath` / `imagePath`
   - save local drafts
   - save scheduled rows
   - View created posts
3. Keep:
   - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
4. Click **Bulk Real Publish**
5. Verify blocked message appears exactly:
   - `Bulk real publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable controlled bulk publish.`
6. Verify:
   - no job creation
   - no real publish
   - no token/secret exposure

### With `FACEBOOK_REAL_PUBLISH_ENABLED=true` for UI-only dry verification
1. Set:
   - `FACEBOOK_REAL_PUBLISH_ENABLED=true`
2. Restart app
3. Open **Bulk Create**
4. Prepare rows:
   - 1 valid text-only row
   - 1 valid image row
   - 1 invalid row missing target Page
   - 1 invalid row with missing image / reattach required
5. Verify:
   - max batch limit `3` is enforced
   - invalid/ineligible rows show clear reasons
6. Click **Bulk Real Publish**
7. Verify confirmation requires:
   - checkbox ticked
   - typed `PUBLISH`
8. Confirm
9. Verify:
   - eligible rows become queued local posts
   - progress panel shows queue-aware counts
   - queued items can be cancelled before start
   - posting items cannot be cancelled from this UI
   - View in Posts works
   - no token/secret exposure appears

### Controlled real publish test
- do not run unless explicitly approved by the user

## 18. Recommended Next Task
Recommended next task:
- **Phase 16.1 / 17 — Controlled Real Bulk Publish Verification + Hardening**
- suggested scope:
  - explicit manual UI verification of Phase 16 queue-backed flow
  - optional tiny controlled real bulk publish test only if explicitly approved
  - stronger post-backed eligibility re-checks
  - dedicated IPC/service orchestration for bulk queue creation if needed
  - keep batch-size limit
  - keep no-auto-retry rule
  - continue guaranteeing `fb_sim_*` never counts as real Facebook success
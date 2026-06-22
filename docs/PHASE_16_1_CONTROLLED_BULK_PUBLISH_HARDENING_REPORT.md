# Phase 16.1 — Controlled Bulk Publish Verification + Hardening Report

## 1. Backup / Restore Point
- `_backups/phase-16-1-controlled-bulk-publish-hardening-20260613-1411`

## 2. Files Changed
- `src/pages/BulkCreatePage.tsx`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_16_QUEUE_BACKED_BULK_PUBLISH_REPORT.md`
- `docs/PHASE_16_1_CONTROLLED_BULK_PUBLISH_HARDENING_REPORT.md`

## 3. Baseline Result
Preserved:
- Phase 16 queue-backed controlled bulk publish implementation
- strict batch limit max `3`
- no direct Facebook Graph call from UI
- queued-before-start cancellation only
- `FACEBOOK_REAL_PUBLISH_ENABLED=false` safe default
- `fb_sim_*` still never counts as real Facebook success
- old post `#6` remains `needs_verification`

Verification available for baseline:
- current workspace:
  - `npx tsc --noEmit` PASS
- previously verified Phase 16 baseline:
  - `npm run build` PASS
  - repaired Linux runtime startup PASS
  - app starts
  - queue starts
  - scheduler starts
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

## 4. Flag-False Verification Result
Manual UI verification with flag false:
- NOT RUN in this pass

Current hardening state:
- blocked behavior remains preserved
- blocked message string remains:
  - `Bulk real publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable controlled bulk publish.`

No evidence of code changes that would remove the flag-false block.

## 5. Flag-True Dry Verification Result
Manual dry verification with flag true:
- NOT RUN in this pass

Current code-level state:
- confirmation modal still requires:
  - checkbox
  - typed `PUBLISH`
- batch limit max `3` remains enforced
- invalid rows still show explicit reasons
- no token/secret rendering was added

## 6. Eligibility Hardening Result
Implemented in this pass:
- explicit eligibility reason added:
  - `Missing source account id.`
- row-level eligibility now distinguishes:
  - Missing target Page.
  - Missing source account id.
  - Missing content or image.
  - Image file is missing. Reattach the image.
  - Unsupported media type.
  - Real publish is disabled.
  - Page readiness failed.
  - Batch limit exceeded.
  - Invalid row state.

Documented boundary:
- row-level checks are real for new unsaved Bulk Create rows
- post-backed checks are not faked in this pass for unsaved rows:
  - Already queued or posting
  - Already published
  - Needs verification
  - Cancelled post cannot be published
  - Video is not supported in bulk publish yet
  - Multi-image bulk publish is not supported yet

## 7. Queue Creation Hardening Result
Verified/hardened at code level:
- confirm button remains disabled while bulk queue creation is in progress
- blocked rows are not queued
- batch limit remains enforced before queue creation
- created post ids are tracked safely in local progress state
- no direct Graph call from UI
- queue creation still routes through:
  - local queued post creation
  - existing `posts:create`
  - existing `publishJobService.createJobsForPost()`

Known boundary:
- this pass did not add a dedicated anti-double-submit backend transaction layer
- current protection is primarily UI-side submit disabling plus existing active-job prevention in queue/job creation path

## 8. Cancellation Hardening Result
Preserved and verified by code review:
- queued pending jobs can be cancelled before start
- processing/posting jobs cannot be cancelled from this UI
- local cancellation remains safe
- no remote delete is attempted
- user-facing explanation remains:
  - `Only queued jobs that have not started can be cancelled. Published Facebook posts are not deleted remotely.`

## 9. Progress / Posts / Timeline Result
Preserved:
- progress panel remains queue-aware
- counts remain available for:
  - selected
  - eligible
  - queued
  - posting
  - published
  - failed
  - blocked
  - cancelled
- View in Posts remains wired
- Posts integration remains through the normal local post path
- Page metadata remains preserved
- media metadata remains preserved
- attempt timeline remains dependent on the existing queue/provider path only
- safe external id suffix behavior remains preserved
- `fb_sim_*` still never counts as real success
- old post `#6` remains `needs_verification`

Manual UI verification in this pass:
- NOT RUN

## 10. Optional Controlled Real Test Result
Controlled real bulk publish test:
- NOT RUN

State preserved:
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`

## 11. Preserved Functionality Result
Confirmed preserved by code inspection and baseline verification:
- single text publish
- single image publish
- Create Post
- Bulk Create
- CSV import
- per-row media
- View created posts
- Posts detail
- attempt timeline
- Accounts/Pages
- Diagnostics
- scheduler/queue
- VI/EN switcher
- Vietnamese default
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
- no OAuth changes
- no Facebook scope narrowing
- no fake success
- no remote edit/delete
- no auto-publish

## 13. Build / Runtime Result
Verified in this pass:
- current workspace:
  - `npx tsc --noEmit` PASS

Baseline previously verified for the active Phase 16 implementation:
- current workspace:
  - `npm run build` PASS
- repaired Linux runtime environment:
  - `npx tsc --noEmit` PASS
  - `npm run build` PASS
  - `npm run dev` startup PASS

## 14. Docs Updated
Updated:
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_16_QUEUE_BACKED_BULK_PUBLISH_REPORT.md`
- `docs/PHASE_16_1_CONTROLLED_BULK_PUBLISH_HARDENING_REPORT.md`

## 15. Known Limitations
- manual UI verification with flag false was not run in this pass
- dry UI verification with flag true was not run in this pass
- controlled real bulk publish test was not run
- row-review still models new unsaved rows, not persisted existing posts
- post-backed states are therefore still not fully enforced at review layer
- queue-backed execution still relies on the existing queue infrastructure rather than a dedicated orchestration IPC/service

## 16. Revert Instructions
To revert Phase 16.1:
1. Revert:
   - `src/pages/BulkCreatePage.tsx`
   - `CURRENT_TASK.md`
   - `PROJECT_STATE.md`
   - `docs/RUNTIME_TEST_REPORT.md`
   - `docs/PHASE_16_QUEUE_BACKED_BULK_PUBLISH_REPORT.md`
   - `docs/PHASE_16_1_CONTROLLED_BULK_PUBLISH_HARDENING_REPORT.md`
2. Keep:
   - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
   - canonical Facebook Page scopes
   - Phase 16 queue-backed flow
   - queue/scheduler/runtime fixes from prior phases
3. Restore from:
   - `_backups/phase-16-1-controlled-bulk-publish-hardening-20260613-1411`

## 17. Exact Manual Test For User
### With `FACEBOOK_REAL_PUBLISH_ENABLED=false`
1. Open **Bulk Create**
2. Verify blocked message appears:
   - `Bulk real publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable controlled bulk publish.`
3. Verify:
   - no job creation
   - no queued/posting state caused by blocked bulk publish
   - no token/secret exposure

### With `FACEBOOK_REAL_PUBLISH_ENABLED=true` for dry UI verification only
1. Restart app with the flag enabled
2. Prepare:
   - 1 valid text-only row
   - 1 valid image row
   - 1 row missing target Page
   - 1 row with invalid/missing image
   - optionally 4 valid rows to confirm batch limit
3. Verify:
   - confirmation modal opens before queue creation
   - checkbox is required
   - typed `PUBLISH` is required
   - batch limit max `3` is enforced
   - invalid rows show clear reasons
   - valid rows are distinguishable from invalid rows
   - no token/secret exposure
4. Do not click final confirm unless a controlled test is explicitly approved

## 18. Recommended Next Task
Recommended next task:
- **Phase 16.2 / 17 — Controlled Real Bulk Publish Verification + Post-Level Eligibility Hardening**
- suggested scope:
  - explicit manual verification with flag false
  - dry verification with flag true
  - optional tiny controlled real bulk publish test only if explicitly approved
  - stronger post-backed eligibility rules
  - optional dedicated bulk orchestration IPC/service if needed
# Phase 15 — Controlled Bulk Real Publish Design + Confirmation Modal Report

## 1. Backup / Restore Point
- `_backups/phase-15-controlled-bulk-publish-safety-20260613-1238`

## 2. Files Changed
- `src/pages/BulkCreatePage.tsx`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_15_CONTROLLED_BULK_PUBLISH_REPORT.md`

## 3. Baseline Result
Preserved in this phase:
- SO9 UI shell
- Bulk Create route
- CSV import
- per-row image support
- View created posts
- Create Post
- Posts detail
- Accounts / Pages
- Diagnostics
- queue / scheduler behavior
- VI default + VI/EN switcher
- `FACEBOOK_REAL_PUBLISH_ENABLED=false` safe baseline
- post `#6` remains `needs_verification`
- `fb_sim_*` still never counts as real Facebook success

Verification:
- restore point created successfully
- `npx tsc --noEmit` PASS

Current re-verification in the workspace:
- `npm run build` PASS
- `npm run dev` PASS
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no real publish occurs during safe-mode verification

## 4. Bulk Publish Confirmation Modal Result
Implemented:
- visible Bulk Real Publish action remains present in Bulk Create
- when `FACEBOOK_REAL_PUBLISH_ENABLED=false`, action is blocked with required message:
  - `Bulk real publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable controlled bulk publish.`
- when config status is available and real publish is enabled, user can open a confirmation surface before any job creation
- confirmation surface shows:
  - total selected posts
  - Page distribution
  - text-only count
  - image count
  - scheduled count
  - immediate count
  - invalid/ineligible count
- warnings shown:
  - real posts would publish to Facebook if execution is enabled in a later phase
  - remote undo/delete is not performed by this app
  - local delete does not delete Facebook posts
  - `fb_sim_*` is never treated as real Facebook success
- required confirmation controls implemented:
  - checkbox acknowledgement
  - typed `PUBLISH`
  - final confirm remains disabled until both pass

## 5. Eligibility Rules Result
Implemented or surfaced in Phase 15:
- Missing target Page
- Missing content or image
- Image file is missing / reattach required
- Unsupported media type
- Real publish is disabled
- Page readiness failed
- Invalid row state

Historical Phase 15 limitation note:
- at the time of the initial Phase 15 landing, some post-backed states were intentionally deferred
- in the current workspace baseline, these states are now covered by later hardening / queue-backed follow-up phases

## 6. Execution / Progress Result
Implemented:
- safe progress groundwork after confirmation
- progress panel shows:
  - queued count
  - processing count
  - published count
  - failed/blocked count
  - per-row result
  - View in Posts button

Current verified workspace behavior:
- confirmation still happens before any job creation
- queue-backed controlled bulk flow exists in the current workspace
- sequential/batch safety limit remains present
- cancellation before queue start is available for queued rows
- no direct Graph bulk publish call is made from the UI
- no automatic retry of real publish is introduced
- no `fb_sim_*` value is ever treated as real Facebook success

## 7. Posts Integration Result
Preserved / improved in the current workspace:
- local bulk-created posts still use existing local save flow
- created posts can still be opened through View created posts
- Posts page integration remains active
- attempt timeline behavior remains preserved
- persisted Posts bulk review flow also exists now for already-created posts

## 8. Preserved Functionality Result
Confirmed preserved by code inspection and/or typecheck:
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

## 9. Safety / Security Result
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
- no automatic bulk publish introduced

## 10. Build / Runtime Result
Verified:
- `npx tsc --noEmit` PASS

Verified:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `npm run dev` PASS

Assessment:
- the historical Rollup optional dependency issue is no longer blocking the current workspace
- current build/runtime verification succeeds

## 11. Docs Updated
Updated:
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_15_CONTROLLED_BULK_PUBLISH_REPORT.md`

## 12. Known Limitations
- Real bulk publish must still only be exercised in a controlled way when explicitly allowed
- Manual end-to-end UI verification is still recommended after code changes
- Historical Phase 15 report should be read together with later bulk publish hardening/execution phases for the current full behavior

## 13. Revert Instructions
To revert Phase 15:
1. Revert:
   - `src/pages/BulkCreatePage.tsx`
   - `CURRENT_TASK.md`
   - `PROJECT_STATE.md`
   - `docs/RUNTIME_TEST_REPORT.md`
   - `docs/PHASE_15_CONTROLLED_BULK_PUBLISH_REPORT.md`
2. Keep:
   - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
   - canonical Facebook Page scopes
   - controlled real text/image publish implementation
   - queue/scheduler/runtime fixes from prior phases
3. Restore from:
   - `_backups/phase-15-controlled-bulk-publish-safety-20260613-1238`
4. Re-run after dependency repair:
   - `npx tsc --noEmit`
   - `npm run build`
   - `npm run dev`

## 14. Exact Manual Test For User
With the current workspace and app running:

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
6. Set:
- `FACEBOOK_REAL_PUBLISH_ENABLED=true`
7. Restart app
8. Open **Bulk Create** again
9. Prepare mixed rows:
- valid text-only row
- valid image row
- row missing target Page
- row with invalid image needing reattach
10. Click **Bulk Real Publish**
11. Verify confirmation surface appears before any execution
12. Verify summary shows:
- total selected posts
- Page distribution
- text-only count
- image count
- scheduled count
- immediate count
- invalid/ineligible count
13. Verify ineligible rows show clear reasons
14. Verify final confirm is disabled until:
- checkbox is checked
- `PUBLISH` is typed exactly
15. Confirm action only in a controlled test context
16. Verify:
- queue-backed progress panel appears
- only queued jobs not yet started can be cancelled
- no token/secret exposure appears
- no fake success appears
- `fb_sim_*` is never treated as real Facebook success

## 15. Recommended Next Task
Recommended next task:
- continue broader Phase 24 UX polish / regression verification across:
  - Accounts / Pages
  - Diagnostics
  - Settings
- preserve:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
  - no token/secret exposure
  - no fake success
  - no remote Facebook edit/delete
- keep the current controlled bulk publish safety semantics intact

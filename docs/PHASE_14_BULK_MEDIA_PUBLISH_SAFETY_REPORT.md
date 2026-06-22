# Phase 14 — Bulk Media Per Row + Bulk Publish Safety Gates Report

## Backup / Restore Point
- `_backups/phase-14-bulk-media-publish-safety-20260612-1943`

## Scope
This phase implemented:
- one-image-per-row support in Bulk Create
- CSV media-path support groundwork
- safe validation for imported image paths
- blocked bulk publish safety-gate UI

This phase did **not**:
- change OAuth
- narrow Facebook Page scopes
- enable automatic publishing
- enable bulk real publish execution
- expose tokens or secrets
- change queue/scheduler behavior

## Files Changed
- `src/pages/BulkCreatePage.tsx`
- `src/types/electron.d.ts`
- `src/lib/electronApi.ts`
- `electron/main.ts`
- `electron/preload.ts`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_14_BULK_MEDIA_PUBLISH_SAFETY_REPORT.md`

## Bulk Media Per-Row Result
Implemented:
- each Bulk Create row can attach exactly one image
- supported picker extensions:
  - jpg/jpeg
  - png
  - webp
- fixed-size thumbnail preview per row
- filename shown per row
- size shown per row
- MIME type shown per row
- remove image action
- replace image action
- layout remains bounded with fixed preview box
- save flow persists:
  - `mediaType='photo'`
  - `mediaLocalPath`

Text-only rows continue to work.

## CSV Media Path Result
Implemented:
- CSV import now recognizes:
  - `mediaPath`
  - `imagePath`

Behavior:
- imported image paths are validated safely through Electron IPC via `media:validateImagePath`
- supported imported extensions:
  - jpg/jpeg
  - png
  - webp
- if the path is valid:
  - row receives previewable local image metadata
- if the path is invalid or missing:
  - row is marked invalid
  - row requires reattach
  - safe user-facing message is used:
    - `Image file not found. Please reattach the image.`

Notes:
- no auto-save
- no auto-publish
- imported rows must still be reviewed before save
- no sensitive local paths were added to docs/log summaries in this report

## Bulk Publish Safety Gate Result
Implemented:
- dedicated Bulk Publish Safety Gate panel in Bulk Create
- visible blocked bulk real publish button
- explanatory safe message:
  - `Bulk real publishing is not enabled yet. Save as drafts or schedule instead.`

Displayed safety summary includes:
- total valid posts
- Page distribution count
- image count
- draft/immediate count

Not implemented intentionally in this phase:
- no real bulk publish execution
- no Facebook Graph bulk publish calls
- no automatic publish
- no multi-Page publish without explicit user action

Safer option was used:
- UI groundwork present
- real bulk publish still blocked

## Verification Result
Verified:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `npm run dev` active in existing terminal chain

Runtime chain observations preserved:
- queue starts
- scheduler starts
- runtime confirms `FACEBOOK_REAL_PUBLISH_ENABLED=false`

## Known Limitations
- bulk real publish confirmation modal is not implemented because bulk real publish remains intentionally blocked
- Phase 14 still needs manual UI confirmation for:
  - add image per row
  - replace/remove image per row
  - valid CSV image-path preview behavior
  - invalid CSV image-path reattach behavior
  - Posts detail preview for bulk-created image posts
- CSV parsing remains simple CSV-like parsing and does not introduce advanced quoted-field parsing improvements in this phase

## No Token Exposure / No Automatic Publish
Confirmed preserved:
- no access token exposure
- no page token exposure
- no encrypted token exposure
- no App Secret exposure
- no OAuth code exposure
- no callback/raw state exposure
- no automatic publish
- no bulk real publish unless explicitly implemented in a future phase

## Revert Instructions
To revert Phase 14:
1. Revert these files:
   - `src/pages/BulkCreatePage.tsx`
   - `src/types/electron.d.ts`
   - `src/lib/electronApi.ts`
   - `electron/main.ts`
   - `electron/preload.ts`
   - `CURRENT_TASK.md`
   - `PROJECT_STATE.md`
   - `docs/RUNTIME_TEST_REPORT.md`
   - `docs/PHASE_14_BULK_MEDIA_PUBLISH_SAFETY_REPORT.md`
2. Keep:
   - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
   - canonical Facebook Page scopes
   - controlled real text/image publish implementation
   - queue/scheduler/runtime fixes from prior phases
3. Re-run:
   - `npx tsc --noEmit`
   - `npm run build`
   - `npm run dev`
# Phase 11 Posts / Media / Bulk Report

## Scope
This Phase 11 report now includes the Phase 11.5 UX polish pass.

This pass improved only:
- Create Post publish button visibility and helper messaging
- Bulk Create per-row Page target override
- Bulk Create CSV-like paste import preview
- Bulk Create review summary before save

This pass did **not**:
- enable real Facebook publishing
- change Facebook Page scopes
- call Facebook Graph publish/edit/delete endpoints
- use backend publish scripts
- expose tokens, page tokens, secrets, OAuth codes, or raw callback URLs
- redesign the whole UI

## Restore Point
Filesystem restore point created at:
- `_backups/phase-11-5-bulk-create-polish-20260612-1329/`

## Create Post UX Result
`src/pages/CreatePostPage.tsx` now keeps `Post Now` visible and shows explicit disabled reasons.

Covered disabled states:
- no Page selected
- no content entered
- publishing mode loading
- publishing mode readiness error
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- image attached while real image publish remains unavailable

Result:
- the action area remains visible
- user understands why publish is unavailable
- no automatic publish behavior was introduced

## Bulk Create UX Result
`src/pages/BulkCreatePage.tsx` now supports:
- global default Page target
- per-row Page override
- per-row title
- per-row content
- per-row row status (`draft` / `scheduled`)
- per-row schedule date/time
- per-row validation error state

Validation now blocks:
- missing content
- missing target Page
- missing schedule date/time for scheduled rows
- invalid/past schedule time

Save remains local-only:
- creates local drafts/scheduled posts only
- persists `targetAccounts`
- persists `pageTargets`
- no publish
- no Graph API call
- no backend publish script

## CSV / Paste Import Result
Paste import supports CSV-like columns:
- `title`
- `content`
- `pageName`
- `pageId`
- `scheduleTime`
- `status`

Behavior:
- user pastes into a textarea
- rows are parsed into editable review rows
- target Page maps by `pageId` or exact `pageName`
- unmapped rows show validation errors
- nothing is saved automatically on paste

## Review Summary Result
Bulk Create now shows:
- total rows
- active rows
- valid rows
- invalid rows
- drafts count
- scheduled count
- Page distribution
- earliest/latest schedule time

Save button:
- disabled when blocking validation errors exist
- clear reason shown when blocked

## Posts Integration Result
Saved bulk rows use:
- `targetAccounts: [sourceAccountId]`
- `pageTargets: [...]`

This keeps Bulk Create aligned with the same local metadata model used by Create Post / Posts.

Safe result preserved:
- created rows appear as local drafts/scheduled posts
- Page metadata persists
- no fake attempt timeline entries
- no real publish occurs

## Verification Result
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `npm run dev` PASS

Observed during `npm run dev`:
- Vite dev server started
- Electron preload built
- Electron main built
- BrowserWindow created successfully
- queue started
- scheduler started
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- Facebook config valid
- no real publishing enablement introduced

## Safety / Security Result
Still preserved:
- SO9 UI remains applied
- Create Post remains intact
- Posts detail remains intact
- Accounts / Pages remain intact
- Diagnostics remains intact
- Scheduler / Queue remain intact
- Simulation mode remains intact
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- old post `#6` remains `needs_verification`
- no token exposure
- no page-token exposure
- no encrypted-token exposure
- no app-secret exposure
- no OAuth code exposure
- no raw callback URL exposure in docs
- no real publish attempted

## Remaining Known Issues
- Bulk Create currently supports CSV-like paste import only, not direct CSV file picker import
- Bulk row media attachment is still deferred
- Vite dev reload noise may appear while build/package output lands during a concurrent dev session

## Revert Instructions
Restore from:
- `_backups/phase-11-5-bulk-create-polish-20260612-1329/`

Restore at minimum:
- `src/pages/CreatePostPage.tsx`
- `src/pages/BulkCreatePage.tsx`
- docs updated in this pass
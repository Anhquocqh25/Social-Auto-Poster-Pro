# Phase 10 UI Refresh Report

## Scope
Phase 10 originally established and preserved the SO9-inspired UI shell. This document is now updated to record the later stabilization pass that preserved the Phase 10 shell while fixing three blocking regressions:

- restore required Facebook Page OAuth scopes in the actual OAuth request path
- sync `electron/preload.cjs` with the renderer post API contract
- fix Bulk Create so drafts persist a selected Facebook Page target

This update still did **not**:
- revert the SO9 UI
- redesign the UI from scratch
- enable real publishing
- call Facebook Graph publish/edit/delete endpoints
- use backend publish scripts
- expose tokens or secrets

## SO9 UI State
Confirmed preserved:
- fixed sidebar
- fixed top header
- SO9-style workspace layout
- shared background/card system
- existing shell/layout remains active

## Scope Fix Update
### Source file
Scopes are defined in:
- `src/services/facebook/FacebookConfigService.ts`

### Final scope list
- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

### Actual OAuth request proof
Actual OAuth request scope generation path:
- `loadFacebookEnvConfig().oauthConfig.scopes = [...FACEBOOK_PAGE_READY_SCOPES]`
- `src/services/oauth/OAuthService.ts` → `initializeProviders()`
- `src/services/oauth/FacebookOAuthProvider.ts` → `getAuthorizationUrl(...)`
- request param:
  - `scope: this.config.scopes.join(',')`

### Readiness consistency fix
`src/services/AccountConnectionService.ts` now also uses `FACEBOOK_PAGE_READY_SCOPES` for:
- `missingPermissions`
- `requiredPermissions`

## Runtime Preload Contract Update
### Root cause
The runtime preload bundle was stale/incomplete relative to the source preload contract.

### Fixed runtime methods in `electron/preload.cjs`
- `posts.getById`
- `posts.updateLocal`
- `posts.deleteLocal`
- `posts.cancelScheduled`
- `posts.duplicateAsDraft`
- `posts.retrySimulation`

### Verified aligned pieces
- `electron/main.ts`
- `electron/preload.ts`
- `electron/preload.cjs`
- `src/lib/electronApi.ts`
- `src/types/electron.d.ts`

## Bulk Create Update
### Previous issue
Bulk drafts were created with:
- `targetAccounts: []`

### Fix applied
`src/pages/BulkCreatePage.tsx` now:
- loads Facebook Page targets
- requires a global Page target before save
- blocks save without a target
- shows:
  - `Target Page is required for each bulk post. Please select a Facebook Page.`
- persists:
  - `targetAccounts`
  - `pageTargets`

### Safe behavior preserved
- local drafts only
- no real publish
- no Graph publish call
- no backend publish script

## Build / Runtime Result
Verified in this stabilization pass:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `npm run dev` PASS

Observed runtime preservation:
- Electron app starts
- BrowserWindow created successfully
- scheduler starts
- queue starts
- Accounts page available
- Create Post page available
- Posts page available
- Diagnostics page available
- real publishing remains disabled

## Preserved Safety Boundary
Still preserved:
- SO9 UI remains applied
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- simulation mode intact
- no real publish attempted
- no token exposure
- no secret exposure
- no backend publish scripts used
- no Facebook Graph publish/edit/delete endpoint called

## Remaining Limitations
- `FacebookService.ts` still has its own internal fallback scope list separate from the main OAuth request path
- Bulk Create currently supports one global Page target for all rows rather than per-row targeting
- `oauth.openExternalUrl` is not exposed in `electron/preload.cjs`; not part of this blocker pass

## Recommended Next Task
- unify internal fallback scope definitions in `FacebookService.ts`
- optionally add per-row Page targeting later without changing safe local-draft behavior
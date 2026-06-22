# Phase 6 Report — Real Facebook Integration Foundation + Page-Target UX + Safe Posts Workflow

**Date:** 2026-06-10  
**Status:** Phase 6.2B in progress / core code changes build-verified / final runtime click-through still pending

---

## Phase Goal
Build and verify the real Facebook integration foundation while keeping real publishing disabled, then correct product UX so Facebook Pages/channels are treated as publish targets and the Posts management page supports safe management workflows.

---

## What Was Verified

### 1. Manual OAuth UX
Verified:
- `Connect Facebook` opens the manual OAuth modal
- browser does not auto-open
- `Open` button opens the OAuth URL manually
- external browser callback page is helper-only
- callback URL is copied/pasted back into the Electron modal
- renderer parses `code` / `state` locally
- renderer sends parsed callback data to Electron main
- main process completes OAuth securely

### 2. Fresh Real OAuth Success
A fresh real Facebook OAuth run succeeded after the PKCE fix.

Verified in the Accounts UI / runtime:
- real Facebook account appears in Connected Platforms
- real account name is visible
- real Facebook account ID is present
- badges show:
  - `active`
  - `healthy`
  - `Real`
- token expiry is visible when available
- simulation Facebook accounts remain present
- real publishing remains disabled

### 3. PKCE Fix Result
Prior failure:
- `Error validating code verifier`

Verified root cause:
- the app declared `code_challenge_method=S256`
- but previously passed the raw verifier as `code_challenge`

Fix:
- `code_challenge` is now generated from the stored `codeVerifier` using SHA-256 base64url encoding

Fresh verification result:
- token exchange completed successfully
- no repeated token exchange loop occurred in the successful path

### 4. Duplicate Callback Hardening
Verified/retained:
- external browser callback no longer calls Electron IPC directly
- modal submit has duplicate guard
- callback page has Electron-context/single-run guard
- OAuth session cleanup is idempotent
- no Prisma delete record-not-found issue is expected in normal flow

---

## Facebook Page / Account Foundation Result

### Accounts vs Pages
The app now consistently treats:

- **Facebook account** = OAuth/token owner only
- **Facebook Page** = actual posting channel / target

Verified/implemented:
- selected/default Page persistence foundation exists
- per-account page readiness blocks exist in Accounts
- Accounts → Pages tab groundwork exists
- safe fallback exists when `facebook.pages` is missing but selected page metadata exists

### Granted Scope Write-Back
The storage bug root cause was identified:
- the app already fetched `/me/permissions`
- UI/account-health logic read `platformToken.scope`
- Facebook token exchange did not reliably populate token response scopes

Fix:
- granted permission names from `/me/permissions` are now written into `platformToken.scope`

This keeps scope reporting tied to actual granted permissions rather than requested scopes.

---

## Create Post Page Result (Phase 6.2A)

### Page-Based Target Selector
Create Post no longer conceptually asks the user to publish to a Facebook account.

Implemented:
- page target selector loads authorized Facebook Pages
- each Page option shows safe metadata only:
  - page name
  - category if available
  - masked Page ID
  - source account name
  - source account DB id
- selected/default Page is preselected when available
- user can change selected Page target(s)
- source account is shown only as metadata
- no page access token is exposed

### Compatibility Position
Current persistence remains operationally account-target-based for compatibility:
- `PostTarget.accountId` remains the active storage relation
- selected Page targets are resolved back to source account ids for current scheduling/queue compatibility
- optional page target metadata is passed through IPC for future-safe evolution
- no Prisma migration was introduced in this pass

### Real Publishing Safety
Create Post `Post Now` remains blocked for real Facebook with a safe notice.

---

## Posts Management Result (Phase 6.2B)

### Filters Added
The Posts page now includes:
- status filter
  - all
  - draft
  - scheduled
  - queued
  - posting
  - published
  - failed
  - cancelled
- platform filter
  - all
  - facebook
  - tiktok
  - simulation
- search filter
  - title
  - content
  - page/target name when available

### Page-First Target Display
Posts page now prefers Page/channel target display over account display.

Safe display priority:
1. page target / selected Page metadata
2. legacy account target fallback

Each post card can now show:
- title or content preview
- status
- scheduled time
- created time
- last error when present
- target Page/channel name when available
- masked Page ID when available
- page category when available
- source account metadata when available
- legacy account label when only account target is resolvable

### Safe `Đăng ngay` Action
Added a safe `Đăng ngay` action for post cards.

Current behavior:
- if target is invalid:
  - show safe invalid-target message
- if target is simulation:
  - show safe placeholder notice
  - do not fake publishing
- if target is real Facebook:
  - show safe disabled-publishing notice
  - do not call real Facebook publish endpoints

Real Facebook publishing remains disabled.

---

## Avatar Audit Result

### Account avatar
- fetched: yes
- stored: yes
- displayed in Create Post selector: no

Evidence:
- OAuth/user flow supports avatar URL
- `Account.avatarUrl` exists in schema
- account DTO exposes `avatarUrl`

### Page avatar
- fetched: yes
- stored: no/unknown in current safe persisted `facebook.pages` path
- displayed: no

Evidence:
- `FacebookPageSummary.pictureUrl` exists in provider types/fetch layer
- current persisted `facebook.pages` path does not preserve/display `pictureUrl`
- Create Post / Posts / Pages UI do not currently display Page avatars

Future follow-up if requested:
- **Phase 6.2C — Add Facebook Account/Page Avatar Fetch and Display**

---

## Encrypted Persistence Result
Verified safely without exposing secrets:
- real Facebook account row exists and is updated
- encrypted-looking token fields are non-empty when persisted
- raw access token is not shown in UI
- raw access token is not logged
- App Secret is not shown
- App Secret is not logged
- persistence still flows through the encrypted storage path

---

## Security Result
Still preserved:
- App Secret not shown in UI
- App Secret not logged
- App Secret not exposed to renderer
- access token not shown in UI
- access token not logged
- page access token not shown
- page access token not logged
- real Facebook publishing remains disabled

---

## Simulation Regression Result
No regression evidence introduced.

Trusted baseline remains intact:
- simulation accounts remain present
- simulation mode remains intact
- scheduler startup works
- queue startup works
- diagnostics runtime works
- notifications runtime works
- restart recovery baseline remains trusted

---

## Build / Runtime Result
- `npx tsc --noEmit` PASS
- `npm run build` renderer/main/preload PASS
- `npm run dev` launches Electron + Vite successfully
- packaging remains environment-dependent on this Windows machine

Observed non-blocking runtime caveats:
- Chromium/devtools-side `Failed to fetch` noise may still appear
- no evidence currently ties that noise to OAuth success/failure/page-target handling

---

## Current Honest Status
What is now verified in code + build:
- manual OAuth UX works
- fresh real Facebook OAuth account connection works
- token exchange works after the PKCE fix
- encrypted token persistence path works
- Create Post now targets Pages/channels instead of accounts
- Posts page now supports filters
- Posts page now prefers Page/channel target display
- safe `Đăng ngay` workflow exists
- simulation mode remains intact
- real Facebook publishing is still blocked

What is still not fully runtime-click-verified in this checkpoint:
- final Create Post selector click-through after latest changes
- final Posts page filters click-through against live data
- final Posts page `Đăng ngay` click-through safe notice
- latest surviving real account state still needs reconfirmation for:
  - non-empty `platformToken.scope`
  - full `facebook.pages` persistence rather than selected-page fallback only

---

## Conclusion
Phase 6 has delivered the **real Facebook integration foundation**, **manual OAuth UX**, **page-based target UX**, and **safe posts-management workflow foundations**.

It still does **not** verify real Facebook publishing and does **not** authorize publishing enablement.

The next safe direction after final runtime click-through verification is:

**Phase 7 — Controlled Real Facebook Publishing Preparation**

Phase 7 must begin with publish-readiness checks, not immediate publishing.
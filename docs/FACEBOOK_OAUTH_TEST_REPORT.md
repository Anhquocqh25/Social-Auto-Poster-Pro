# Facebook OAuth Test Report

**Current checkpoint alignment:** Phase 25 — Final Acceptance, Real Video Verification & Personal Release  
**Original verified OAuth run date:** 2026-06-10  
**Checkpoint update date:** 2026-06-21

---

## Objective
Preserve the truthful record that one fresh real Facebook OAuth account connection was already verified end-to-end through the manual OAuth modal flow, while keeping the current Phase 25 checkpoint aligned with:

- safe default real-publish disabled
- preserved page scopes
- preserved encrypted token handling
- no secret exposure
- no false claim that final release is fully complete yet

This checkpoint update does **not** claim a new OAuth run occurred today.  
It records how the previously verified OAuth result remains relevant to the current personal-release checkpoint.

---

## Preserved Verified OAuth Result

### 1. Manual OAuth UX
Previously verified:
- `Connect Facebook` opens the manual OAuth modal
- browser does not auto-open
- `Open` opens the OAuth URL manually
- external browser callback page is copy-helper-only
- callback URL is copied from the browser page and pasted back into the Electron modal
- renderer parses `code` / `state` locally
- renderer sends parsed callback data to Electron main
- main process completes OAuth

### 2. Fresh Real OAuth Success
Previously verified:
- a fresh real Facebook OAuth run succeeded after the PKCE fix

Verified in the UI at that time:
- a real Facebook account appears in the app
- account identity is shown
- account health/readiness indicators are present
- token expiry visibility exists
- no raw token is shown in the normal UI

### 3. PKCE Fix Result
Previously verified root cause:
- the app declared `code_challenge_method=S256`
- an earlier implementation had passed the raw verifier as `code_challenge`

Verified fix:
- `code_challenge` is generated from the stored `codeVerifier` using SHA-256 base64url encoding

Verified result:
- token exchange completed successfully
- no repeated token-exchange loop occurred in the successful path

### 4. Duplicate Callback Hardening
Previously verified / retained:
- external browser callback no longer calls Electron IPC directly
- modal submit has duplicate guard
- callback page has Electron-context/single-run guard
- OAuth session cleanup is idempotent
- no duplicate normal-flow delete issue is expected from the successful path

### 5. Encrypted Persistence Result
Previously verified safely without exposing secrets:
- real Facebook account persistence path works
- encrypted-looking token fields are non-empty
- raw access token is not shown in UI
- raw access token is not logged
- App Secret is not shown
- App Secret is not logged

---

## Phase 25 Relevance Of The Preserved OAuth Result

At the current Phase 25 checkpoint, the preserved OAuth evidence still matters because it confirms:

- real Facebook account connection had already been achieved
- the app is not limited to simulation-only identity handling
- encrypted token persistence path had already been verified
- current personal-release completion does **not** require redesigning OAuth
- current personal-release completion does **not** require narrowing the canonical Facebook scopes

Canonical Facebook scopes remain:

- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

This checkpoint preserves those scopes and does not redesign the OAuth flow.

---

## Current Security Result
Still preserved at the current checkpoint:
- App Secret not shown in UI
- App Secret not logged
- App Secret not exposed to renderer
- access token not shown in UI
- access token not logged
- tokens remain treated as sensitive local secrets
- real publishing remains disabled by default

Safe default still required:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

---

## Current Checkpoint Relationship To Connected Channels / Pages

The current workspace now also preserves the later Page-oriented flow expectations:

- Page-based Connected Channels model
- Page avatar surfacing
- readiness-oriented channel display
- explicit channel selection in Create Post / Bulk Create

This document does **not** newly re-verify those items itself.  
Those belong to the broader Phase 25 manual acceptance and release closure.

---

## Current Checkpoint Relationship To Real Publishing

This document does **not** claim that OAuth verification alone completes final release readiness.

What is still not complete at the current Phase 25 checkpoint:
- full manual UI acceptance
- exactly one new controlled real Facebook video publish
- truthful provider-reach evidence for that new controlled publish
- truthful post/job/attempt evidence for that new controlled publish
- immediate safe-mode restoration evidence after that new controlled publish
- final project PASS decision

So while OAuth is preserved as verified, final release is still incomplete.

---

## Build / Runtime Relevance At Current Checkpoint
Current checkpoint baseline additionally verifies:

- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `node scripts/snapshot-posts.mjs 28 27 26 25 24 23 22 21 15 14 6` PASS
- `FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev` PASS

This means the previously verified OAuth capability now sits inside a healthier, later-stage Phase 25 baseline.

---

## Honest Current Conclusion
The preserved real Facebook OAuth verification remains valid and relevant to the current project state.

What is truthfully preserved:
- manual OAuth UX had worked
- fresh real token exchange had worked after the PKCE fix
- encrypted token persistence had worked
- the app had already supported a real Facebook account connection path

What this checkpoint does **not** claim:
- a new OAuth run was performed today
- final personal release is complete
- controlled real Facebook video verification is already done
- final manual UI acceptance is already done

Current Phase 25 decision remains:

```text
FAIL — finish remaining blockers inside Phase 25
```

Reason:
- preserved OAuth verification is an important prerequisite already satisfied
- but the final committed phase still requires the controlled real-video verification and full manual final acceptance before PASS
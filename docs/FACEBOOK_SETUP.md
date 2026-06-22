# Facebook Setup Guide

**Phase:** 6.1 — Safe Local Facebook Credential Setup  
**Scope:** local credential preparation, config readiness, OAuth startup readiness  
**Not included yet:** real publishing

---

## Purpose
This phase prepares a **safe local credential workflow** for real Facebook OAuth testing without enabling real publishing.

What is in scope:
- local `.env.local` / `.env` setup
- Electron main-process env loading
- config validation
- Accounts page config readiness
- OAuth startup readiness
- simulation-mode safety preservation

What is intentionally **out of scope**:
- real Facebook publishing
- TikTok
- analytics
- AI content generation

---

## Local Credential Files

Use one of these local-only files:

- `.env.local`
- `.env`

Recommended:
- use `.env.local` for machine-specific development secrets

These files are ignored by git and must never be committed.

### Commit-safe template
A safe template now exists at:

- `.env.example`

Contents:
```env
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_REDIRECT_URI=
FACEBOOK_GRAPH_API_VERSION=v20.0
```

---

## How To Create `.env.local`

Create:

```env
FACEBOOK_APP_ID=your_real_app_id
FACEBOOK_APP_SECRET=your_real_app_secret
FACEBOOK_REDIRECT_URI=your_exact_redirect_uri
FACEBOOK_GRAPH_API_VERSION=v20.0
```

Required variables:
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_REDIRECT_URI`
- `FACEBOOK_GRAPH_API_VERSION`

### Critical safety rule
`FACEBOOK_APP_SECRET` must:
- never be committed
- never be shown in the renderer/UI
- never be logged
- remain local-only

---

## Runtime Loading Behavior

Electron main process now explicitly loads:
- `.env.local`
- `.env`

Expected startup logs when local env files are found:
```txt
[Env] Loaded local env files
```

Expected startup logs when local env files are missing:
```txt
[Env] No local .env file loaded
```

---

## Validation Rules

The app validates:

### Missing values
If required values are missing, real Facebook OAuth is blocked safely.

### Placeholder values
The app rejects obvious placeholder/sample/mock values.

### Redirect URI
`FACEBOOK_REDIRECT_URI` must:
- use HTTPS, or
- point to localhost when appropriate for local development

### Graph API version
`FACEBOOK_GRAPH_API_VERSION` must be valid.

Recommended current local default:
- `v20.0`

---

## Expected Facebook Config Logs

### When config is missing
Expected safe logs:
```txt
[FacebookConfig] Missing FACEBOOK_APP_ID
[FacebookConfig] Missing FACEBOOK_APP_SECRET
[FacebookConfig] Missing FACEBOOK_REDIRECT_URI
```

### When config is valid
Expected safe logs:
```txt
[FacebookConfig] Config validation passed
```

Notes:
- App Secret must not appear
- only masked App ID is allowed in success-path metadata logs

---

## Accounts UI Expectations

When config is missing or invalid, the Accounts page should show:
- `Facebook Config Missing`
- or `Facebook Config Invalid`

When config is valid, the Accounts page should show:
- `Facebook Config Ready`

When simulation mode is active, the Accounts page may also show:
- `Simulation Mode Active`

Other supported account states:
- `OAuth Not Connected`
- `OAuth Connected`
- `Token Expired`

---

## Live OAuth Readiness Checklist

Use this checklist before attempting real OAuth startup:

- [ ] `.env.local` exists
- [ ] `FACEBOOK_APP_ID` is real
- [ ] `FACEBOOK_APP_SECRET` is real
- [ ] `FACEBOOK_REDIRECT_URI` exactly matches Meta app settings
- [ ] `FACEBOOK_GRAPH_API_VERSION` is valid
- [ ] runtime logs `[Env] Loaded local env files`
- [ ] runtime logs `[FacebookConfig] Config validation passed`
- [ ] Accounts UI shows `Facebook Config Ready`
- [ ] Connect Facebook button is enabled
- [ ] App Secret is not visible anywhere

---

## What To Verify Once Credentials Exist

Only verify:
- config ready state
- Connect Facebook enabled
- OAuth URL generated
- browser opens
- state generated
- cancel flow does not crash

Do **not** proceed to publishing.

---

## Safe Boundary Guarantees

### Simulation mode
Simulation mode:
- still works without Facebook config
- must remain stable
- must not call the real Graph API

### Real mode
Real mode:
- requires valid local credentials
- requires valid config
- remains limited to OAuth/account/page-fetch verification only
- must not publish in this phase

---

## Honest Current Position

The app is now prepared for safe local Facebook credential setup.

Current machine/session result:
- explicit local env loading exists
- config observability exists
- credentials are still missing
- real OAuth startup is still blocked
- real publishing remains disabled

This is **not yet sufficient** for live callback/token/page-fetch verification until valid local credentials are actually provided.
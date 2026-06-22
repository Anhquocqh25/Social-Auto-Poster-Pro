# Facebook Permissions Reference

**Phase:** 6 — Real Facebook Integration Foundation

---

## Purpose
Document the Facebook permissions required for the current safe integration boundary.

This phase verifies:
- OAuth/account connection
- manageable page fetch
- selected page persistence
- token/account health

This phase does **not** enable real publishing yet.

---

## Required Permissions

### 1. `pages_show_list`
Required to:
- fetch manageable Facebook Pages
- verify that the connected account can see page targets
- support selected page storage

### 2. `pages_manage_posts`
Required for:
- future real publishing readiness checks
- validating that the app has the core publish-related permission before Phase 7/real publishing enablement

### 3. `pages_read_engagement`
Required to:
- support account/page health checks
- support engagement-related page access validation
- ensure the integration foundation matches the intended Facebook Page workflow

---

## Current Permission Handling

The app now:
- stores granted scopes from OAuth token results
- checks required permissions against granted permissions
- reports missing permissions on the Accounts page
- marks reconnect/attention required when permission coverage is incomplete

If permissions are missing:
- the account is treated as not fully ready
- the Accounts page shows missing permissions
- reconnect may be required
- real publishing remains blocked anyway in this phase

---

## Related Accounts Page Health States

Permission coverage contributes to these statuses:

- `OAuth Not Connected`
- `OAuth Connected`
- `Token Expired`
- reconnect required
- permissions review needed

Notes:
- an account may be connected but still need attention if required permissions are missing
- simulation mode does not require real Facebook permissions

---

## Selected Page Behavior

After OAuth, the app:
- fetches manageable pages
- stores the first available page as the current selected page foundation
- stores related page metadata in platform settings

Current stored page settings include:
- `facebook.selectedPage`
- `facebook.selectedPageName`
- `facebook.selectedPageCategory`

If permission gaps exist, the app may also store:
- `facebook.permissionsMissing`

---

## Safe Boundary Rules

### Simulation mode
Simulation mode:
- never requires Facebook permissions
- never calls the real Graph API
- remains usable without Facebook config

### Real mode
Real mode:
- requires valid env config
- requires successful OAuth
- requires manageable page access
- tracks missing permissions explicitly
- still does **not** publish in this phase

---

## Recommended Meta App Review Checklist

Before considering real publishing later, verify:
1. the Meta app is configured correctly
2. the redirect URI matches exactly
3. the connected user grants:
   - `pages_show_list`
   - `pages_manage_posts`
   - `pages_read_engagement`
4. manageable pages can be fetched successfully
5. the selected page is stored correctly
6. no token/account health errors remain

---

## Honest Current Position

These permissions are now part of the verified **foundation layer**.

They are sufficient for:
- page/account readiness checks
- account health reporting
- future publishing readiness evaluation

They are **not**, by themselves, proof that real publishing is safe to enable yet.
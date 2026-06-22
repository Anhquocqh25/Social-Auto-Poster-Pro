# Known Runtime Limitations

## 1. Interactive Route Verification Is Not Yet Fully Proven
### Observed
The app now launches in Electron dev mode, and the active dev server currently returns HTTP 200 for:
- `/`
- `/posts`
- `/create-post`
- `/calendar`
- `/accounts`
- `/diagnostics`
- `/settings`

Dashboard actions, sidebar platform links, notification UI, diagnostics enrichment, and account connection CTAs have been wired at the code level.

### Limitation
A full route-by-route visual click-through inside the live Electron window has still not been completely audited after the latest Phase 5 changes.

### Impact
Some remaining issues may still exist but are not yet fully proven or disproven interactively:
- blank sections
- subtle render mismatches
- incomplete button behavior on secondary actions
- page-specific layout regressions
- console/runtime UI errors during longer sessions

---

## 2. Account Connection Foundation Is Present, But Real Facebook Completion Is Not Fully Verified
### Observed
The Accounts page now includes:
- `Add Account`
- `Connect Facebook`
- simulation-mode guidance
- mock Facebook account creation
- reusable account cards
- reconnect/disconnect controls

The main/preload IPC bridge now exposes account connection actions, and the Connect Facebook path now routes through the existing OAuth service foundation when valid config exists.

### Limitation
The real Facebook callback completion path has not yet been fully exercised in-session from browser return through final account creation.

### Impact
The MVP account UX exists, but real Facebook connection is still only partially verified.

---

## 3. Facebook Real-Mode Credentials May Still Be Missing In The Environment
### Observed
The app now validates Facebook configuration explicitly and shows setup guidance for:
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_REDIRECT_URI`

Compatibility fallback still exists for:
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`

### Limitation
A fully valid real Facebook app configuration has not yet been confirmed in-session on this machine.

### Impact
Real-mode Facebook connection/publishing remains unavailable until the environment is configured correctly and verified interactively.

---

## 4. Simulation Uses Mock Facebook Connection / Publish Logic
### Observed
Simulation mode now supports:
- mock Facebook account creation
- simulation account labeling
- queue processing
- successful simulation publish completion
- retry-once seeded failures
- permanent failure seeding
- published / failed post state propagation in verified DB output
- Create Post targeting through active runtime accounts instead of a hardcoded account ID

### Limitation
Simulation still does not prove real Facebook platform delivery.

### Impact
Runtime flow can validate:
- scheduling
- queueing
- retries
- notifications
- attempts
- lifecycle progression
- failure handling

but not real platform-side publishing correctness.

---

## 5. Notification UX Is Improved But Not Fully Complete
### Observed
The topbar notification icon now opens a visible unread notification panel and supports mark-all-read.

Queue processing also emits persisted:
- success notifications
- retry notifications
- failure notifications

### Limitation
The notification UX is still limited:
- no dedicated full notification page/drawer
- no verified native Windows notification appearance
- no complete interactive audit of all notification states in-session

### Impact
Notification persistence and basic panel UX exist, but the notification system is not fully signed off yet.

---

## 6. Post Lifecycle Validation Improved, But Broader Consistency Still Needs Audit
### Observed
Recent runtime DB output proved:
- posts can now reach `published`
- retry scenarios can return to `published`
- forced failures can settle to `failed`
- jobs can reach `success` and `failed`
- attempts are recorded with corrected attempt numbering on new runs
- notifications are recorded

This is an improvement over the earlier `queued`-stuck state.

### Limitation
Not all lifecycle edge cases are yet fully verified:
- mixed success/failure across targets
- partial failure aggregation
- duplicate prevention across longer runtime windows
- clean restart recovery completion to `published`
- stale historical local DB artifacts from the earlier `attemptNumber: NaN` runtime failure

### Impact
The lifecycle is materially healthier than before, but still not fully proven under all runtime scenarios.

---

## 7. Diagnostics Are Richer But Still Need Final Visual Audit
### Observed
Diagnostics now expose and render:
- scheduler state
- queue counts
- active locks
- notification queue data
- uptime
- database health
- `lastRunAt`
- `lastSuccessfulPublishAt`
- `lastFailedPublishAt`
- `refreshedAt`
- `memoryUsage`

### Limitation
The enriched diagnostics page still needs final in-window route-by-route visual verification after the Phase 5 additions.

### Impact
The data path is present and richer, but final manual sign-off is still pending.

---

## 8. Settings Persistence Exists, But Restart Survival Still Needs Explicit Confirmation
### Observed
Settings persistence service and settings IPC/UI flow exist, including simulation mode support.

### Limitation
A full explicit restart-survival verification for Phase 5 settings is still pending.

### Impact
It is not yet fully proven in-session that all key settings survive:
- full Electron restart
- simulation mode toggle changes
- scheduler interval changes
- retry settings changes
- notification toggle changes

---

## 9. Restart Recovery Is Not Yet Fully Executed
### Observed
Recovery-oriented code exists:
- interrupted post recovery
- expired lock cleanup
- missed post detection
- interrupted active job cancellation before safe re-queue

### Limitation
A clean forced-stop / restart scenario still has not been fully signed off for Phase 5.

### Impact
Actual runtime behavior for:
- stale locks after crash
- resume after restart
- duplicate prevention after restart
- final recovered-post completion to `published`

is still not fully proven in one clean isolated run.

---

## 10. Electron Dev Startup Remains Slightly Fragile
### Observed
The app launches in dev mode, but earlier runs showed Vite could shift ports when `5173` was occupied.

### Limitation
The current `electron:dev` workflow may still be sensitive to Vite port behavior.

### Impact
Developer startup can still be less predictable than ideal in some local environments.

---

## 11. Packaging Limitation Remains Environment-Specific
### Observed
Application code bundles successfully.
`electron-builder` still fails during `winCodeSign` extraction due to Windows symlink privilege limitations.

### Impact
The application is runnable in dev/runtime form, but packaged installer output is not currently reproducible on this machine without environment changes.

### Workaround
- run packaging in elevated shell
- enable Windows Developer Mode / symlink privilege
- package in CI or alternate Windows environment

---

## Current Honest Runtime Readiness
The app is now:
- compile-clean
- bundle-clean for renderer/main/preload
- Electron-launching in dev mode
- scheduler-starting
- queue-starting
- able to create mock Facebook accounts for simulation mode
- able to use safer account connection UI foundations
- able to render richer diagnostics
- able to render a basic notification panel
- able to complete a successful simulation publish path to `published`
- able to complete a retry-then-success simulation path to `published`
- able to settle forced simulation failures to `failed`

But it is **not yet fully runtime-verified for final MVP sign-off** until:
- full interactive route QA is completed,
- real Facebook callback completion is verified,
- settings restart persistence is explicitly confirmed,
- notification behavior is fully exercised,
- restart recovery is re-verified cleanly to final `published`,
- partial-failure aggregation is proven in a clean isolated run,
- and final documentation sync is completed.

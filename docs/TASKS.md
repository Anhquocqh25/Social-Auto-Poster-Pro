# Phase 4 / Phase 5 Tasks - Auto Posting Engine, Reliability, and Runtime MVP

## Completed

### Workflow / Engineering Standards
- [x] Added `CLINE_RULES.md`
- [x] Added completion rule requiring relevant skill checklist usage before task completion
- [x] Added reusable skills under `.cline/skills`
- [x] Added `architect-review` skill
- [x] Added `electron-debug` skill
- [x] Added `scheduler-qa` skill
- [x] Added `prisma-database` skill
- [x] Added `security-audit` skill

### Build / Type Safety
- [x] Fixed existing TypeScript errors across renderer, Electron, and OAuth files
- [x] Fixed import/export mismatches
- [x] Fixed Electron/Vite alias resolution for `@/*`
- [x] Fixed TypeScript project config mismatch (`TS6305`)
- [x] Verified `npx tsc --noEmit` passes

### Database / Schema
- [x] Extended `Post` lifecycle statuses:
  - `draft`
  - `scheduled`
  - `queued`
  - `posting`
  - `published`
  - `partially_failed`
  - `failed`
  - `cancelled`
- [x] Added lock-related fields on posts
- [x] Added `PublishJob` model
- [x] Added `PublishAttempt` model
- [x] Added `SchedulerEvent` model
- [x] Added `Notification` model
- [x] Added `AppSetting` model
- [x] Regenerated Prisma client

### Reliability Services
- [x] `PublishJobService`
- [x] `QueueService`
- [x] `JobLockService`
- [x] `NotificationService`
- [x] `AppSettingsService`
- [x] Enhanced `ScheduleService`

### Scheduler / Recovery
- [x] Scheduler moved into Electron main-process startup flow
- [x] Queue processing started from scheduler startup
- [x] Duplicate queueing prevention
- [x] Startup recovery flow
- [x] Missed scheduled post detection
- [x] Interrupted post recovery (`queued` / `posting` -> `scheduled`)
- [x] Expired lock cleanup support
- [x] Scheduler event logging

### UI
- [x] Added Diagnostics page
- [x] Added Diagnostics route
- [x] Added Diagnostics sidebar navigation
- [x] Added queue status panel
- [x] Added recent jobs panel
- [x] Added failed attempts panel
- [x] Added publish attempt timeline
- [x] Enhanced Settings page with scheduler controls
- [x] Added simulation-mode toggle in settings

## Partially Completed

### Simulation / Posting
- [x] Local simulated Facebook publishing path exists in `QueueService`
- [ ] No real Facebook publish implementation yet
- [ ] No deterministic simulation control UI yet (success/failure toggle per run)

### Notifications
- [x] In-app notification persistence model/service exists
- [ ] Desktop notification bridge to Electron main process is still TODO

### Diagnostics Data
- [x] Diagnostics page exists
- [x] Diagnostics page uses live IPC-backed runtime data from Electron main process
- [x] Real scheduler, queue, lock, notification, uptime, and database metrics are displayed
- [x] Typed diagnostics IPC contract is exposed through preload
- [x] Manual refresh and scheduler check actions update live diagnostics safely

## Deferred / Not Implemented in Phase 4
- [ ] TikTok posting implementation
- [ ] Analytics features
- [ ] AI content features

## Remaining Before Declaring Phase 4 Fully Complete
- [ ] Final smoke-test app launch verification
- [ ] Scheduler simulation test verification
- [x] Documentation sync across diagnostics runtime integration reports
- [ ] Optional packaging fix for Windows `electron-builder` symlink privilege issue

## Phase 5 - Runtime Stabilization + Account Connection Foundation

### In Progress
- [~] Interactive runtime QA pass is underway
- [~] Account connection MVP foundation is in progress
- [~] Diagnostics enrichment is in progress
- [~] Notification UX hardening is in progress
- [~] Post lifecycle simulation stabilization is in progress

### Phase 5 Progress Completed So Far
- [x] Dashboard action buttons are wired
- [x] Renderer-side Electron API safety wrapper exists
- [x] Accounts page now has visible `Add Account` and `Connect Facebook` CTAs
- [x] Accounts page now exposes simulation-mode mock Facebook account creation
- [x] Accounts page now renders reusable account cards with status/token-health/simulation badges
- [x] Main-process IPC now exposes account connection actions
- [x] Preload bridge now exposes account connection APIs
- [x] Connect Facebook now uses the existing OAuth service foundation when config is present
- [x] Account refresh action now distinguishes simulation accounts from real accounts
- [x] Facebook OAuth callback completion contract is defined and exposed through IPC/preload
- [x] Facebook setup guidance document exists (`docs/FACEBOOK_SETUP.md`)
- [x] Create Post now uses active runtime accounts instead of a hardcoded account ID
- [x] Diagnostics contract now includes:
  - `lastRunAt`
  - `lastSuccessfulPublishAt`
  - `lastFailedPublishAt`
  - `refreshedAt`
  - `memoryUsage`
- [x] Diagnostics page now renders the added runtime metrics
- [x] Simulation publish validation no longer requires real Facebook token validation
- [x] Queue lifecycle now promotes successful simulation posts to `published`
- [x] Queue processing now emits persisted success / retry / failure notifications
- [x] Topbar notification button now opens a visible unread notification panel
- [x] Sidebar connected-platform items now navigate instead of behaving like inert buttons
- [x] Dashboard now uses real runtime-backed counts instead of static zero cards
- [x] TypeScript typecheck still passes after Phase 5 changes
- [x] Renderer/main/preload builds still pass after Phase 5 changes
- [x] `npm run dev` and `npm run electron:dev` both start successfully in the current environment
- [x] Active dev-server route checks return HTTP 200 for all core routes

## Known Build Status
- [x] TypeScript typecheck passes
- [x] Renderer build passes
- [x] Electron bundle build passes
- [ ] Electron packaging via `electron-builder` fails on Windows due to symlink privilege issue in `winCodeSign`

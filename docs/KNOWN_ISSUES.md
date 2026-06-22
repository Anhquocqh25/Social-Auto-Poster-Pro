# Known Issues - Phase 4

## 1. Windows Packaging Fails in `electron-builder`
### Symptom
`npm run build` completes:
- TypeScript compile
- renderer Vite build
- Electron main bundle
- Electron preload bundle

but fails during `electron-builder` packaging on Windows.

### Error
`winCodeSign` extraction fails because 7-Zip cannot create symbolic links:

- `libcrypto.dylib`
- `libssl.dylib`

### Root Cause
The current Windows environment does not have the privilege required for symlink creation during `winCodeSign` extraction.

### Impact
- Application code is buildable
- Electron bundles are generated
- Final packaged installer is not produced on this machine without elevated privileges / compatible environment

### Suggested Resolution
- run packaging in elevated shell,
- enable Developer Mode / symlink privilege,
- or package on CI / another environment with required permissions.

---

## 2. Diagnostics Page Uses Static Data
### Symptom
Diagnostics UI currently shows representative mock values for:
- scheduler state
- queue stats
- recent jobs
- failed attempts
- account health

### Impact
UI is complete structurally, but not yet connected to live runtime data through IPC/service calls.

### Suggested Resolution
Add IPC bridge from renderer to Electron/main-backed scheduler + persistence services.

---

## 3. Settings UI Is Not Fully Persisted
### Symptom
Scheduler controls exist in the Settings page, but save actions are not yet fully wired into `AppSettingsService` persistence from the renderer.

### Impact
Phase 4 settings UX exists visually, but runtime persistence is incomplete.

### Suggested Resolution
Expose safe IPC methods for:
- get scheduler settings
- update scheduler settings
- reload scheduler behavior after save

---

## 4. Facebook Publishing Is Simulated
### Symptom
Queue processing currently uses simulated Facebook publish behavior.

### Impact
Local queue/retry/status flow can be exercised, but no real Facebook post is published.

### Suggested Resolution
Integrate real Facebook Graph API publishing in a later phase while keeping simulation mode available for demos/tests.

---

## 5. Desktop Notifications Are Not Fully Bridged
### Symptom
`NotificationService` persists notifications in the database, but desktop notification dispatch to the Electron shell is still TODO.

### Impact
In-app notification architecture exists, but native desktop notification behavior is incomplete.

### Suggested Resolution
Add Electron main-process notification bridge via IPC or direct main-process hooks.

---

## 6. TikTok Publishing Intentionally Not Implemented
### Symptom
TikTok publishing remains unavailable.

### Reason
Explicitly deferred by Phase 4 requirements.

### Impact
No TikTok publish execution should be expected in this phase.

---

## 7. Final Runtime Smoke Evidence Still Needed
### Symptom
Code/build status is strong, but explicit documented runtime smoke evidence for:
- launch
- scheduler tick
- queued job recovery
- simulation flow

still needs final capture.

### Suggested Resolution
Run `npm run electron:dev` and record:
- app launch success,
- diagnostics route visibility,
- scheduler startup logs,
- simulated queue behavior.
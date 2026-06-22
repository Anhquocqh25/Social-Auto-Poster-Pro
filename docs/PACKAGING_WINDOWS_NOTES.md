# Packaging Windows Notes

**Platform:** Windows 11  
**Build Tool:** `electron-builder`

## Current Status
Application code packaging is still blocked on this machine.

What currently works:
- TypeScript compile
- renderer build
- Electron main build
- preload build

What currently fails:
- `electron-builder` Windows packaging step

---

## Current Packaging Issue
Observed during:
```bash
npm run build
```

Failure:
- `electron-builder` attempts to extract `winCodeSign`
- extraction fails because symbolic links cannot be created

Typical error:
- `ERROR: Cannot create symbolic link : A required privilege is not held by the client.`

This occurs while unpacking cached code-signing helper binaries into:
- `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\...`

---

## Root Cause
This is an environment / privilege issue, not an app-code bundling failure.

Specifically:
- Windows symlink creation requires either:
  - elevated privileges
  - Windows Developer Mode
  - explicit symlink privilege
- `electron-builder` downloads helper archives that contain symlinks
- extraction fails before packaging can complete on this machine

---

## Workarounds

### Option 1: Run packaging from an elevated shell
Open:
- PowerShell as Administrator
- or Command Prompt as Administrator

Then run:
```bash
npm run build
```

---

### Option 2: Enable Windows Developer Mode
On Windows 11:
1. open **Settings**
2. go to **System**
3. go to **For Developers**
4. enable **Developer Mode**
5. restart the shell / terminal session
6. run packaging again

Why this helps:
- Developer Mode allows symlink creation in more local development scenarios without requiring full admin elevation every time

---

### Option 3: Use a CI / alternate Windows environment
If local packaging remains blocked:
- package in CI
- package on another Windows machine with Developer Mode enabled
- package in a controlled build environment with the required privileges

This is often the cleanest approach for repeatable release packaging.

---

## Portable Build Note
No dedicated portable Windows build workflow is currently configured in `package.json`.

Current target:
- `nsis`

If a portable build is desired later, it should be treated as a separate packaging configuration task rather than a blocker for the current MVP simulation/demo readiness work.

---

## What This Does Not Mean
This packaging failure does **not** mean:
- the app fails to compile
- the renderer is broken
- Electron main/preload code is broken
- simulation MVP is unusable

It only means:
- installer / packaged output is not currently reproducible on this machine without environment changes

---

## Recommended Current Position
For Phase 5.9 and the next handoff:
- treat packaging as an environment-specific blocker
- continue local runtime demo work using:
  - `npm run dev`
- document the issue clearly
- avoid spending disproportionate effort on packaging until privileges/environment are fixed

---

## Quick Reference

### Build verification that still passes
```bash
npx tsc --noEmit
npm run build
```

Interpretation of `npm run build`:
- renderer/main/preload build = PASS
- packaging step = blocked by Windows symlink privilege issue

### Runtime demo path
```bash
npm run demo:simulation
npm run dev
```

---

## Honest Conclusion
The project is ready for local runtime demo and Phase 6 preparation even though packaged Windows installer output is still blocked on this machine.

Packaging is currently a **Windows privilege configuration issue**, not a core application readiness issue.
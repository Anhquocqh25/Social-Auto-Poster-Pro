# electron-debug

## Purpose
Debug Electron main/preload/renderer issues. Check IPC bridge, preload exposure, ESM/CJS issues, Vite bundling, blank screen, webview/runtime errors.

## When to Use
Use this skill when:
- the Electron window is blank or crashes
- preload APIs are missing in the renderer
- IPC calls fail, hang, or throw
- main/preload bundles build but runtime behavior is broken
- ESM/CJS import resolution behaves differently between dev and build
- Vite dev mode and packaged mode behave differently
- renderer console or main-process logs show runtime bridge issues

## Checklist
- [ ] Confirm main process starts successfully
- [ ] Confirm preload script is bundled and loaded
- [ ] Confirm `contextIsolation` and `nodeIntegration` settings are intentional
- [ ] Verify preload exposes only expected APIs
- [ ] Verify renderer calls match exposed preload API names
- [ ] Verify IPC channel names match on both sides
- [ ] Verify IPC handlers return serializable values
- [ ] Check for ESM/CJS import or path resolution mismatches
- [ ] Check renderer for blank-screen exceptions
- [ ] Check main process for startup/runtime exceptions
- [ ] Check build output for preload/main bundling success
- [ ] Summarize whether issue is in main, preload, renderer, or bundling

## Commands to Run
```bash
npx tsc --noEmit
npm run build
npm run electron:dev
```

Optional checks:
```bash
npm run
```

## Common Failure Cases
- preload path incorrect in `BrowserWindow`
- API exposed in preload but missing from typings
- IPC channel typo between renderer and main
- non-serializable objects returned through IPC
- ESM import path breaks in Electron bundle
- renderer assumes `window.electronAPI` exists before preload is loaded
- Vite alias works in renderer but not Electron bundle
- runtime errors hidden behind blank screen without visible logging

## Expected Output / Report Format
```md
## Electron Debug Report
### Scope
- main / preload / renderer / build pipeline

### Checks
- startup status
- preload exposure status
- IPC bridge status
- bundling status
- renderer runtime status

### Failure Point
- exact layer where issue occurs

### Fix / Recommendation
- concrete change or next debug step
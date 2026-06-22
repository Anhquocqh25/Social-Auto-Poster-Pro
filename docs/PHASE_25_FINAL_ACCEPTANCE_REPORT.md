# Phase 25 — Final Acceptance Report

## Phase
**Phase 25 — Final Acceptance, Real Video Verification & Personal Release**

## Current Result
**Status: IN PROGRESS / NOT YET PASS**

This report records the truthful state of Phase 25 at the current checkpoint.

Phase 25 is the **final committed phase**, but it is **not closed yet** because the following mandatory items are still pending:

- full manual interactive UI acceptance across all required screens and window states
- confirmation-modal dry-run evidence on the Create Post video path without final submission
- external Facebook Page verification for the selected historical real-provider evidence
- packaged AppImage interactive smoke verification
- final acceptance matrix with full manual evidence
- final release closure updates across all required docs

No Phase 25.1, Phase 26, cleanup-only phase, or documentation-only phase is introduced here.

---

## 1. Safe Default Preserved

Confirmed preserved:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Also preserved:
- no fake success
- `fb_sim_*` never counts as real Facebook success
- no remote Facebook edit/delete
- no raw token or secret exposure introduced in this pass
- no tokenized Graph/upload/avatar URL exposure introduced in this pass
- no fake Story execution
- no claim of native/dedicated Reels API support
- no automatic retry for real video publish

Historical safety baselines still preserved:
- post `#6` effective `needs_verification`
- post `#26` effective `needs_verification`
- posts `#27` and `#28` blocked-safe history

Canonical Facebook scopes remain unchanged:
- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

---

## 2. Backup / Restore Point

Primary restore point currently available:

```text
_backups/phase-25-final-acceptance-personal-release-20260621-1740/
```

This is the current Phase 25 restore reference.

---

## 3. Baseline Verification Executed

Commands executed:

```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 29 28 27 26 25 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 180s npm run dev
```

### Result
- TypeScript: **PASS**
- build + Linux packaging: **PASS**
- snapshot: **PASS**
- runtime assertions: **PASS**

### Observed baseline evidence
- app starts
- queue starts
- scheduler starts
- effective flag source remains `.env.local`
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- `activeJobs=[]` across the validated snapshot set
- no duplicate active jobs in the validated snapshot set
- no fake success occurred
- no unexpected posts/jobs were created by blocked probes
- runtime output remained compact and sanitized
- publish-flag logging now uses masked status only

---

## 4. Phase 25 Code / Safety Fixes Completed

### Files changed
- `run-app.sh`
- `electron/main.ts`
- `src/services/AppSettingsService.ts`
- `src/services/facebook/FacebookConfigService.ts`
- `package.json`
- `vite.config.ts`
- `tsconfig.json`

### Blockers fixed
1. **Security cleanup**
   - removed raw `FACEBOOK_REAL_PUBLISH_ENABLED` value logging from runtime paths
   - replaced it with masked presence/status logging only
   - preserved `.env.local` verification without printing secret values

2. **Safe startup script**
   - `run-app.sh` now validates `FACEBOOK_REAL_PUBLISH_ENABLED=false` without echoing the raw env value
   - script still preserves safe startup flow, Prisma generation, and local DB initialization

3. **TypeScript validation blocker**
   - added a compatible `ignoreDeprecations` setting so `npx tsc --noEmit` passes in the installed toolchain

### Fixed outcome
- runtime output no longer prints the raw real-publish flag value
- safe-mode validation remains enforced
- TypeScript baseline now passes
- build and packaging continue to pass

These fixes preserved the existing safety boundaries and did not introduce any new publish behavior.

---

## 5. Snapshot / Historical Safety Evidence Preserved

Verified snapshot preserved:

### Post `#29`
- `status=needs_verification`
- `effectiveStatus=needs_verification`
- `needsVerification=true`
- `jobCount=1`
- `activeJobCount=0`

Preserved reason:
- `Facebook accepted the video upload but final publish confirmation was not returned.`

### Post `#28`
- `status=blocked`
- `effectiveStatus=blocked`

### Post `#27`
- `status=blocked`
- `effectiveStatus=blocked`

### Post `#26`
- `status=failed`
- `effectiveStatus=needs_verification`
- `needsVerification=true`

Preserved reason:
- `Facebook accepted the video upload but final publish confirmation was not returned.`

### Post `#25`
- `status=scheduled`
- `effectiveStatus=scheduled`

### Post `#24`
- `status=failed`
- `effectiveStatus=failed`

### Post `#6`
- `status=published`
- `effectiveStatus=needs_verification`
- `needsVerification=true`

Preserved reason:
- `Local snapshot indicates fb_sim_* evidence on a real Facebook target.`

---

## 6. Packaging Verification

### Build command
```bash
npm run build
```

### Result
**PASS**

### Verified Linux artifacts from this build run
- `release/Social Auto Poster Pro-0.1.0.AppImage`
- `release/social-auto-poster-pro_0.1.0_amd64.snap`
- `release/linux-unpacked/social-auto-poster-pro`

### Verified artifact metadata
- `release/Social Auto Poster Pro-0.1.0.AppImage`
  - size: `121619479` bytes
  - timestamp: `2026-06-22T14:26:36.635377+07:00`
  - sha256: `db0ba9f508a25d426877a0fc83eb343381703a4488a45907085fd9603de9edd1`
- `release/social-auto-poster-pro_0.1.0_amd64.snap`
  - size: `102989824` bytes
  - timestamp: `2026-06-22T14:26:38.806773+07:00`
  - sha256: `47448dd26cd18f14775baae73a6ef5d4167442b01a7df8f69cbf311e345a524c`
- `release/linux-unpacked/social-auto-poster-pro`
  - size: `177181272` bytes
  - timestamp: `2026-06-22T14:26:30.086482+07:00`
  - sha256: `6d246635d67cbdd2c7ae99c9eb2a3ed58cd4ada7128c12e035c508ca447a9f05`

### Packaging conclusion
Linux packaging is producing newly rebuilt artifacts for personal use from the tracked configuration in this checkpoint.

### Additional packaging/runtime recovery verified in this checkpoint
Confirmed during this recovery pass:

- preload now builds to real CommonJS at `dist-electron/preload.cjs`
- Linux targets remain truthfully configured in tracked `package.json`:
  - `AppImage`
  - `snap`
- packaged Prisma runtime now uses a real filesystem path:
  - `resources/prisma`
- `package.json` now includes:
  - `extraResources` copy for `prisma/`
  - preserved Prisma client resources
- packaged startup no longer fails with the previous:
  - `main.AppSetting does not exist`
  - `main.Account does not exist`
  blockers caused by opening an empty schema-less DB

### Latest packaged AppImage startup evidence
Using extracted AppImage fallback launch:

```text
[env] production prisma cwd=/home/anh-quoc/projects/social-auto-poster-pro/squashfs-root/resources/prisma
[env] cwd=/home/anh-quoc/projects/social-auto-poster-pro/squashfs-root/resources/prisma
[main] Creating BrowserWindow ... "isDev": false
[Env] No local .env file loaded
[FacebookConfig] Missing FACEBOOK_APP_ID
[FacebookConfig] Missing FACEBOOK_APP_SECRET
[FacebookConfig] Missing FACEBOOK_REDIRECT_URI
[main] Runtime startup context { simulationMode: true, facebookConfigured: false, facebookConfigValid: false, realPublishingEnabled: false }
[renderer] [preload] electronAPI exposed [object Object]
[QueueService] Started queue processing
[ScheduleService] Schedule service started
```

### Security interpretation of packaged startup
This packaged launch evidence is acceptable from a security perspective because:
- no `.env.local` contents were printed
- no secret values were printed
- no bundled secret values were surfaced
- packaged app started in safe simulation mode
- real publishing remained disabled

### Remaining packaging gap
A fully documented packaged-app interactive launch verification was not completed in this checkpoint, so packaged-launch acceptance is not yet closed as final PASS.

---

## 7. Fresh-PC Migration Readiness

Current repo state already includes the core tracked project structure needed for migration:
- source code
- `package.json`
- `package-lock.json`
- Prisma schema
- build configuration
- scripts
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs`
- `.env.example`
- `.gitignore`

Current ignore protections already cover:
- `.env`
- `.env.local`
- `*.local`
- SQLite DB files under `prisma/*.db`
- `node_modules`
- `release`
- local logs

A fresh-PC user guide has now been added:
- `docs/USER_GUIDE_PERSONAL.md`

Remaining migration-doc closure is still tied to final Phase 25 release closure and final PASS/FAIL decision.

---

## 8. Manual UI Acceptance State

### Truthful status
**Still not completed in this checkpoint**

The task requires actual interaction evidence for:
- sidebar/shell
- Dashboard
- Connected Channels
- Create Post
- Posts / Post Detail
- Bulk Create
- Accounts
- Diagnostics
- Settings
- VI/EN switching

This report does **not** mark those screens PASS based only on source inspection.

What is available now:
- assertion-backed baseline/runtime evidence
- route/runtime visibility evidence
- blocked-safe behavior evidence
- corrected Posts overview surface

What is still required:
- human interactive verification evidence for each required screen and behavior listed in the task

---

## 9. Controlled Real Facebook Video Publish State

### Truthful status
**No new real upload executed in this checkpoint**

This checkpoint intentionally preserved and reused the existing real-provider evidence instead of uploading another real video.

Existing provider evidence retained for the remaining manual verification path:
- post `#29`
- job `#22`
- attempt `#25`
- effective state: `needs_verification`

Therefore this report does **not** claim:
- a newly uploaded real video in this checkpoint
- confirmation-modal dry-run completion
- external Facebook Page verification completion
- final published confirmation on Facebook
- post-test safe-mode restoration evidence from a new real publish cycle

The historical real-provider evidence remains preserved, but the remaining manual confirmation-modal, external verification, and packaged-app checks are still required before Phase 25 can be closed as PASS.

---

## 10. User Guide

Created:
- `docs/USER_GUIDE_PERSONAL.md`

Guide language:
- primary Vietnamese

Guide covers:
1. installing/running the app
2. connecting a Facebook account
3. managing Connected Channels
4. account avatar vs Page avatar
5. creating a text post
6. creating a multi-image post
7. creating a video post
8. why Facebook may display video as Reels
9. preparing a Story
10. current Story limitation
11. scheduling posts
12. Bulk Create with text/images/video
13. understanding statuses
14. `needs_verification`
15. safe mode
16. enabling controlled real publish
17. restoring safe mode
18. database backup
19. moving to another PC
20. troubleshooting

---

## 11. Current Phase 25 Checklist Status

### Completed in this checkpoint
- restore point identified
- baseline verification passed with safe mode false
- security cleanup applied for publish-flag logging
- packaging artifacts confirmed from the current build run with timestamp and checksum evidence
- roadmap files updated truthfully
- Vietnamese personal user guide created
- historical real-provider evidence for post `#29` preserved
- snapshot confirms no duplicate active jobs in the validated set

### Still required before final PASS
- full interactive UI acceptance
- Create Post confirmation-modal dry-run evidence
- external Facebook Page verification for the preserved real-provider evidence
- packaged AppImage smoke verification
- final release notes completion
- final acceptance matrix with full evidence
- final documentation closure across all required files

---

## 12. Current Decision

**Phase 25 remains open.**

Truthful decision at this checkpoint:

```text
FAIL — finish remaining blockers inside Phase 25
```

Reason:
- the project is closer to final release and the baseline/runtime/build/package state is now materially stronger
- but the mandatory manual UI acceptance, confirmation-modal dry-run, external Facebook verification, and packaged AppImage smoke test are still not complete, so a final PASS would be false

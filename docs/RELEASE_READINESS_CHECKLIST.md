# Release Readiness Checklist

**Phase:** 25 — Final Acceptance, Real Video Verification & Personal Release

## Purpose
Track whether the project is truly ready for:

- personal daily use
- one controlled real Facebook video verification
- safe restored-default operation after that controlled verification
- final project closure without inventing another phase

---

## 1. Code / Runtime Health
- [x] TypeScript compile passes
- [x] Renderer build passes
- [x] Electron main build passes
- [x] Electron preload build passes
- [x] App launches in dev runtime
- [x] Scheduler starts
- [x] Queue starts
- [x] Safe default remains `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- [x] Final Posts overview runtime assertion blocker fixed
- [x] Baseline runtime assertions pass again

Current evidence:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev` PASS
- runtime source remains `.env.local`
- no unexpected posts/jobs created by blocked probes
- no fake success observed

---

## 2. Historical Safety Baselines
- [x] post `#6` remains effectively `needs_verification`
- [x] post `#26` remains effectively `needs_verification`
- [x] posts `#27` and `#28` remain blocked-safe history
- [x] `fb_sim_*` is still treated as non-real evidence only
- [x] no automatic retry for real video publish has been introduced
- [x] no remote Facebook edit/delete has been introduced
- [x] no fake Story execution has been introduced
- [x] no native/dedicated Reels API support is claimed

---

## 3. Snapshot / Database Baseline
- [x] snapshot verification passes
- [x] current DB counts captured before any new controlled publish
- [x] current max post/job/attempt IDs captured
- [x] no current `pending` / `processing` duplicate active jobs

Current baseline:
- `postCount=28`
- `jobCount=21`
- `attemptCount=24`
- max post `#28`
- max job `#21`
- max attempt `#24`
- active jobs `[]`

---

## 4. UI / UX Acceptance
### Assertion-backed checkpoint evidence
- [x] Connected Channels blocked-safe route evidence exists
- [x] Create Post blocked-safe route evidence exists
- [x] Bulk Create blocked-safe route evidence exists
- [x] Posts overview runtime probe now passes
- [x] Diagnostics blocked-safe evidence exists
- [x] Settings blocked-safe evidence exists

### Still required before final PASS
- [ ] Sidebar / responsive shell manually verified
- [ ] Dashboard manually verified
- [ ] Connected Channels manually verified
- [ ] Page avatar behavior manually verified
- [ ] Create Post manually verified
- [ ] Posts manually verified
- [ ] Post Detail manually verified
- [ ] Bulk Create manually verified
- [ ] Accounts manually verified
- [ ] Diagnostics manually verified
- [ ] Settings manually verified
- [ ] VI/EN switching manually verified

Rule:
- no screen is marked PASS only from source inspection

---

## 5. Unified Composer / Bulk / Story Truthfulness
- [x] unified Create Post media flow remains in place
- [x] explicit channel-selection requirement remains in place
- [x] multiple-image local workflow remains supported
- [x] single-video local workflow remains supported
- [x] image/video mutual exclusion remains in place
- [x] Story remains truthfully non-real-publish-supported
- [x] bulk local media truthfulness remains preserved
- [x] real bulk video publish remains disabled unless separately verified

Still required before final PASS:
- [ ] final manual unified-composer acceptance recorded
- [ ] final manual bulk acceptance recorded
- [ ] final manual Story-blocking acceptance recorded

---

## 6. Controlled Real Facebook Video Verification
Mandatory final-phase requirement:

- [ ] exactly one controlled real Facebook video publish prepared
- [ ] database backup copied before the new controlled publish
- [ ] candidate Page / media / caption explicitly recorded
- [ ] effective real-publish flag source identified
- [ ] flag temporarily enabled through the actual effective source
- [ ] runtime/UI proof of effective enablement recorded
- [ ] Create Post normal Facebook Page video flow used
- [ ] confirmation modal evidence recorded
- [ ] provider reach evidence recorded
- [ ] post/job/attempt evidence recorded
- [ ] final state classified truthfully as:
  - `published`
  - `failed`
  - or `needs_verification`
- [ ] safe external Facebook verification recorded where possible
- [ ] immediate safe-mode restoration recorded
- [ ] restart proof of blocked-safe state recorded

Current truthful status:
- this section is still incomplete
- no new Phase 25 controlled real video publish has been executed yet

---

## 7. Packaging / Distribution
- [x] Linux packaging command succeeds
- [x] Linux unpacked artifact exists
- [x] Linux AppImage exists
- [x] Linux snap artifact exists
- [x] artifact sizes recorded

Current verified artifacts:
- `release/linux-unpacked/`
- `release/social-auto-poster-pro_0.1.0_amd64.snap`
- `release/Social Auto Poster Pro-0.1.0.AppImage`

Recorded sizes:
- AppImage `113890098` bytes
- snap `96493568` bytes
- unpacked binary `177181272` bytes

Still required before final PASS:
- [ ] packaged-app interactive launch verification recorded as final evidence

---

## 8. Fresh-PC Migration Readiness
- [x] source code remains tracked
- [x] `package.json` remains tracked
- [x] `package-lock.json` remains tracked
- [x] Prisma schema remains tracked
- [x] build configuration remains tracked
- [x] scripts remain tracked
- [x] `CURRENT_TASK.md` remains tracked
- [x] `PROJECT_STATE.md` remains tracked
- [x] `docs` remains tracked
- [x] `.env.example` remains tracked
- [x] `.gitignore` remains tracked
- [x] personal migration/setup guide created

Current guide:
- `docs/USER_GUIDE_PERSONAL.md`

Still recommended:
- explicitly keep local credentials only in `.env.local`
- keep real publish disabled on fresh machines by default

---

## 9. Security / Secret Handling
- [x] `.env` ignored
- [x] `.env.local` ignored
- [x] local SQLite DB ignored
- [x] `node_modules` ignored
- [x] `release` ignored
- [x] local logs ignored
- [x] no raw token exposure introduced in this checkpoint
- [x] no tokenized Graph/upload/avatar URL exposure introduced in this checkpoint

Still to tighten/document:
- [ ] explicit backup/private-media ignore policy may be expanded further if those paths become tracked risks

---

## 10. Final Documentation Set
Created in this checkpoint:
- [x] `docs/USER_GUIDE_PERSONAL.md`
- [x] `docs/PHASE_25_FINAL_ACCEPTANCE_REPORT.md`
- [x] `docs/PERSONAL_RELEASE_NOTES.md`

Updated in this checkpoint:
- [x] `CURRENT_TASK.md`
- [x] `PROJECT_STATE.md`
- [x] `docs/RUNTIME_TEST_REPORT.md`
- [x] `docs/RELEASE_READINESS_CHECKLIST.md`

Still required before final PASS:
- [ ] `docs/MVP_DEMO_GUIDE.md` updated for final personal-release state
- [ ] `docs/FACEBOOK_OAUTH_TEST_REPORT.md` updated for final personal-release state
- [ ] final acceptance matrix included in the final completion record

---

## 11. Honest Final Gate
### Ready for final PASS only if all below are true
- [ ] full manual UI acceptance is complete
- [ ] exactly one controlled real video publish is recorded
- [ ] the result is classified truthfully
- [ ] safe mode is restored to false
- [ ] app restart proves blocked-safe state
- [ ] no duplicate active jobs exist after the controlled test
- [ ] packaging artifact exists
- [ ] packaged launch evidence is recorded or blocker is documented honestly
- [ ] personal user guide exists
- [ ] migration guide is complete
- [ ] final docs are updated
- [ ] no secret is committed

### Current truthful conclusion
**Not yet final PASS.**

Current decision:

```text
FAIL — finish remaining blockers inside Phase 25
```

Reason:
- baseline/runtime/build/package state is healthy
- roadmap and release documents are now aligned
- personal user guide exists
- but the mandatory controlled real Facebook video publish and full manual interactive acceptance are still incomplete
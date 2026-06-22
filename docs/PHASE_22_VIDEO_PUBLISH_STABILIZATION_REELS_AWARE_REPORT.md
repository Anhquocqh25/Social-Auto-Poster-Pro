# Phase 22 — Video Publish Stabilization + Reels-Aware UX Report

## 1. Summary
Phase 22 focused on stabilizing the existing **normal Facebook Page video publish** experience without falsely relabeling it as Reels.

> Follow-up note: runtime flag-source alignment and the explicit controlled re-test that produced post `#28` / job `#21` were completed later in **Phase 22.1** and documented separately in:
> - `docs/PHASE_22_1_RUNTIME_REAL_PUBLISH_FLAG_SOURCE_ALIGNMENT_REPORT.md`
> - `docs/RUNTIME_TEST_REPORT.md`

This phase:

- preserved the Phase 21 decision:
  - **Facebook video publish, not Reels**
- updated Create Post / Posts / Diagnostics wording so the UI now says:
  - Facebook may show newly published videos as Reels
  - the app does not claim native Reels API support
- improved `needs_verification` user-facing wording
- re-ran baseline verification
- executed exactly one explicit controlled real-video test after approval
- restored and re-verified safe mode

Safe default at the end of the phase remained:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

This Phase 22 report remains historically accurate for:
- wording stabilization
- the blocked-safe controlled test artifact:
  - post `#27`
  - job `#20`

Phase 22.1 later clarified why that test stayed blocked:
- Electron runtime effective source was still `.env.local`
- shell-level temporary enablement did not win during that earlier run

---

## 2. Backup / Restore Point
Existing restore points preserved and available:

```txt
_backups/phase-21-reels-api-feasibility-path-decision-20260618-1042
_backups/phase-20-4-controlled-real-video-upload-foundation-20260618-1824
_backups/phase-20-4-2-startup-recovery-video-queue-harden-20260618-1947
```

Phase 22 itself was a stabilization/reporting/UI-wording pass on top of the current workspace state.

---

## 3. Files Changed

### Application code
- `src/pages/CreatePostPage.tsx`
- `src/pages/PostsPage.tsx`
- `src/pages/DiagnosticsPage.tsx`

### Documentation
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_21_REELS_API_FEASIBILITY_DECISION_REPORT.md`
- `docs/PHASE_22_VIDEO_PUBLISH_STABILIZATION_REELS_AWARE_REPORT.md`

---

## 4. Baseline Result
Verified in current workspace:

```bash
npx tsc --noEmit
npm run build
```

Result:

- TypeScript PASS
- build PASS

Observed:

- app code compiled successfully after the wording and UX updates
- no token/secret exposure was introduced
- no scope regression was introduced
- no Reels API claim was added

---

## 5. Reels-Aware UX Result

### 5.1 Create Post
Updated the immediate video publish UX so it now states truthfully:

- this is **Facebook video publish**
- Facebook may show newly published videos as Reels
- the app does **not** claim native Reels API support
- local delete does not remove published Facebook video
- remote edit/delete is not performed by the app

The controlled confirmation modal still requires:

- checkbox confirmation
- typed confirmation:
  - `PUBLISH VIDEO`

No queue job is created before confirmation.

### 5.2 Posts list / detail
Updated Posts list and Post Detail surfaces so video entries now state:

- **Facebook video publish**
- Facebook may show newly published videos as Reels
- the app does not claim native Reels API support

Also updated `needs_verification` explanation text so it now reads as a user-facing review state instead of older internal/provider-oriented wording.

### 5.3 Diagnostics
Updated Diagnostics wording so:

- the safe evidence panel uses friendlier `needs verification` phrasing
- the video warning now reflects the truthful current product state:
  - Facebook may show newly published videos as Reels
  - a dedicated Reels endpoint is not separately confirmed

---

## 6. Controlled Real Video Test Result

### 6.1 Executed command sequence
Executed after explicit approval:

```bash
FACEBOOK_REAL_PUBLISH_ENABLED=true node scripts/phase-20-4-1-controlled-real-video-single-test.cjs
FACEBOOK_REAL_PUBLISH_ENABLED=true timeout 180s npm run dev
```

Candidate created:

- post `#27`
- job `#20`

### 6.2 Truthful observed runtime behavior
Observed from runtime logs:

- Electron main runtime loaded `.env.local`
- effective runtime flag remained:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- queue started normally
- queue picked:
  - job `#20`
- readiness gate blocked real publish before provider execution
- no provider acceptance evidence was produced
- no real Facebook publish success was claimed

### 6.3 Final recorded state
Verified with:

```bash
node scripts/snapshot-posts.mjs 27
```

Observed final state for post `#27`:

- `status=blocked`
- `effectiveStatus=blocked`
- `attemptCount=1`
- `successfulAttemptCount=0`
- `failedJobCount=1`
- `hasProviderVideoAcceptance=false`
- `latestSafeErrorMessage=Real Facebook publishing remains disabled until Phase 7 publish enablement is explicitly turned on.`
- target final status:
  - `failed`
- duplicate active jobs:
  - `0`

Interpretation:

- the controlled test did execute exactly once
- runtime safe mode still won
- no real publish happened
- no fake success happened
- no `fb_sim_*` evidence was involved

---

## 7. Snapshot / Historical Evidence Preservation Result

### Preserved historical verification-needed artifact
Historical post `#26` remains safely normalized as:

- `effectiveStatus=needs_verification`
- `needsVerification=true`
- `needsVerificationReason=Facebook accepted the video upload but final publish confirmation was not returned.`

### Preserved old blocked-safe artifacts
Still preserved:

- post `#23`
- post `#22`

### Preserved published suffix-only artifacts
Still preserved:

- post `#21`
- post `#15`
- post `#14`

### Preserved old verification artifact
Still preserved:

- post `#6` remains effectively `needs_verification`

---

## 8. Safe-Mode Re-Verification Result
Re-verified with:

```bash
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

Observed:

- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`

UI assertions remained safe:

### AccountsPage
- sanitized probe output returned
- `realPublishingEnabled=false`
- `errors=[]`

### CreatePostPage
- exact blocked message visible
- `confirmDisabledInitial=true`
- `createdPostDelta=0`
- `jobCountDelta=0`
- `blockedCount=1`
- no modal bypass

### BulkCreatePage
- exact blocked message visible
- modal not opened
- `createdPostDelta=0`
- `jobCountDelta=0`
- `blockedCount=1`

### PostsPersistedBulkReview
- exact blocked message visible
- modal not opened
- `createdPostDelta=0`
- `jobCountDelta=0`

Interpretation:

- safe default remained intact after the controlled test
- no blocked probe created posts/jobs
- queue/scheduler startup remained intact

---

## 9. Preserved Functionality Result
Preserved in this phase:

- single text publish foundation
- single image publish foundation
- current normal video publish foundation
- Create Post
- Bulk Create
- Posts list/detail
- Diagnostics
- attempt timeline
- Accounts / Pages
- queue / scheduler
- VI default + EN switcher
- bulk publish safety gates
- `fb_sim_*` never counts as real success
- `FACEBOOK_REAL_PUBLISH_ENABLED=false` remains the safe default

---

## 10. Safety / Security Result
Confirmed preserved:

- no access token exposure
- no refresh token exposure
- no page token exposure
- no encrypted token exposure
- no App Secret exposure
- no OAuth code exposure
- no callback URL exposure
- no raw OAuth state exposure
- no tokenized Graph URL exposure
- no tokenized upload URL exposure
- no fake success introduced

Also confirmed:

- no OAuth flow change
- no Page scope narrowing
- no remote Facebook edit/delete
- no bulk real video publish
- no Reels API claim added without official confirmation

---

## 11. Known Limitations
Known limitations after Phase 22:

- the runtime safe flag source still prevents shell-level temporary enablement from taking effect once Electron main loads `.env.local`
- because of that, the explicit controlled candidate:
  - post `#27`
  did not reach provider execution
- the app still cannot claim native Reels API support
- bulk video publish remains unsupported
- no new verified end-to-end `published` real-video artifact was created in this phase

---

## 12. Revert Instructions
If you need to revert the Phase 22 wording/reporting changes, restore from the nearest preserved restore point and then re-apply only the desired code/doc state.

Useful restore points:

```txt
_backups/phase-21-reels-api-feasibility-path-decision-20260618-1042
_backups/phase-20-4-controlled-real-video-upload-foundation-20260618-1824
_backups/phase-20-4-2-startup-recovery-video-queue-harden-20260618-1947
```

Main files touched in this phase:

- `src/pages/CreatePostPage.tsx`
- `src/pages/PostsPage.tsx`
- `src/pages/DiagnosticsPage.tsx`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_21_REELS_API_FEASIBILITY_DECISION_REPORT.md`
- `docs/PHASE_22_VIDEO_PUBLISH_STABILIZATION_REELS_AWARE_REPORT.md`

---

## 13. Exact Manual Test For User
Recommended exact manual test after this phase:

1. Start in safe mode:
   - ensure `.env.local` still keeps:
     - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
2. Run:
   ```bash
   npm run dev
   ```
3. Open **Create Post**
   - attach one local video
   - confirm the page now says Facebook may show the video as Reels
   - confirm it does **not** claim native Reels API support
   - confirm blocked message still appears while real publish is disabled
4. Open **Posts**
   - inspect a video post row
   - confirm list/detail wording is now Reels-aware
   - confirm `needs_verification` copy is clearer
5. Open **Diagnostics**
   - confirm the safe evidence wording is updated
   - confirm no tokens/secrets are displayed
6. Optionally inspect:
   ```bash
   node scripts/snapshot-posts.mjs 27 26 25 24 23 22 21 15 14 6
   ```
   and confirm:
   - post `#27` is blocked-safe
   - post `#26` still normalizes to `needs_verification`

---

## 14. Recommended Next Task
Recommended next task after this historical Phase 22 pass was:

**Phase 22.1 — Runtime Real-Publish Flag Source Alignment + Controlled Video Re-Test**

Focus:

- document exactly why Electron runtime still resolves `FACEBOOK_REAL_PUBLISH_ENABLED=false` during controlled tests
- align shell-level explicit enablement vs `.env.local` loading intentionally
- re-run exactly one controlled real Facebook video publish after approval
- preserve Reels-aware wording
- preserve blocked-safe probes
- preserve no-token/no-secret exposure
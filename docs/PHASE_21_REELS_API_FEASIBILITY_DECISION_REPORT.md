# Phase 21 — Reels API Feasibility + Minimal Reels Path Decision Report

## 1. Summary
Phase 21 focused on deciding the **minimal safe product path for Facebook Reels support** without inventing unsupported API behavior.

This phase did **not** run any real Facebook publish.

Instead, it:

- created a restore point
- re-verified the current stable workspace baseline
- checked official Meta/Facebook documentation feasibility as honestly as the current agent environment allowed
- compared the current normal Facebook Page video path against any confirmed Reels evidence
- recorded the exact product decision for Phase 22

Safe default remained:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

---

## 2. Backup / Restore Point
Created restore point:

```txt
_backups/phase-21-reels-api-feasibility-path-decision-20260618-1042
```

Backed up artifacts:

- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_4_3_VIDEO_OUTCOME_CLASSIFICATION_REPORT.md`
- `src/services/facebook/FacebookPostProvider.ts`
- `src/services/facebook/FacebookService.ts`
- `src/services/facebook/FacebookProviderTypes.ts`
- `src/pages/CreatePostPage.tsx`
- `src/services/QueueService.ts`
- `src/services/ScheduleService.ts`
- `electron/main.ts`
- `src/types/electron.d.ts`
- `scripts/snapshot-posts.mjs`

---

## 3. Files Changed
Updated:

- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_4_3_VIDEO_OUTCOME_CLASSIFICATION_REPORT.md`

Created:

- `docs/PHASE_21_REELS_API_FEASIBILITY_DECISION_REPORT.md`

No application runtime code was changed in this phase.

---

## 4. Baseline Result
Re-verified in current workspace:

```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 26 25 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

Result:

- TypeScript PASS
- build PASS
- snapshot utility PASS
- dev startup PASS

Observed:

- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no real publish occurred during baseline
- no token/secret exposure observed
- no tokenized upload URL exposure observed

---

## 5. Official Reels API Feasibility Result
Attempted official Meta/Facebook documentation verification against:

- `https://developers.facebook.com/docs/video-api/guides/reels-publishing/`
- `https://developers.facebook.com/docs/graph-api/reference/page/video_reels`
- `https://developers.facebook.com/docs/graph-api/reference/page/videos`
- `https://developers.facebook.com/docs/pages-api/posts/reels-publishing/`

Observed result in the current agent environment:

- the Meta developer site does appear to host Reels-related documentation content
- one Reels URL returned `404`
- one Reels reference URL timed out
- one Reels guide page returned frontend shell/static content, but not enough reliable structured text to confirm exact API behavior
- one normal Page videos reference page was reachable

Truthful conclusion:

- official Reels documentation presence could be partially observed
- but **official Reels API details could not be extracted with enough fidelity in this environment** to safely confirm:
  - exact endpoint family
  - exact publish/container flow
  - exact permission set beyond current preserved baseline
  - exact scheduling support semantics
  - exact account/token model requirements

Therefore, this phase does **not** claim confirmed Facebook Reels API support for the current app/account/token model.

---

## 6. Current Video Path vs Reels Path Result

### 6.1 Current implemented normal Page video path
Current workspace already supports a normal Facebook Page video foundation with:

- endpoint:
  - `POST /{pageId}/videos`
- upload model:
  - direct local-file multipart upload
- queue model:
  - queue-backed only
- provider outcome model:
  - `published`
  - `failed`
  - `needs_verification`
- safe metadata endpoint category:
  - `video_upload`

### 6.2 What can be reused for a future Reels path
Can potentially be reused later:

- local file validation foundation
- queue-backed execution
- `finalState` model:
  - `published`
  - `failed`
  - `needs_verification`
- diagnostics / snapshot safety patterns
- safe secret/token redaction rules
- explicit confirmation UX pattern from video publish

### 6.3 What cannot be safely claimed as reusable yet
Cannot yet be safely claimed without clearer official Reels confirmation:

- that `POST /{pageId}/videos` creates Reels
- that normal Page video upload and Reels share the same endpoint
- that no additional publish step/container step is required
- that scheduling semantics are the same
- that the current token/scope model is sufficient specifically for Reels

### 6.4 Current product-safe interpretation
Safe interpretation for the current workspace:

- current implementation is **normal Facebook Page video publish groundwork**
- current implementation is **not confirmed Reels publishing**
- `/videos` must **not** be relabeled as Reels in the UI or docs

---

## 7. Permissions / Scopes Result
Canonical source remains:

- `src/services/facebook/FacebookConfigService.ts`
- `FACEBOOK_PAGE_READY_SCOPES`

Confirmed preserved:

- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

Result for this phase:

- no scope narrowing was applied
- no OAuth change was made
- no new scope was added
- no official evidence was extracted strongly enough to justify adding an extra Reels-specific scope in this pass

---

## 8. Implementation Decision
Recorded decision:

## Decision B — API supports only normal Page video in this environment

Truthful reasoning:

- the current workspace has verified normal Page video groundwork
- the current workspace has one real provider-attempt historical artifact:
  - post `#26`
- the current workspace already normalizes ambiguous provider acceptance safely as:
  - `needs_verification`
- official Reels API confirmation was not strong enough in this environment to justify implementing or labeling a Reels path

Therefore:

- Phase 22 should focus on **normal Facebook Page video publish stabilization**
- UI must **not** call the current feature Reels
- wording must stay explicit:
  - **Facebook video publish, not Reels**

---

## 9. Exact Phase 22 Scope
Phase 22 exact scope should be:

- one Facebook Page
- one normal video
- queue-backed only
- no bulk
- no schedule
- no auto retry
- no remote edit/delete
- safe diagnostics/snapshot
- truthful final states only:
  - `published`
  - `failed`
  - `needs_verification`

Phase 22 should improve:

- normal Page video publish stability
- post/job/attempt consistency
- safe verification-needed handling
- UX wording clarity:
  - **Facebook video publish, not Reels**

Phase 22 should **not** do:

- broad Reels feature rollout
- bulk video publish
- scheduling for real video publish
- pretending normal video is Reels

---

## 10. UI / UX Decision
Phase 21 UI/UX decision:

- do **not** show `Reels` as a publish type yet
- do **not** use ambiguous wording like:
  - `video = reels`
- if referenced in the UI later before confirmation, it should be phrased as:
  - `Reels publishing is not enabled yet.`

Current safe interpretation:

- existing video flow remains:
  - **normal Facebook video**
- if a future Reels path is officially confirmed, it must require stronger confirmation:
  - `PUBLISH REELS`

Until then:

- do not expose a Reels button
- do not expose fake Reels success states
- do not reuse the current video flow label as Reels

---

## 11. Safety Rules For Phase 22
Mandatory safety rules for the next phase:

- `FACEBOOK_REAL_PUBLISH_ENABLED=false` by default
- one Page only
- one video only
- no bulk
- no schedule
- no auto retry
- no remote edit/delete
- no fake success
- no token exposure
- no tokenized Graph URL exposure
- no tokenized upload URL exposure
- if ambiguous or processing-confirmation is insufficient:
  - `needs_verification`
- if provider fails:
  - `failed`
- only if confirmation is sufficient:
  - `published`

Additional wording rule:

- current flow must remain labeled:
  - `Facebook video publish, not Reels`

---

## 12. Optional Feasibility Probe Result
No real feasibility probe was run.

Reason:

- official Reels behavior could not be confirmed with enough fidelity in the current environment
- Phase 21 did not need a real publish to make the minimal path decision
- safe default remained:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

---

## 13. Preserved Functionality Result
Preserved in this phase:

- startup recovery hardening from Phase 20.4.2
- video outcome classification from Phase 20.4.3
- text publish
- image publish behavior
- image failure safe metadata
- controlled bulk publish safety flow
- video local draft/schedule
- video upload provider foundation
- Create Post
- Bulk Create
- Posts detail
- attempt timeline
- Accounts / Pages
- Diagnostics
- snapshot utility
- queue / scheduler
- Vietnamese default + EN switcher
- `fb_sim_*` never counts as real success
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`

---

## 14. Safety / Security Result
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
- no raw upload session exposure
- no fake success introduced

Also confirmed:

- no real publish occurred in this phase
- no bulk publish occurred in this phase

---

## 15. Exact Verification Evidence
Executed:

```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 26 25 24 23 22 21 15 14 6
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

Observed evidence:

- `npx tsc --noEmit` PASS
- `npm run build` PASS
- snapshot output confirmed:
  - post `#26`
    - stored status:
      - `failed`
    - normalized:
      - `effectiveStatus=needs_verification`
    - `hasProviderVideoAcceptance=true`
- dev startup confirmed:
  - app starts
  - queue starts
  - scheduler starts
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- blocked-path probes confirmed no unintended job creation

---

## 16. Known Limitations
Known limitations after this phase:

- official Reels API behavior could not be fully verified from Meta docs in this environment
- the current workspace cannot safely claim confirmed Reels support
- historical post `#26` still stores:
  - `status=failed`
- normalized interpretation remains:
  - `effectiveStatus=needs_verification`
- Phase 21 intentionally did not add any Reels runtime code
- later phases may mention that Facebook can visually surface newly published videos as Reels, but that does **not** change this phase decision:
  - the app still must not claim native Reels API support without stronger official evidence

---

## 17. Revert Instructions
Restore from:

```txt
_backups/phase-21-reels-api-feasibility-path-decision-20260618-1042
```

Files available in the backup:

- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_4_3_VIDEO_OUTCOME_CLASSIFICATION_REPORT.md`
- `src/services/facebook/FacebookPostProvider.ts`
- `src/services/facebook/FacebookService.ts`
- `src/services/facebook/FacebookProviderTypes.ts`
- `src/pages/CreatePostPage.tsx`
- `src/services/QueueService.ts`
- `src/services/ScheduleService.ts`
- `electron/main.ts`
- `src/types/electron.d.ts`
- `scripts/snapshot-posts.mjs`

---

## 18. Recommended Next Phase
Recommended next task:

**Phase 22 — Controlled Real Video Stabilization (Facebook video publish, not Reels)**

Focus:

- stabilize the current normal Page video path
- keep queue-backed one-Page one-video execution
- keep explicit confirmation
- keep `FACEBOOK_REAL_PUBLISH_ENABLED=false` by default
- do not label the feature Reels
- only revisit Reels after explicit official API confirmation is captured clearly enough for implementation

## 19. Follow-up Note After Phase 22
A later stabilization pass preserved this Phase 21 decision and applied it in product wording:

- Create Post / Posts / Diagnostics now say:
  - Facebook may show newly published videos as Reels
  - this app does not claim native Reels API support
- one explicit controlled candidate in that later pass:
  - post `#27`
  - job `#20`
  was still blocked truthfully because runtime safe-mode remained effective
- this later result reinforces the original Phase 21 conclusion:
  - **Facebook video publish, not Reels**

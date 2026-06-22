# Phase 23 — Video Evidence UX Finalization Report

**Date:** 2026-06-19  
**Status:** evidence closed / video-first UX verified / posts UX re-verified / safe-mode preserved

---

## 1. Objective

Close the truthful evidence loop for the latest controlled real-video candidate while finalizing the user-facing UX around:

- video-first Create Post guidance
- Reels-aware wording without claiming Reels API support
- Posts list/detail consistency
- attempt timeline evidence visibility
- safe blocked-state surfacing when real publish is disabled

This pass does **not** claim a real Facebook video success for post `#28`.

Safe default remains:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

---

## 2. Scope Of This Pass

This pass focused on:

1. exact evidence closure for the newest controlled candidate
   - post `#28`
   - job `#21`

2. re-verifying that blocked-safe semantics remain truthful when the effective runtime flag is disabled

3. confirming that current Create Post and Posts UX already matches the intended final Phase 23 video-first / Reels-aware wording

4. preserving prior safety semantics for:
   - post `#6`
   - post `#26`
   - `fb_sim_*` historical records

5. keeping diagnostics / queue / scheduler behavior aligned with safe local evidence only

---

## 3. Exact Evidence Closed For Post #28

Verified evidence for the latest controlled candidate:

- post `#28`
- job `#21`
- attempt `#24`

Observed truthful state:

- `post.status=blocked`
- `post.publishedAt=null`
- `post.mediaType=video`
- `post.mediaFileName=phase-20-4-1-test-video.mp4`

Associated job state:

- `job.id=21`
- `job.status=failed`
- `job.errorCode=FACEBOOK_REAL_PUBLISH_BLOCKED`

Associated attempt state:

- `attempt.id=24`
- `attempt.status=failed`
- `attempt.errorCode=FACEBOOK_REAL_PUBLISH_BLOCKED`

Safe derived interpretation:

- `effectiveStatus=blocked`
- `providerReached=false`
- `hasProviderVideoAcceptance=false`
- `safeFailureMeta=null`
- `pendingJobCount=0`
- `activeJobCount=0`
- `duplicateActiveJobCount=0`

Truthful conclusion:

- this candidate did **not** become a real Facebook success
- this candidate did **not** become `needs_verification`
- this candidate was blocked safely before provider reach
- no duplicate active queue work was introduced

---

## 4. Create Post Video-First UX Result

Verified current `CreatePostPage` behavior:

- video appears as an explicit composer mode
- media picker supports:
  - one local image
  - one local video
- video wording is explicitly **Facebook video publish**
- UI states that Facebook **may show new videos as Reels**
- UI does **not** claim native Reels API support
- blocked-safe guidance is visible while `FACEBOOK_REAL_PUBLISH_ENABLED=false`

Controlled confirmation behavior remains in place for single-video publish:

- modal appears before queued job creation
- checkbox confirmation required
- typed confirmation required:
  - `PUBLISH VIDEO`
- final confirm button stays disabled until confirmation passes

Preserved safety:

- no direct Graph call from the UI
- no fake success
- no bypass when real publish is disabled

---

## 5. Posts UX / Evidence Visibility Result

Verified current `PostsPage` behavior:

### List view
- video rows show Reels-aware wording safely
- video metadata is surfaced:
  - file name
  - file size
  - MIME type
  - extension
  - duration
- `needs_verification` rows remain clearly highlighted
- list continues to show safe media labels only

### Detail view
- fixed-size media preview remains preserved
- safe external id masking remains preserved
- attempt timeline remains visible
- timeline shows:
  - status
  - source account
  - started / finished time
  - duration
  - safe external id suffix only
  - safe error message / error code
- verification panel remains present for `needs_verification` cases
- no local “mark verified” shortcut is exposed
- no remote edit/delete is introduced

### Recovery wording
Posts detail still states safely that:

- duplicate as draft is allowed
- local cancel / refresh / diagnostics are available
- real Facebook retry remains disabled by default unless explicitly enabled and confirmed later

---

## 6. Historical Semantics Preserved

This pass preserves the already established historical truth:

### Post #6
- remains effectively `needs_verification`
- local fake success semantics are not allowed
- `fb_sim_*` evidence is never upgraded to real success

### Post #26
- historical storage may still show `status=failed`
- safe interpretation remains:
  - `effectiveStatus=needs_verification`
- this remains the correct normalized interpretation for the old ambiguous real-video case

### Post #28
- remains blocked-safe
- is **not** a provider-reached case
- is **not** a verification-needed case
- is **not** a real success

---

## 7. Reels-Aware Positioning

The project position remains unchanged and explicit:

- this app supports **Facebook video publish**
- Facebook may later surface some newly published videos as **Reels**
- this app does **not** claim a dedicated native Reels API integration
- this pass does **not** change the previously closed Phase 21 / 22 product decision:
  - **Facebook video publish, not Reels**

---

## 8. Safety / Security Result

Preserved in this pass:

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

Also preserved:

- no OAuth flow change
- no Page scope narrowing
- no remote Facebook edit/delete
- no auto publish
- no bulk real video publish enablement
- no `fb_sim_*` counted as real Facebook success

Required Page-ready scopes remain unchanged:

- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

Canonical source remains:

- `src/services/facebook/FacebookConfigService.ts`

---

## 9. Runtime / Verification Result

Verified evidence and state in this pass included:

- exact local evidence extraction for post `#28`
- blocked-safe confirmation:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no provider reach for the blocked candidate
- no duplicate active jobs for post `#28`

Observed blocked-safe message remained truthful:

- `Real Facebook publishing remains disabled until Phase 7 publish enablement is explicitly turned on.`

This confirms that the newest candidate did not silently succeed and did not bypass the safety gate.

---

## 10. Files Relevant To This Finalization

Verified current UI files align with the intended final Phase 23 wording/state:

- `src/pages/CreatePostPage.tsx`
- `src/pages/PostsPage.tsx`

Evidence helper used in this pass:

- `scripts/phase-23-post-28-evidence.cjs`

Reference state / runtime docs already aligned with the finalization baseline:

- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_22_1_RUNTIME_REAL_PUBLISH_FLAG_SOURCE_ALIGNMENT_REPORT.md`

---

## 11. Non-Goals Confirmed

This pass does **not**:

- claim post `#28` as published
- claim provider reach for post `#28`
- claim verification-needed status for post `#28`
- add a new controlled real-video test
- enable real bulk video publish
- claim Reels API support
- reinterpret `fb_sim_*` as real success
- add remote undo/delete behavior
- expose any secret-bearing runtime data

---

## 12. Final Conclusion

Phase 23 evidence closure is complete at the truthful level required for this workspace snapshot:

- the latest candidate `#28` is **blocked-safe**
- provider was **not reached**
- no duplicate active queue state exists
- current video-first Create Post UX is already aligned
- current Posts list/detail evidence UX is already aligned
- historical safety semantics for `#6`, `#26`, and `fb_sim_*` remain preserved
- safe-mode default remains intact

The correct statement for this pass is:

> post `#28` is a blocked-safe controlled video candidate, not a real Facebook video success.
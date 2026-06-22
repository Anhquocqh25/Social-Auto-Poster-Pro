# Phase 20.4.3 — Video Outcome Classification Alignment Report

## 1. Summary
Phase 20.4.3 aligned **real Facebook video verification-needed outcome classification** across:

> Follow-up note from Phase 21: this report remains the canonical closed baseline for normal Facebook Page video verification-needed classification. Phase 21 did not add Reels support and did not relabel the existing `/videos` provider path as Reels.

- queue persistence
- diagnostics snapshot
- runtime type contracts
- local read-only snapshot utility

This phase did **not** run any new controlled real Facebook publish.

Instead, it fixed the classification mismatch exposed by the historical Phase 20.4.2 evidence for:

- post `#26`
- job `#19`
- attempt `#22`

Safe final boundary remained:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

---

## 2. Safety Boundary
This phase preserved all current safety rules.

It did **not**:

- run any new real Facebook video test
- claim a new real Facebook video success
- change OAuth flow
- narrow Facebook Page scopes
- treat `fb_sim_*` as real evidence
- expose access token, refresh token, page token, encrypted token, App Secret, OAuth code, callback URL, raw OAuth state, tokenized Graph URL, or tokenized upload URL
- enable bulk real video publish
- enable automatic retry for real Facebook video attempts
- perform remote edit/delete on Facebook posts

---

## 3. Restore Point / Backup
Created restore point:

```txt
_backups/phase-20-4-3-video-outcome-classification-20260618-1017
```

Backed up artifacts:

- `src/services/QueueService.ts`
- `electron/main.ts`
- `src/types/electron.d.ts`
- `scripts/snapshot-posts.mjs`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_4_2_STARTUP_RECOVERY_VIDEO_QUEUE_HARDENING_REPORT.md`

---

## 4. Problem Identified
Historical Phase 20.4.2 evidence was honest, but classification stayed partially inconsistent.

Observed mismatch:

- provider acceptance had been reached once for post `#26`
- job safe code was:
  - `FACEBOOK_VIDEO_NEEDS_VERIFICATION`
- attempt timeline showed:
  - one successful provider attempt
- but local persisted post status remained:
  - `failed`
- and older snapshot output still surfaced:
  - `effectiveStatus=failed`

This caused ambiguity between:

- provider acceptance
- verification-needed local outcome
- safe snapshot interpretation

---

## 5. Files Changed
Updated:

- `src/services/QueueService.ts`
- `electron/main.ts`
- `src/types/electron.d.ts`
- `scripts/snapshot-posts.mjs`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_20_4_2_STARTUP_RECOVERY_VIDEO_QUEUE_HARDENING_REPORT.md`

Created:

- `docs/PHASE_20_4_3_VIDEO_OUTCOME_CLASSIFICATION_REPORT.md`

---

## 6. Code Changes Implemented

### 6.1 Queue persistence alignment
Updated:

- `src/services/QueueService.ts`

Implemented:

- when provider returns:
  - `finalState='needs_verification'`
- queue now persists:
  - `post.status='needs_verification'`
- safe post error message remains explicit
- target remains non-success
- job remains conservatively non-success
- no fake published success is created

Preserved:

- no auto retry for real Facebook video attempts
- no fake `published`
- no `fb_sim_*` real-success interpretation

### 6.2 Diagnostics normalization
Updated:

- `electron/main.ts`

Implemented:

- recent jobs now expose:
  - `needsVerification`
  - `needsVerificationReason`
- failed attempts now expose:
  - `needsVerification`
  - `needsVerificationReason`
- safe provider endpoint category now normalizes:
  - `video_publish`
  - to
  - `video_upload`
- safe evidence now includes:
  - `videoNeedsVerificationCount`
- retry safety messaging now treats verification-needed video outcomes explicitly as manual-confirmation-required follow-up

### 6.3 Type contract alignment
Updated:

- `src/types/electron.d.ts`

Aligned:

- diagnostics recent jobs shape
- failed attempts shape
- safe evidence shape

Added support for:

- `needsVerification`
- `needsVerificationReason`
- `videoNeedsVerificationCount`

### 6.4 Snapshot utility normalization
Updated:

- `scripts/snapshot-posts.mjs`

Implemented:

- historical verification-needed evidence is now normalized safely
- snapshot output now derives:
  - `effectiveStatus=needs_verification`
- snapshot output now surfaces:
  - `needsVerification=true`
  - `needsVerificationReason`
  - `hasProviderVideoAcceptance=true`

---

## 7. Historical Post #26 Result After Alignment
Re-verified with:

```bash
node scripts/snapshot-posts.mjs 26
```

Observed:

- post `#26` exists
- stored local historical status remains:
  - `failed`
- normalized safe snapshot status is now:
  - `effectiveStatus=needs_verification`
- snapshot now exposes:
  - `needsVerification=true`
  - `needsVerificationReason=Facebook accepted the video upload but final publish confirmation was not returned.`
  - `hasProviderVideoAcceptance=true`
- duplicate active jobs remain:
  - `0`

Important note:

- this phase did **not** mutate historical database evidence for post `#26`
- instead, it fixed:
  - future queue persistence behavior
  - current diagnostics interpretation
  - current snapshot interpretation

So:

- historical evidence remains preserved
- interpretation is now safer and more consistent
- future runs will persist `post.status=needs_verification` directly

---

## 8. Verification Commands
Executed in current workspace:

```bash
npx tsc --noEmit
node scripts/snapshot-posts.mjs 26
npm run build
npm run dev
```

---

## 9. Verification Result

### TypeScript
Verified:

- `npx tsc --noEmit` PASS

### Snapshot utility
Verified:

- `node scripts/snapshot-posts.mjs 26` PASS

Observed:

- `effectiveStatus=needs_verification`
- `needsVerification=true`
- `needsVerificationReason` surfaced
- `hasProviderVideoAcceptance=true`

### Production build
Verified:

- `npm run build` PASS

### Dev runtime
Verified:

- `npm run dev` PASS

Observed during startup:

- app starts
- queue starts
- scheduler starts
- final workspace state remains:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

---

## 10. Preserved Functionality
Preserved in this phase:

- Create Post flow
- single text publish safety
- single image publish safety
- single video confirmation UX
- Bulk Create flow
- persisted Posts bulk review flow
- diagnostics snapshot access
- scheduler startup
- queue startup
- Phase 20.4.2 startup recovery hardening
- old post `#6` remains effectively `needs_verification`
- `fb_sim_*` remains non-real evidence only
- no token/secret exposure introduced

---

## 11. Security / Logging Result
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

Diagnostics and snapshot output remain sanitized.

---

## 12. Interpretation
Phase 20.4.3 resolved the remaining classification ambiguity left after Phase 20.4.2.

What is now improved:

- future verification-needed video outcomes persist more honestly
- diagnostics reflects verification-needed outcomes explicitly
- snapshot output interprets historical evidence safely
- post `#26` no longer looks like a plain generic failure in safe snapshot output

What is intentionally unchanged:

- no new real Facebook test was run
- no real Facebook published success was claimed
- historical DB evidence for post `#26` was not rewritten
- safe default remains:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

---

## 13. Remaining Limitation
Still intentionally not achieved:

- a verified end-to-end Facebook video local `published` outcome
- a new explicit controlled follow-up run after the Phase 20.4.3 persistence fix

Also note:

- historical post `#26` still stores `status=failed` in the current DB
- the new queue path will persist `needs_verification` correctly for future occurrences

---

## 14. Recommended Next Task
Recommended next task after this closed phase was originally recorded:

**Phase 20.4.4 — Controlled Real Video Re-Verification After Classification Fix**

Phase 21 product planning later superseded that immediate next-step recommendation with a Reels feasibility decision pass before any further real-video implementation expansion.

Focus:

- preserve:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false` by default
- only if explicitly approved:
  - run exactly one new controlled real Facebook video attempt
- verify that a future verification-needed outcome now persists directly as:
  - `post.status=needs_verification`
- verify diagnostics and snapshot consistency end-to-end for the new evidence
- preserve no-duplicate-active-job behavior
- preserve blocked-safe runtime probes after restore

---

## 15. Conclusion
Phase 20.4.3 completed successfully.

Truthful final conclusion:

- no new real Facebook publish was executed
- no fake success was introduced
- video verification-needed classification is now aligned across queue persistence, diagnostics, and snapshot output
- historical post `#26` is now interpreted safely as `needs_verification`
- safe default remains restored:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
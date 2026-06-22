# Phase 22.1 — Runtime Real Publish Flag Source Alignment Report

## 1. Summary
Phase 22.1 focused on making the effective runtime source of `FACEBOOK_REAL_PUBLISH_ENABLED` explicit, safe, and observable.

This pass:

- verified the runtime precedence root cause
- confirmed `.env.local` was overriding shell-level temporary enablement during Electron startup
- implemented explicit safe source surfacing for:
  - `.env.local`
  - `.env`
  - `shell`
  - `default_false`
- surfaced the effective source in diagnostics without exposing tokens, secrets, callback URLs, raw state, or tokenized Graph URLs
- applied a follow-up diagnostics UX hardening pass so the page defaults to a summary-first safe view
- kept advanced runtime/job/attempt details available only after explicit user expansion
- re-ran blocked-safe baseline verification
- executed exactly one explicit controlled real-video re-test after approval with effective flag true
- restored safe mode and re-verified blocked-safe runtime behavior

Safe default at the end of the phase remained:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

---

## 2. Root Cause
Observed before the fix:

- shell-level command prefixes such as:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=true npm run dev`
- were not the final effective source used by Electron main runtime
- `.env.local` loading won at runtime and forced:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`

Truthful implication:

- the earlier controlled test candidate:
  - post `#27`
  - job `#20`
- was blocked by runtime safe mode even though shell enablement had been attempted

This was a safety-preserving outcome, but it made controlled-test intent ambiguous.

---

## 3. Files Changed

### Application code
- `src/lib/loadLocalEnv.ts`
- `src/services/facebook/FacebookConfigService.ts`
- `src/services/AccountConnectionService.ts`
- `src/types/electron.d.ts`
- `src/lib/electronApi.ts`
- `electron/main.ts`
- `src/pages/DiagnosticsPage.tsx`

### Documentation
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_22_VIDEO_PUBLISH_STABILIZATION_REELS_AWARE_REPORT.md`
- `docs/PHASE_22_1_RUNTIME_REAL_PUBLISH_FLAG_SOURCE_ALIGNMENT_REPORT.md`

---

## 4. Implementation Result

### 4.1 Runtime source alignment
Implemented:

- local env loader now reports the effective real-publish flag source
- Electron main persists that source into runtime env state
- Facebook config snapshot now returns:
  - `realPublishingEnabled`
  - `realPublishingFlagSource`
- account connection status now exposes the same safe source metadata
- diagnostics safe evidence now includes:
  - `realPublishingFlagSource`

Supported safe source values:

- `.env.local`
- `.env`
- `shell`
- `default_false`

### 4.2 Diagnostics UX
Diagnostics now shows:

- real publishing state:
  - Enabled / Disabled
- source:
  - `.env.local`
  - `.env`
  - `shell env`
  - `safe default`
- warning banner when real publishing is enabled for a controlled session
- summary-first runtime visibility by default
- explicit toggle for advanced details
- advanced runtime/job/attempt sections hidden until intentionally expanded

No secrets are surfaced.

---

## 5. Baseline / Safe-Mode Verification

Verified:

```bash
npx tsc --noEmit
npm run build
FACEBOOK_UI_ASSERT_ON_START=1 timeout 120s npm run dev
```

Result:

- TypeScript PASS
- build PASS
- dev runtime PASS

Observed during safe-mode runtime:

- app starts
- queue starts
- scheduler starts
- effective runtime flag:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- effective source:
  - `.env.local`

Follow-up diagnostics UX re-verification also passed with:

```bash
npx tsc --noEmit
npm run build
npm run dev
```

Observed in the follow-up pass:

- app starts
- queue starts
- scheduler starts
- effective runtime flag remains:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- effective source remains:
  - `.env.local`
- diagnostics still surfaces the safe effective source
- diagnostics now defaults to summary-first visibility
- advanced runtime/job/attempt detail remains available only after explicit expansion
- no real publish occurred

Blocked-safe probes remained truthful:

### AccountsPage
- sanitized probe returned
- `realPublishingEnabled=false`
- no errors

### CreatePostPage
- exact blocked message visible
- confirm stayed disabled
- created post delta = `0`
- created job delta = `0`

### BulkCreatePage
- exact blocked message visible
- modal did not bypass the disabled gate
- created post delta = `0`
- created job delta = `0`

### PostsPersistedBulkReview
- exact blocked message visible
- modal did not bypass the disabled gate
- created post delta = `0`
- created job delta = `0`

Interpretation:

- blocked-safe behavior remains intact
- queue/scheduler startup remains intact
- no real publish occurred during safe-mode verification

---

## 6. Controlled Real Video Re-Test Result

### 6.1 Executed command sequence
Executed after explicit approval:

```bash
cp .env.local .env.local.phase-22-1.bak
# set FACEBOOK_REAL_PUBLISH_ENABLED=true inside .env.local
npx tsc --noEmit
npm run build
node scripts/phase-20-4-1-controlled-real-video-single-test.cjs
```

Created candidate:

- post `#28`
- job `#21`

Observed creation payload:

- `mediaType=video`
- local media path present
- media file size:
  - `3587`

### 6.2 Truthful observed result
The controlled re-test no longer depended on shell override precedence.

Observed:

- candidate creation succeeded
- effective enablement was intentionally sourced from `.env.local`
- no fake success was claimed at creation time
- no `fb_sim_*` evidence was involved

### 6.3 Snapshot after safe-mode restore
Verified with:

```bash
node scripts/snapshot-posts.mjs 28 27 26 25 24 23 22 21 15 14 6
```

Observed for post `#28` after safe-mode restore:

- `status=queued`
- `effectiveStatus=queued`
- `mediaType=video`
- `isUnsupportedForRealPublish=true`
- `realVideoPublishSupported=false`
- `jobCount=1`
- `pendingJobCount=1`
- `processingJobCount=0`
- `activeJobCount=1`
- `attemptCount=0`

Interpretation:

- the re-test candidate was created truthfully
- safe mode was restored immediately after the controlled step
- post `#28` now remains a truthful queued/pending artifact for follow-through inspection
- no published success was claimed

---

## 7. Historical Evidence Preservation
Still preserved:

- post `#27`
  - blocked-safe historical artifact from the earlier shell-override mismatch
- post `#26`
  - remains effectively `needs_verification`
- post `#24`
  - remains the canonical real-image provider-failure evidence
- post `#6`
  - remains effectively `needs_verification`
- posts `#21`, `#15`, `#14`
  - remain published with safe suffix-only surfacing

No `fb_sim_*` value is treated as real success.

---

## 8. Safety / Security Result
Preserved:

- no OAuth flow change
- no Facebook scope narrowing
- no token exposure
- no page token exposure
- no App Secret exposure
- no callback URL exposure
- no raw OAuth state exposure
- no tokenized Graph URL exposure
- no remote edit/delete behavior
- no auto publish
- no bulk real publish enablement
- no fake success

Canonical Page-ready scopes remain:

- `public_profile`
- `email`
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

---

## 9. Final Runtime State
Final verified workspace state:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

Final verified source in runtime diagnostics:

```txt
.env.local
```

---

## 10. Recommended Next Task
Recommended next task:

**Phase 22.2 — Controlled Video Queue Outcome Follow-Through**

Focus:

- inspect the truthful runtime outcome for post `#28`
- determine whether it eventually becomes:
  - `published`
  - `failed`
  - `needs_verification`
  - or remains queued/pending
- preserve:
  - `FACEBOOK_REAL_PUBLISH_ENABLED=false`
  - diagnostics source visibility
  - blocked-safe probes
  - no-token/no-secret exposure
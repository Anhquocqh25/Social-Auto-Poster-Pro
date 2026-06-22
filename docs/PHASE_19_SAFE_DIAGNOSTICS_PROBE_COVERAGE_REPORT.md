# Phase 19 — Safe Diagnostics Consolidation + Probe Coverage Completion Report

## Summary
Phase 19 completed safe runtime diagnostics consolidation and finished the blocked Create Post probe coverage without changing any real publish safety boundary.

Safe default preserved:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

No real publish test was run in this phase.

---

## Goals
This phase targeted:

1. completing Create Post blocked-path probe coverage
2. adding safe Diagnostics evidence visibility for runtime inspection
3. keeping probe output compact, sanitized, and dev-only
4. preserving existing safety rules:
   - no token exposure
   - no secret exposure
   - no callback URL exposure
   - no raw OAuth state exposure
   - no tokenized Graph URL exposure
5. preserving `fb_sim_*` as non-real evidence only
6. preserving old post `#6` as effective `needs_verification`

---

## Files Changed
- `src/pages/CreatePostPage.tsx`
- `src/pages/DiagnosticsPage.tsx`
- `src/lib/electronApi.ts`
- `src/types/electron.d.ts`
- `electron/main.ts`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_19_SAFE_DIAGNOSTICS_PROBE_COVERAGE_REPORT.md`

---

## Implementation Details

### 1. Create Post blocked-path probe completion
Added stable selectors to the Create Post page:

- `create-post-safety-banner`
- `create-post-real-publish-status`
- `create-post-real-publish-disabled-message`
- `create-post-post-now-button`
- `create-post-post-now-disabled-reason`

Create Post now exposes a stable exact blocked sentence for the flag-false real publish path:

```txt
Real Facebook publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable manual publish.
```

The Phase 19 probe now verifies:
- exact blocked sentence visibility
- disabled Post Now button
- no post creation
- no queue/job creation
- no pending/active queue delta

### 2. Diagnostics safe evidence consolidation
Extended `DiagnosticsSnapshot` with a new `safeEvidence` block.

Added safe evidence aggregation in `electron/main.ts` and surfaced it in `DiagnosticsPage.tsx`.

Safe evidence fields:
- `realPublishingEnabled`
- `queueHealth`
- `schedulerHealth`
- `pendingJobCount`
- `processingJobCount`
- `activeLockCount`
- `recentFailedOrBlockedJobCount`
- `fbSimEvidencePostCount`
- `effectiveNeedsVerificationCount`
- `reminder`
- `snapshotCommand`
- `snapshotChecks`

The Diagnostics UI now shows:
- runtime-safe aggregate evidence only
- local-only snapshot guidance
- no secrets/tokens/callbacks

### 3. Localization-safe probe behavior
The Create Post probe no longer depends on English-only banner interpretation.

Instead it uses:
- stable `data-testid`
- the exact blocked message
- tolerant localized status matching for loading/error/enabled states

This removed the previous false-positive probe error for Vietnamese default UI.

### 4. Renderer fallback alignment
Updated the fallback `emptyDiagnosticsSnapshot` in `src/lib/electronApi.ts` so renderer-side fallback remains type-safe and uses safe default values only.

---

## Verification

### Typecheck
```bash
npx tsc --noEmit
```

Result:
- PASS

### Build
```bash
npm run build
```

Result:
- PASS

### Snapshot utility
```bash
node scripts/snapshot-posts.mjs 14 15 6
```

Result:
- PASS

Confirmed snapshot interpretation:
- post `#14`: effective `published`
- post `#15`: effective `published`
- post `#6`: effective `needs_verification`
- `fb_sim_*` remains non-real evidence only
- no duplicate active jobs found for `#14`, `#15`, `#6`

### Runtime probe startup
```bash
FACEBOOK_UI_ASSERT_ON_START=1 npm run dev
```

Result:
- PASS

Observed:
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no real publish occurs

---

## Probe Results

### AccountsPage
- compact sanitized result returned
- `errors=[]`

### CreatePostPage
- `realPublishingEnabled=false`
- `exactBlockedMessageVisible=true`
- `confirmDisabledInitial=true`
- `createdPostDelta=0`
- `jobCountDelta=0`
- `pendingBefore=0`
- `pendingAfter=0`
- `activeBefore=0`
- `activeAfter=0`
- `blockedCount=1`
- `errors=[]`

Interpretation:
- blocked Create Post manual publish path is fully covered
- no post/job mutation happened

### BulkCreatePage
- `exactBlockedMessageVisible=true`
- `modalVisible=false`
- `createdPostDelta=0`
- `jobCountDelta=0`
- `pendingBefore=0`
- `pendingAfter=0`
- `activeBefore=0`
- `activeAfter=0`
- `errors=[]`

### PostsPersistedBulkReview
- `exactBlockedMessageVisible=true`
- `modalVisible=false`
- `createdPostDelta=0`
- `jobCountDelta=0`
- `pendingBefore=0`
- `pendingAfter=0`
- `activeBefore=0`
- `activeAfter=0`
- `errors=[]`

Interpretation:
- all verified blocked flows remain safe under flag-false runtime
- no queue jobs created by probes
- no real publish path executed

---

## Safety / Security Result
Preserved:
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no access token exposure
- no refresh token exposure
- no page token exposure
- no encrypted token exposure
- no App Secret exposure
- no OAuth code exposure
- no callback URL exposure
- no raw OAuth state exposure
- no tokenized Graph URL exposure
- no fake reclassification of `fb_sim_*` as real success

Diagnostics safe evidence panel only uses aggregate local-safe values.

---

## Preserved Functionality
Confirmed preserved:
- controlled real Facebook text publish implementation
- controlled real Facebook image publish implementation
- controlled bulk publish implementation
- Create Post flow
- Bulk Create flow
- persisted Posts bulk review flow
- CSV import flow
- per-row media flow
- Posts detail / attempt timeline
- Accounts / Pages
- Diagnostics
- queue / scheduler startup
- VI/EN switcher
- Vietnamese default
- old post `#6` remains `needs_verification`

---

## Known Limitations
- packaging warnings about missing author/category/icon remain non-blocking build metadata warnings
- Diagnostics safe evidence currently provides visibility and guidance only; it does not yet deep-link directly into filtered Posts evidence
- no real publish live test was run in this phase by design

---

## Recommended Next Task
Recommended next task:
- **Phase 19.1 — Diagnostics Evidence Navigation + Snapshot UX Polish**

Possible scope:
- add deep-link from Diagnostics safe evidence into filtered Posts
- add copy action for snapshot command
- add optional probe coverage for Diagnostics panel rendering itself
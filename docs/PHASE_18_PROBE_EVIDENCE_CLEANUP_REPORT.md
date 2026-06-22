# Phase 18 — Probe Evidence Cleanup + Runtime Snapshot Hardening Report

## 1. Goal
Phase 18 hardened dev-only runtime evidence collection so probe output remains useful for UI/runtime verification without exposing sensitive values or dumping large raw text.

Safe boundary preserved:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

## 2. Changes Implemented In Phase 18

### 2.1 Dev-only probe helper refactor
Updated:
- `electron/main.ts`

Implemented:
- shared helper utilities for UI probe execution
- compact standardized probe result shape
- reduced raw object dumping
- removed large `textPreview` payloads
- used stable `data-testid` hooks where available

Compact probe output focuses on:
- `probeName`
- `realPublishingEnabled`
- `exactBlockedMessageVisible`
- `modalVisible`
- confirm-button disabled states
- created post delta
- queue/job delta
- pending/active counts
- safe count fields
- queue post ids only

### 2.2 Stable probe hooks restored
Updated:
- `src/pages/BulkCreatePage.tsx`
- `src/pages/PostsPage.tsx`

Added stable `data-testid` hooks for:
- blocked-message banner
- open-review buttons
- modal containers
- confirm checkbox
- confirm input
- confirm button
- progress panels

### 2.3 Sensitive runtime evidence cleanup
Updated:
- `src/pages/AccountsPage.tsx`
- `electron/main.ts`

Implemented:
- removed callback URL from Accounts page config-status console log
- removed `redirectUri` from Electron-side connection-status logs
- kept masked App ID and safe config status output only

## 3. Phase 18 Verification Baseline

### 3.1 Build / startup
Verified:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `FACEBOOK_UI_ASSERT_ON_START=1 npm run dev` startup PASS

Observed:
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`

### 3.2 Sanitized probe results
Observed with flag false:

#### AccountsPage
- sanitized compact probe result returned

#### CreatePostPage
- sanitized compact probe result returned
- no publish action occurred

#### BulkCreatePage
- `exactBlockedMessageVisible=true`
- `modalVisible=false`
- `createdPostDelta=0`
- `jobCountDelta=0`
- `pendingBefore=0`
- `pendingAfter=0`

#### PostsPersistedBulkReview
- `exactBlockedMessageVisible=true`
- `modalVisible=false`
- `createdPostDelta=0`
- `jobCountDelta=0`
- `pendingBefore=0`
- `pendingAfter=0`

Interpretation:
- blocked behavior remains intact when real publish is disabled
- no queue job was created by the probe
- no real publish path was executed

## 4. Continuation In Phase 18.1
The remaining blocker from Phase 18 was resolved in **Phase 18.1** by adding:

- `scripts/snapshot-posts.mjs`

Phase 18.1 completed:
- safe local-only current workspace snapshot capture
- clean process exit without stalling
- current workspace evidence for post `#14`, `#15`, and `#6`
- effective `needs_verification` interpretation for `fb_sim_*` legacy evidence
- low-risk Vite watch ignore for `release/**`

## 5. Safety Result
Preserved:
- no OAuth flow change
- no scope narrowing
- no token exposure
- no callback URL exposure in adjusted logs
- no secret exposure
- no fake success
- no remote Facebook edit/delete
- no auto-publish
- no real publish test execution

## 6. Files Changed In Phase 18 / 18.1 Lineage
Phase 18 changed:
- `electron/main.ts`
- `src/pages/BulkCreatePage.tsx`
- `src/pages/PostsPage.tsx`
- `src/pages/AccountsPage.tsx`

Phase 18.1 added/changed:
- `scripts/snapshot-posts.mjs`
- `vite.config.ts`

Docs updated across the lineage:
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_18_PROBE_EVIDENCE_CLEANUP_REPORT.md`
- `docs/PHASE_18_1_RUNTIME_SNAPSHOT_UTILITY_REPORT.md`

## 7. Restore Points
Phase 18 restore point:
- `_backups/phase-18-probe-evidence-cleanup-runtime-snapshot-20260616-1905`

Phase 18.1 restore point:
- `_backups/phase-18-1-runtime-snapshot-utility-20260616-1934`

## 8. Recommended Next Task
Recommended next phase:
- **Phase 19 — Safe Diagnostics Consolidation + Probe Coverage Completion**

Candidate scope:
- extend Create Post probe for exact blocked sentence verification
- unify probe evidence and snapshot evidence into Diagnostics-safe views
- preserve `FACEBOOK_REAL_PUBLISH_ENABLED=false` as the default safe baseline
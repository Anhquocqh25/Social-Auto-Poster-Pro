# Phase 18.1 — Runtime Snapshot Utility + Safe Evidence Capture Hardening Report

## 1. Goal
Phase 18.1 resolves the remaining Phase 18 blocker by introducing a safe local-only runtime snapshot utility that captures current workspace post/job/attempt evidence without stalling.

Safe boundary preserved:

```env
FACEBOOK_REAL_PUBLISH_ENABLED=false
```

## 2. Backup / Restore Point
Created:
- `_backups/phase-18-1-runtime-snapshot-utility-20260616-1934`

## 3. Files Changed
- `scripts/snapshot-posts.mjs`
- `vite.config.ts`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_18_PROBE_EVIDENCE_CLEANUP_REPORT.md`
- `docs/PHASE_18_1_RUNTIME_SNAPSHOT_UTILITY_REPORT.md`

## 4. Snapshot Utility Result
Added:
- `scripts/snapshot-posts.mjs`

Command:
```bash
node scripts/snapshot-posts.mjs 14 15 6
```

Utility characteristics:
- Prisma local reads only
- no DB mutation
- compact sanitized JSON output
- explicit `$disconnect()`
- explicit clean process exit
- no full object dumps
- no token/secret exposure
- no callback/OAuth exposure

Output includes per post:
- `postId`
- `found`
- raw `status`
- `effectiveStatus`
- `needsVerification`
- `hasErrorMessage`
- `publishedAtPresent`
- `mediaType`
- safe target summaries
- `platformPostIdSuffix`
- `hasFbSimEvidence`
- `jobCount`
- `pendingJobCount`
- `processingJobCount`
- `activeJobCount`
- `successfulJobCount`
- `failedJobCount`
- `attemptCount`
- `successfulAttemptCount`
- `latestSafeErrorMessage`

## 5. Stall Fix Result
Previous local snapshot attempts using ad hoc DB access stalled in the environment.

Resolved by:
- replacing ad hoc snapshot attempts with a dedicated Prisma-based local-only script
- ensuring:
  - no Electron runtime dependency
  - explicit `await prisma.$disconnect()`
  - explicit clean exit in `.finally()`

Result:
- `node scripts/snapshot-posts.mjs 14 15 6` executed successfully
- script exited cleanly
- no stall occurred

## 6. Current Post #14 Snapshot Result
Current workspace DB snapshot for post `#14`:
- found: yes
- raw status: `published`
- effective status: `published`
- needs verification: `false`
- publishedAt present: yes
- mediaType: `none`
- target page name: `Nguyễn Khắc Anh.Quốc`
- target status: `success`
- platformPostId suffix only: `••339179`
- `fb_sim_*` evidence: `false`
- job count: `1`
- pending job count: `0`
- processing job count: `0`
- active job count: `0`
- successful job count: `1`
- failed job count: `0`
- attempt count: `1`
- successful attempt count: `1`
- latest safe error message: `null`
- duplicate active jobs: `false`

## 7. Current Post #15 Snapshot Result
Current workspace DB snapshot for post `#15`:
- found: yes
- raw status: `published`
- effective status: `published`
- needs verification: `false`
- publishedAt present: yes
- mediaType: `none`
- target page name: `Nguyễn Khắc Anh.Quốc`
- target status: `success`
- platformPostId suffix only: `••339179`
- `fb_sim_*` evidence: `false`
- job count: `1`
- pending job count: `0`
- processing job count: `0`
- active job count: `0`
- successful job count: `1`
- failed job count: `0`
- attempt count: `1`
- successful attempt count: `1`
- latest safe error message: `null`
- duplicate active jobs: `false`

## 8. Current Post #6 Snapshot Result
Current workspace DB snapshot for post `#6`:
- found: yes
- raw status: `published`
- effective status: `needs_verification`
- needs verification: `true`
- publishedAt present: yes
- mediaType: `none`
- target page name: `Nguyễn Khắc Anh.Quốc`
- target status: `success`
- platformPostId suffix only: `fb_sim_text_1781092619862`
- `fb_sim_*` evidence: `true`
- job count: `1`
- pending job count: `0`
- processing job count: `0`
- active job count: `0`
- successful job count: `1`
- failed job count: `0`
- attempt count: `1`
- successful attempt count: `1`
- latest safe error message:
  - `Local snapshot indicates fb_sim_* evidence on a real Facebook target.`
- duplicate active jobs: `false`

This preserves the required safety interpretation:
- `fb_sim_*` does not count as real Facebook success
- old post `#6` remains effectively `needs_verification`

## 9. Historical vs Current Workspace Note
Important:
- Historical Phase 16.6 snapshot and current workspace DB snapshot may differ if `dev.db` was reset, copied, or restored.
- Current workspace DB state must not be treated as historical truth automatically.

## 10. Safety Regression Recheck Result
Verified with:

```bash
FACEBOOK_UI_ASSERT_ON_START=1 npm run dev
```

Observed:
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`

Probe results:

### BulkCreatePage
- `exactBlockedMessageVisible=true`
- `modalVisible=false`
- `createdPostDelta=0`
- `jobCountDelta=0`
- `pendingBefore=0`
- `pendingAfter=0`
- `activeBefore=0`
- `activeAfter=0`

### PostsPersistedBulkReview
- `exactBlockedMessageVisible=true`
- `modalVisible=false`
- `createdPostDelta=0`
- `jobCountDelta=0`
- `pendingBefore=0`
- `pendingAfter=0`
- `activeBefore=0`
- `activeAfter=0`

Meaning:
- blocked flow remains correct with flag false
- no modal final confirm opened in blocked flow
- no queue job was created
- no real publish occurred

## 11. Packaging / Dev Reload Noise Result
Observed:
- `npm run build` writes packaging artifacts into `release/`
- those artifacts triggered noisy Vite reload events during active dev sessions

Low-risk mitigation applied:
- `vite.config.ts`
  - `server.watch.ignored = ['**/release/**']`

Result:
- dev watcher ignores packaging output under `release/**`
- build and packaging targets remain unchanged

## 12. Build / Runtime Result
Verified:
- `npx tsc --noEmit` PASS
- `npm run build` PASS
- `node scripts/snapshot-posts.mjs 14 15 6` PASS
- `FACEBOOK_UI_ASSERT_ON_START=1 npm run dev` startup PASS

Observed:
- app starts
- queue starts
- scheduler starts
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- no real publish occurred

## 13. Safety / Security Result
Confirmed:
- no access token exposure
- no refresh token exposure
- no page token exposure
- no encrypted token exposure
- no App Secret exposure
- no OAuth code exposure
- no callback URL exposure
- no raw OAuth state exposure
- no tokenized Graph URL exposure

The snapshot utility prints only sanitized safe evidence.

## 14. Preserved Functionality Result
Preserved:
- single real text publish implementation
- single real image publish implementation
- controlled bulk publish implementation
- persisted-post review on `PostsPage`
- Create Post
- Bulk Create
- CSV import
- per-row media
- View created posts
- Posts detail
- attempt timeline
- Accounts/Pages
- Diagnostics
- scheduler/queue
- VI/EN switcher
- Vietnamese default
- `FACEBOOK_REAL_PUBLISH_ENABLED=false`
- `fb_sim_*` never counts as real success

## 15. Known Limitations
- `CreatePostPage` probe still reports compact banner state rather than the full exact blocked sentence
- packaging warnings about missing author/category/icon remain non-blocking metadata warnings
- old pre-utility stalled terminal attempts may still remain in terminal history, but the new snapshot utility itself exits cleanly

## 16. Revert Instructions
Revert:
- `scripts/snapshot-posts.mjs`
- `vite.config.ts`
- `CURRENT_TASK.md`
- `PROJECT_STATE.md`
- `docs/RUNTIME_TEST_REPORT.md`
- `docs/PHASE_18_PROBE_EVIDENCE_CLEANUP_REPORT.md`
- `docs/PHASE_18_1_RUNTIME_SNAPSHOT_UTILITY_REPORT.md`

Or restore from:
- `_backups/phase-18-1-runtime-snapshot-utility-20260616-1934`

Then re-run:
```bash
npx tsc --noEmit
npm run build
node scripts/snapshot-posts.mjs 14 15 6
FACEBOOK_UI_ASSERT_ON_START=1 npm run dev
```

## 17. Recommended Next Task
Recommended next phase:
- **Phase 19 — Safe Diagnostics Consolidation + Probe Coverage Completion**

Candidate scope:
- extend Create Post probe to verify the exact blocked sentence
- unify probe evidence and snapshot evidence into safer Diagnostics-facing tools
- continue preserving `FACEBOOK_REAL_PUBLISH_ENABLED=false` as the default safe boundary
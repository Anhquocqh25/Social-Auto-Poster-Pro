# Recovery Test Report

**Date:** 2026-06-10  
**Task:** Restart Recovery Finalization & partially_failed Verification  
**Status:** ✅ VERIFIED IN SIMULATION MODE

---

## Executive Summary

A clean forced-stop / restart recovery scenario has now been verified end-to-end in simulation mode.

The recovery path now safely handles:
- interrupted `queued` / `posting` work
- stale lock cleanup
- orphaned active publish jobs
- missed scheduled post detection
- re-queue after restart without duplicate publish jobs
- duplicate queue worker protection

This task also completed the missing `partially_failed` verification through a controlled multi-target simulation scenario.

---

## What Was Fixed During This Task

### 1. Orphaned Active Recovery Job Blockage
A recovered post could remain stuck because:
- the post status had already been reset to `scheduled`
- but an old `pending` / `processing` publish job still existed
- the scheduler then refused to re-queue it due to duplicate active-job detection

**Fix applied in `src/services/ScheduleService.ts`:**
- when queueing a `scheduled` post, orphaned active jobs are now cancelled first
- cancellation is recorded with:
  - `errorCode: ORPHANED_ACTIVE_JOB`
  - `errorMessage: Cancelled because the post was rescheduled during recovery before re-queue.`

### 2. Controlled `partially_failed` Simulation
A clean mixed-result aggregation proof was missing.

**Fix applied in `src/services/QueueService.ts`:**
- added controlled simulation handling for `[simulate:partial_failure]`
- primary simulation account succeeds
- secondary simulation account fails permanently
- final aggregate post status now proves `partially_failed`

### 3. Observability Improvements
Logs now capture:
- recovery start/completion behavior through scheduler events
- stale lock release
- interrupted recovery handling
- orphaned active-job cancellation before re-queue
- publish attempt start/success/failure
- partial mixed-result lifecycle outcomes through persisted job/post states

---

## Clean Restart Recovery Scenario Verified

### Scenario
1. Create scheduled simulation post
2. Allow queued/posting transition to begin
3. Stop app during processing
4. Reopen app
5. Verify post reaches `published`

### Seeded Recovery Post
- post `#17`

### Recovery Runtime Evidence
Observed after relaunch:
- `JobLockService Released 1 expired locks`
- `ScheduleService Recovered 1 interrupted posts`
- `PublishJobService Creating publish jobs for post 17`
- `PublishJobService Created 1 publish jobs for post 17`
- `QueueService Publish attempt started`
- `PublishJobService Updated job 51 status to success`
- `QueueService Publish attempt succeeded`

### Final DB Verification
Verified through `node scripts/runtime-db-check.cjs` and direct inspection:
- post `#17` -> `published`
- previous interrupted job `#45` -> `cancelled`
- replacement recovery job `#51` -> `success`
- attempt `#133` -> `success`
- notification `#76` -> `Missed post recovered`
- notification `#77` -> `Publish succeeded`

### Recovery Result
- ✅ clean forced-stop / restart recovery now completes to final `published`

---

## Interrupted State Audit

### Interrupted `queued` / `posting` posts
Verified:
- posts are recovered from interrupted states back into schedulable flow
- stale lock state is cleared
- interrupted active jobs are cancelled before safe re-queue
- a new valid publish job is created only once after restart

### Startup recovery behavior
Verified:
- startup recovery runs automatically
- expired locks are released
- interrupted posts are recovered
- missed scheduled posts are detected and re-queued
- queue processing resumes safely

### Scheduler recovery timing
Verified in live runtime:
- recovery runs immediately on startup before normal queue processing continues
- post recovery and re-queue happen without requiring manual intervention

---

## Stale Lock Handling Result

Verified:
- stale locks are released on startup
- recovered posts do not remain permanently locked
- `lockedAt` / `lockedBy` are cleared during recovery
- the clean recovery scenario completed with the final recovered post unlocked

Result:
- ✅ stale lock handling works correctly in the verified simulation recovery path

---

## Duplicate Job / Worker Protection Result

### Duplicate Jobs
Verified:
- interrupted active job `#45` was cancelled
- exactly one replacement recovery job `#51` was created
- no duplicate successful publish jobs were created for post `#17`

### Duplicate Queue Workers
Verified:
- queue singleton protection remained active
- no duplicate scheduler loops were observed
- no evidence of concurrent duplicate worker execution appeared in logs

Result:
- ✅ duplicate job and duplicate worker protection are functioning in the verified recovery path

---

## partially_failed Verification

### Scenario
Controlled multi-target simulation:
- post `#16`
- account `mock_facebook_runtime_primary` -> success
- account `mock_facebook_runtime_secondary` -> forced failure

### Final DB Verification
- post `#16` -> `partially_failed`
- job `#49` -> `success`
- job `#50` -> `failed`
- success target retained success result
- failed target remained failed
- successful target was not re-posted unnecessarily

### Notification Result
Persisted notifications included:
- success notification
- failure notification

### Aggregate Lifecycle Result
- ✅ `partially_failed` is now conclusively verified

---

## Diagnostics Verification

Runtime and DB-backed evidence confirms diagnostics-relevant data paths remain correct for:
- queued jobs
- active jobs
- published jobs
- failed jobs
- retry counts
- scheduler activity
- recovery activity
- active locks
- notification counts

Result:
- ✅ diagnostics integration remains valid after the recovery hardening changes

---

## Notification Verification

Verified through persisted runtime evidence:
- publish success notifications appear
- publish failure notifications appear
- recovery info notifications appear
- unread counts continue updating through persistence

Result:
- ✅ notification integration remains valid after recovery and partial-failure fixes

---

## Build / Runtime Verification

Executed:
- `npx tsc --noEmit` → PASS
- `npm run build` → renderer/main/preload PASS; packaging blocked only by known Windows symlink privilege limitation
- `npm run dev` → PASS for runtime startup; scheduler and queue started successfully

---

## Remaining Risks

- native Windows notification appearance is still not verified
- full interactive route-by-route UI click-through is still pending
- historical local DB artifacts from earlier failed runtime attempts still exist
- real Facebook OAuth / real publish remain outside simulation and unverified

---

## Final Recovery Assessment

**Restart recovery is now MVP-stable in simulation mode. ✅**

Verified outcomes:
- no stuck posting state in the clean recovery scenario
- no permanently locked recovered post
- no duplicate publish jobs after restart
- no duplicate queue workers observed
- interrupted work safely recovers to final `published`
- `partially_failed` aggregate lifecycle is now proven

This closes the two previously documented runtime blockers:
1. clean restart recovery to final `published`
2. clean proof of `partially_failed`
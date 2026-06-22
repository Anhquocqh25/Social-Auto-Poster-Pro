# Publish Lifecycle Report

**Date:** 2026-06-10  
**Phase:** Phase 5 - Facebook Integration & Simulated Mode  
**Mode:** Simulation only

## Objective
Verify the full runtime publishing lifecycle end-to-end in simulation mode:

Create Post  
→ Schedule Post  
→ Queue Job  
→ Scheduler Trigger  
→ Publish Attempt  
→ Publish Result  
→ Notification  
→ Diagnostics Update  
→ Final Status Update

## Commands Executed
- `npx tsc --noEmit`
- `npm run build`
- `node scripts/runtime-simulation.cjs`
- `npm run dev`
- `node scripts/runtime-db-check.cjs`

## Build / Runtime Verification
- `npx tsc --noEmit` → PASS
- `npm run build` → renderer/main/preload PASS; packaging blocked by known Windows symlink privilege limitation
- `npm run dev` → PASS for live runtime startup
  - Vite starts
  - Electron main process starts
  - scheduler starts
  - queue starts

## Scenarios Tested

### 1. Success Publish
Seeded post:
- post `#8`

Expected:
- `scheduled -> queued -> posting -> published`

Observed:
- final post state: `published`
- publish job reached `success`
- success notification persisted

Result:
- ✅ VERIFIED

### 2. Retry Once Then Success
Seeded post:
- post `#9`

Simulation control:
- `[simulate:retry_once]`

Expected:
- first attempt fails
- retry notification appears
- later retry succeeds
- final post state becomes `published`

Observed:
- retry warning notification persisted
- final post state: `published`

Result:
- ✅ VERIFIED

### 3. Permanent Failure
Seeded post:
- post `#10`

Simulation control:
- `[simulate:always_fail]`

Expected:
- final state becomes `failed`
- failure notification appears
- no infinite retries

Observed:
- final post state: `failed`
- failure notification persisted
- permanent failure now settles correctly

Result:
- ✅ VERIFIED

### 4. Multi-Target Failure Aggregation
Seeded post:
- post `#11`

Expected:
- multi-target lifecycle verifies aggregation behavior
- final outcome should demonstrate failure handling across targets

Observed:
- both target jobs failed
- post settled to `failed`
- multiple failure notifications persisted

Result:
- ✅ VERIFIED
- mixed-target simulation now proves `partially_failed` with one successful target and one failed target

### 5. Restart Recovery
Seeded post:
- post `#12`

Expected:
- interrupted/recovered post should return safely to schedulable flow
- should eventually complete to `published`

Observed:
- app was force-stopped during interrupted processing state
- app relaunched cleanly
- startup recovery executed
- stale lock was released
- interrupted active job was cancelled
- post was re-queued once
- replacement recovery job completed successfully
- final post state reached `published`

Result:
- ✅ VERIFIED

## Lifecycle Transitions Verified

### Verified
- `scheduled -> queued`
- `queued -> posting`
- `posting -> published`
- `posting -> failed`

### Partially Verified
- retry progression back to successful completion

### Not Fully Proven In This Session
- `cancelled` as a user-visible business lifecycle endpoint

## Queue Behavior Verification

### Verified
- queue starts correctly in live runtime
- jobs are created from scheduled posts
- duplicate queue creation protection remains active
- retry warnings persist
- failure notifications persist
- forced permanent failures no longer loop endlessly
- new publish attempts now record correct attempt numbers

### Bugs Found
1. `attemptNumber` became `NaN`
   - cause: `retryCount` was not returned by `PublishJobService.getPendingJobs()`
   - effect: Prisma `publishAttempt.create()` failed in live runtime

2. permanent simulation failures retried incorrectly
   - effect: permanent failure scenarios did not settle cleanly

3. restart recovery active-job blockage
   - recovered post could remain blocked from safe re-queue completion

4. no deterministic mixed-result verification path
   - `partially_failed` could not be conclusively proven in the earlier all-failure multi-target scenario

### Bugs Fixed
1. added `retryCount` to pending jobs
2. corrected publish-attempt numbering and queue logs
3. added deterministic simulation failure directives
4. made forced permanent simulation failures non-retryable
5. cancelled interrupted active jobs during startup recovery before safe re-queue
6. cancelled orphaned active jobs before re-queue when a post was already back in `scheduled`
7. added deterministic `[simulate:partial_failure]` mixed-target verification

## Diagnostics Integration Result
Diagnostics data path remains functionally active and relevant.

Confirmed backend/runtime coverage includes:
- scheduler running state
- queue counts
- failed attempts
- active locks
- unread notifications
- last successful publish
- last failed publish
- recovery metrics
- memory usage

Result:
- ✅ Diagnostics integration works at the data-path level
- ⚠️ Final in-window visual sign-off is still recommended

## Notification Integration Result
Confirmed during runtime verification:
- success notifications persisted
- retry warning notifications persisted
- failure notifications persisted
- unread notifications accumulated in persistence
- notification system remained connected to real runtime activity

Result:
- ✅ Notification integration works for success / retry / failure persistence
- ⚠️ Native Windows notification appearance remains unverified

## Restart Recovery Result
Recovery handling improved during this task:
- interrupted active jobs are now cancelled during recovery
- safer re-queue preparation exists
- duplicate prevention remains active

Result:
- ✅ clean forced-stop / restart recovery now completes to final `published`

## Remaining Risks
- local DB still contains artifacts from the earlier failed `attemptNumber: NaN` runtime run
- native Windows notification appearance is still not verified
- full route-by-route live visual QA is still pending
- real Facebook OAuth remains outside simulation and still unverified

## MVP Usability Assessment
### What is MVP-usable now
- simulation-mode scheduling
- queue processing
- success publishing flow
- retry flow
- failure flow
- persistence-backed notification generation
- diagnostics-backed runtime inspection
- compile/build/runtime startup health

### What is not fully MVP-signed-off yet
- real Facebook OAuth / real publish verification
- final interactive UI QA sign-off

## Honest Conclusion
End-to-end publishing is **MVP-stable in simulation mode**.

Reason:
- the core publish lifecycle now works for success, retry, permanent failure, and partial failure
- diagnostics and notifications are integrated
- clean forced-stop / restart recovery now completes to final `published`
- major runtime bugs found during testing were fixed

Broader non-simulation MVP sign-off still depends on:
- real Facebook OAuth / publishing verification
- final live interactive UI sign-off

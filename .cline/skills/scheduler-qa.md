# scheduler-qa

## Purpose
Validate scheduling, queue processing, retry logic, duplicate prevention, stale locks, missed jobs, restart recovery, and status transitions.

## When to Use
Use this skill when:
- changing scheduler logic
- modifying queue processing behavior
- adding or changing retry rules
- debugging duplicate job creation or stuck jobs
- changing lock acquisition/release behavior
- validating missed scheduled jobs or recovery behavior
- reviewing post/job/attempt status transitions before completion

## Checklist
- [ ] Verify scheduler startup behavior
- [ ] Verify scheduler stop/shutdown behavior
- [ ] Verify due scheduled posts are discovered
- [ ] Verify queue jobs are created once per eligible target
- [ ] Verify duplicate queue prevention logic
- [ ] Verify lock acquisition and lock release behavior
- [ ] Verify stale/expired lock cleanup path
- [ ] Verify retry increments and next retry scheduling
- [ ] Verify failure path records attempts and errors
- [ ] Verify success path updates related records
- [ ] Verify restart recovery path for interrupted work
- [ ] Verify missed scheduled posts can be recovered
- [ ] Verify post/job/attempt status transitions stay consistent
- [ ] Summarize remaining correctness gaps

## Commands to Run
```bash
npx tsc --noEmit
npm run electron:dev
node scripts/runtime-simulation.cjs
node scripts/runtime-db-check.cjs
```

Optional:
```bash
npm run build
```

## Common Failure Cases
- scheduler interval starts twice
- queue worker starts twice
- jobs remain stuck in `pending` or `processing`
- retries never increment or retry forever
- post status does not reflect aggregate job outcome
- locks remain after completion or crash
- missed posts are not recovered after startup
- duplicate jobs created for one post/account target
- recovery resets state incorrectly on restart

## Expected Output / Report Format
```md
## Scheduler QA Report
### Scope
- scheduler / queue / retry / recovery areas reviewed

### Verified
- startup
- queueing
- retries
- locks
- recovery
- status transitions

### Failures / Gaps
- exact incorrect behavior observed

### Evidence
- logs, DB checks, or runtime observations

### Decision
- pass / partial / fail
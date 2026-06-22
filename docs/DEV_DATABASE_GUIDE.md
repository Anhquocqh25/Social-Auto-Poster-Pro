# Dev Database Guide

**Phase:** 5.9 — Production Readiness Cleanup  
**Scope:** Local development database only

## Purpose
Provide a safe, repeatable workflow for resetting and seeding the local development database used by `social-auto-poster-pro`.

This guide is intentionally limited to the local SQLite development database:

- `prisma/dev.db`

It does **not** target production data.

---

## Safety Rules
- Only the local SQLite file at `prisma/dev.db` is reset by the provided workflow.
- The reset command requires explicit confirmation through the script implementation.
- No network, cloud, or remote database target is involved in this workflow.
- Use this workflow only for local development / demo preparation.

---

## Available Commands

### 1. Reset the development database
```bash
npm run db:reset:dev
```

What it does:
- deletes `prisma/dev.db` if it exists
- recreates the schema with:
  - `npx prisma db push --skip-generate`

Safety behavior:
- the underlying script only targets `prisma/dev.db`
- no other database path is touched

---

### 2. Seed predictable demo data
```bash
npm run db:seed:demo
```

What it creates:
- simulation scheduler settings
- two simulation Facebook demo accounts
- one success scenario
- one retry-once scenario
- one permanent-failure scenario
- one `partially_failed` mixed-target scenario
- one restart-recovery scenario seed

---

### 3. Run a clean simulation demo seed flow
```bash
npm run demo:simulation
```

What it does:
1. resets the local dev database
2. recreates schema
3. seeds predictable simulation demo data

This is the preferred starting point for a clean MVP simulation demo.

---

## Expected Seeded Demo Dataset

### Accounts
The demo seed creates:
- `mock_facebook_demo_primary`
- `mock_facebook_demo_secondary`

### Posts
The demo seed creates:
1. success publish post
2. retry-once then success post
3. permanent failure post
4. `partially_failed` mixed-target post
5. restart-recovery seed post

These seeded posts are intentionally aligned with the already-verified simulation flows.

---

## Recommended Developer Workflow

### Clean demo preparation
```bash
npm run demo:simulation
npm run dev
```

Then:
- open the Electron app
- verify Accounts page shows simulation accounts
- verify Posts / Diagnostics / Notifications update as processing occurs

### Recovery scenario follow-up
After seeding:
1. let processing begin
2. stop the app during the recovery seed scenario
3. relaunch with `npm run dev`
4. verify recovery completes to `published`

---

## Verification Commands
After reset/seed:
```bash
node scripts/runtime-db-check.cjs
```

This provides a current local snapshot of:
- post counts
- job counts
- attempt counts
- notification counts
- latest post/job/attempt rows

---

## Current Script Files

### Active / useful
- `scripts/dev-db-reset.cjs`
- `scripts/dev-demo-seed.cjs`
- `scripts/runtime-db-check.cjs`
- `scripts/runtime-simulation.cjs`
- `scripts/restart-recovery-test.cjs`
- `scripts/test-settings-persistence.cjs`

### Temporary / debugging-oriented
- `scripts/inspect-post-12.cjs`

This helper is useful for direct local investigation, but is not part of the normal MVP demo workflow.

---

## Known Limitation
The reset/seed workflow prepares the local database only. It does not:
- verify real Facebook OAuth
- verify real Facebook delivery
- clear every historical artifact outside the reset path if the app is still holding a live DB connection

For the cleanest results:
1. stop active app processes
2. run `npm run demo:simulation`
3. relaunch the app

---

## Honest Conclusion
The project now has a safe and predictable local development database workflow for:
- reset
- schema recreation
- demo seeding
- clean simulation MVP setup

This is sufficient for the next phase of cleanup and demo readiness before moving toward real Facebook integration.
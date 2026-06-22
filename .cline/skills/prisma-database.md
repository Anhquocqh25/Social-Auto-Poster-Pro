# prisma-database

## Purpose
Review Prisma schema, migrations, SQLite persistence, CRUD integrity, relations, indexes, and data consistency.

## When to Use
Use this skill when:
- changing Prisma schema models or relations
- adding migrations or persistence fields
- debugging missing or incorrect stored data
- validating CRUD flows after service changes
- checking SQLite persistence behavior in runtime testing
- reviewing integrity of counts, statuses, or related records

## Checklist
- [ ] Review affected Prisma models and enums
- [ ] Check relations and foreign-key intent
- [ ] Check whether indexes are needed for queried fields
- [ ] Verify migrations and schema are aligned with code usage
- [ ] Verify create/update flows populate required fields
- [ ] Verify delete behavior does not orphan required records
- [ ] Verify relation queries match schema shape
- [ ] Verify status/count queries reflect expected data semantics
- [ ] Verify SQLite persistence path is intentional
- [ ] Verify runtime scripts and services read/write the same database
- [ ] Check for consistency gaps between related tables
- [ ] Summarize data integrity risks or migration gaps

## Commands to Run
```bash
npx prisma validate
npx tsc --noEmit
node scripts/runtime-db-check.cjs
```

Optional:
```bash
npx prisma generate
npm run build
```

## Common Failure Cases
- schema fields used in code but missing in Prisma client
- relation names drift from service query assumptions
- counts query uses the wrong table or field semantics
- status fields updated in one table but not related tables
- missing indexes cause slow or fragile queries
- runtime uses a different SQLite database than expected
- migrations are not applied before runtime validation
- nullable fields are treated as always present in code

## Expected Output / Report Format
```md
## Prisma / Database Review
### Scope
- models, relations, queries, scripts reviewed

### Verified
- schema validity
- CRUD integrity
- relation integrity
- persistence consistency

### Risks
- missing migration, relation mismatch, consistency issue, or indexing gap

### Decision
- pass / pass with caveats / needs schema or service fix
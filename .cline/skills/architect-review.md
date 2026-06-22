# architect-review

## Purpose
Review architecture before and after major changes. Check modularity, maintainability, service boundaries, dependency direction, and scalability.

## When to Use
Use this skill when:
- introducing a new feature that touches multiple modules
- changing service boundaries or ownership
- adding new Electron main/preload/renderer integrations
- restructuring data flow across pages, services, or persistence
- reviewing whether a change increased coupling or reduced maintainability
- validating architecture before task completion for medium or large changes

## Checklist
- [ ] Identify the modules involved in the change
- [ ] Confirm responsibilities are clearly separated
- [ ] Check dependency direction stays intentional
- [ ] Verify renderer does not reach privileged logic directly
- [ ] Verify main-process logic is not leaking UI concerns
- [ ] Verify services remain cohesive and not overgrown
- [ ] Check whether shared types are centralized appropriately
- [ ] Review whether business logic is duplicated across files
- [ ] Review whether database access is concentrated in service layers
- [ ] Check whether the change makes future platform expansion harder
- [ ] Check whether testing/runtime verification points are still practical
- [ ] Summarize architecture risks introduced or removed

## Commands to Run
```bash
npx tsc --noEmit
npm run build
```

Optional inspection commands:
```bash
git diff --stat
git diff
```

## Common Failure Cases
- renderer imports main-process-only code
- preload exposes too much surface area
- service files mix UI formatting with business logic
- a single service owns unrelated responsibilities
- circular dependencies begin to appear
- direct Prisma calls spread into renderer-facing code
- feature logic becomes tightly coupled to one platform implementation
- types are duplicated instead of shared

## Expected Output / Report Format
```md
## Architecture Review
### Scope
- files/modules reviewed

### Findings
- boundaries kept / violated
- dependency direction status
- modularity and maintainability notes
- scalability concerns

### Risks
- itemized architecture risks

### Decision
- pass / pass with caveats / needs refactor
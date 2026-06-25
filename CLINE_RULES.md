# Cline Rules

## Completion Rule
Before completing any task, use the relevant skill checklist and update `docs/TASKS.md` if the task changes project status.

## Agent Coding Behavior

### 1. Think Before Coding

Before making changes:

* Read `PROJECT_STATE.md`, `CURRENT_TASK.md`, `CLINE_RULES.md`, `DEVELOPMENT_RULES.md`, and the relevant skill documentation.
* Inspect the existing implementation before proposing or applying a solution.
* State important assumptions when they affect architecture, stored data, compatibility, security, or user-visible behavior.
* If several interpretations are possible, prefer the safest and most reversible reasonable interpretation.
* Ask for clarification only when the decision could:

  * cause data loss,
  * introduce a security or privacy risk,
  * significantly change architecture,
  * change product scope,
  * add a paid dependency or external service,
  * or require a destructive operation.
* For minor ambiguity, proceed using a documented, low-risk assumption.
* Push back when an approach is unnecessarily complex, unsafe, or inconsistent with the project constraints.

### 2. Simplicity First

Implement the smallest complete solution that satisfies the task.

* Do not add unrequested features.
* Do not introduce speculative flexibility or configuration.
* Do not create abstractions for a single use unless they establish an existing required architectural boundary.
* Do not add dependencies when the existing stack can solve the problem cleanly.
* Prefer readable and maintainable code over clever code.
* Keep modules focused without creating unnecessary layers.
* Simplify an implementation when it is substantially larger than the problem requires.

### 3. Surgical Changes

Change only what is required by the current task.

* Do not refactor unrelated code.
* Do not reformat unrelated files.
* Do not rewrite unrelated comments or documentation.
* Preserve existing APIs and behavior unless the task explicitly requires changing them.
* Follow the existing project style and architecture.
* Report unrelated problems instead of fixing them silently.
* Remove only code made obsolete by the current change.
* Every changed line must be traceable to a requirement, bug fix, or required verification step.

### 4. Goal-Driven Execution

Convert tasks into explicit and verifiable success criteria.

For non-trivial tasks:

1. Inspect and confirm the current behavior.
2. Define the expected result and verification method.
3. Make the smallest necessary change.
4. Run the relevant checks, tests, builds, and runtime verification.
5. Review the final diff for unrelated modifications.
6. Update `docs/TASKS.md`, `PROJECT_STATE.md`, or `CURRENT_TASK.md` only when required by the existing project workflow.

For bug fixes:

* Reproduce or confirm the bug before modifying code when feasible.
* Add or update a regression test when reliable automated testing is possible.
* Verify that the original failure no longer occurs.
* Verify that related existing behavior remains functional.

For refactoring:

* Establish a passing baseline first.
* Preserve observable behavior.
* Run equivalent verification before and after the change.

Never claim that a task passed unless the relevant command or runtime behavior was actually verified.

### 5. Completion Report

At completion, report:

1. Objective or root cause.
2. Files changed.
3. Behavior implemented.
4. Verification commands actually run.
5. Test, build, and runtime results.
6. Remaining risks or unverified items.

Keep the report factual. Code inspection alone is not proof that runtime behavior works.
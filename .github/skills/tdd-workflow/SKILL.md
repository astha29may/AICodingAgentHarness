---
name: tdd-workflow
description: >
  Test-driven development workflow: write a failing test, make it pass with minimal code, refactor,
  and verify. Use when implementing a feature or fix, adding tests, or enforcing a write-tests-first
  discipline before production code.
---

# TDD Workflow Skill

## Purpose
Enforce a strict red-green-refactor loop so every behavior is proven by a test before it ships.

## When to use
- Implementing any task from `IMPLEMENTATIONPLAN.md`.
- Fixing a bug (reproduce with a failing test first).
- Adding behavior to existing code.

## The loop (per unit of behavior)
1. **RED** — Write the smallest failing test that describes the desired behavior. Run it. Confirm it fails for the right reason (not a typo/import error).
2. **GREEN** — Write the minimal production code to pass the test. Run it. Confirm green.
3. **REFACTOR** — Improve names, remove duplication, simplify — without changing behavior. Keep tests green.
4. **VERIFY** — Run the full verification loop: build, all tests, lint, typecheck.
5. **REPEAT** — Next behavior.

## Rules
- No production code without a failing test for it first.
- One behavior per cycle; keep diffs small.
- Tests must be deterministic — no reliance on wall-clock time, ordering, or live network unless mocked.
- Cover edge cases and error paths, not just the happy path.
- Match the repo's existing test framework and conventions (see `docs/testing.md`).
- Meet the coverage target defined in `IMPLEMENTATIONPLAN.md`.

## Bug-fix variant
1. Analyze the existing code and identify the **root cause** before changing anything; state it in one line.
2. Write a failing test that reproduces the bug.
3. Fix the root cause *within the existing logic* — do not add a parallel path, wrapper, or patch that masks the symptom and opens a new issue.
4. Confirm no regressions via the full suite.

## Expected commands
Use the project's documented test commands from `docs/testing.md`. If none are documented, discover them from the repo config and record them in `docs/testing.md` (replace any `TODO: Add details`).

## Done when
- The new test(s) pass.
- The full verification loop passes.
- No new lint/type errors elsewhere.

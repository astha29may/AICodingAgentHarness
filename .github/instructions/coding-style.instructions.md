---
description: >
  Coding style and engineering principles that every build agent (coding-agent, frontend-engineer,
  backend-engineer, ai-engineer, data-engineer) must strictly follow when writing or modifying code
  in any module. Design-first, minimal, deterministic, platform-native.
applyTo: "src/**,tests/**,scripts/**,infra/**"
---

# Coding Style & Principles (MANDATORY)

These rules are binding for all code written or modified in this repository. If a request
conflicts with these rules, follow the rules and flag the conflict.

## Purpose
Build and modify code in a design-first way. Always align implementation with design documents
(`DESIGN.md`, `PROBLEMSTATEMENT.md`, `IMPLEMENTATIONPLAN.md`), not ad-hoc assumptions. If code and
design diverge, code follows design.

## Coding Philosophy

### Core Belief
Write the least amount of code that solves the problem correctly. Every line must earn its place.

### Minimal-Change Gate (MANDATORY BEFORE WRITING CODE)
1. **Cleanup first.** If the request can be solved by deleting, reverting, or simplifying existing code, do that instead of adding new code.
2. **No new line without necessity.** Add a line only if the target behavior cannot work correctly without it.
3. **Prove necessity in one sentence.** Before adding non-trivial code, state why an edit/removal-only approach is insufficient.
4. **Prefer in-place fixes.** Modify existing logic instead of introducing parallel paths, replacement modules, or duplicate helpers.
5. **Default to subtraction.** If both options work, prefer the one with fewer moving parts and fewer lines.

### Design Principles
1. **No overengineering.** Think before adding each code block. If it's not needed now, don't write it.
2. **Minimal code.** The smallest implementation that works. No speculative abstractions.
3. **No wrapper classes** that just re-export or delegate without adding value.
4. **No defensive validation** in internal code. Trust input at internal boundaries; validate only at system edges.
5. **Parameterize, don't duplicate.** Domain/variant behavior is config, not separate code per variant.
6. **Use the platform.** Don't build what the platform already provides (hosting, scaling, identity, routing).
7. **Deterministic where possible.** Keep LLMs off the critical computation path when pure functions suffice.
8. **Clear boundaries.** Each component owns its data access; others consume via well-defined interfaces.

### Code Structure
1. Flat is better than nested. Avoid deep class hierarchies.
2. One file per concern, not one file per class.
3. Functions over classes when there's no state.
4. Use dataclasses for data contracts. Reach for frameworks only when they add real value.
5. Match names to design terms exactly. Code should read like the design document.
6. Config files (YAML/JSON) alongside the code that uses them, not in a separate config tree.
7. Tests live next to the code. Unit tests exercise deterministic logic without external connectivity.

### Architecture Patterns To Follow
1. **Design-first:** `DESIGN.md` is written before code. It is the source of truth.
2. **SDK-native:** Use the platform SDK directly (e.g., `azure.ai.projects`, `AIProjectClient`). No custom abstraction layers on top.
3. **Publish + Runtime separation:** Deploy-time code (publishing agents/infra) is separate from runtime code (executing flows).
4. **Shared tools, parameterized behavior:** One set of tools serves all domains. Domain-specific behavior comes from config passed as parameters.
5. **System prompts as files:** Agent instructions are `.md` files loaded at publish/runtime, not hardcoded strings.
6. **Adding a new variant = config, not code.** New domain/agent = new prompt + config files. No tool or infra changes.

## What NOT To Do
1. Do not add abstractions "for extensibility" that aren't needed today.
2. Do not create helper modules for one-time operations.
3. Do not add comments explaining obvious code.
4. Do not add error handling for scenarios that cannot happen internally.
5. Do not generate placeholder/scaffold code. Only write code that runs.
6. Do not duplicate logic across variants. Parameterize instead.
7. Do not introduce frameworks or libraries unless they solve a real, present problem.
8. Do not add docstrings, type annotations, or comments to code you didn't change.

## Change Discipline
1. Make the smallest change that solves the request.
2. Read existing code before modifying. Understand context first.
3. If removing code makes things simpler, remove it.
4. Validate: tests pass, no import errors, syntax clean.
5. Don't leave dead code, unused imports, or stale references.
6. For cleanup-oriented requests (revert, simplify, dedupe, remove), do not add new features, files, or abstractions unless explicitly asked.

## Bug-Fixing Discipline (MANDATORY)
When asked to fix a bug, fix it *within* the existing design — do not bolt on new code that papers
over the symptom and creates a second problem.
1. **Diagnose first.** Read the current code and trace the actual root cause before writing anything.
   State the root cause in one line before you change code.
2. **Fix inside the existing logic.** Resolve it within the existing functions/flow/abstractions.
   Do not add a parallel code path, wrapper, flag, or patch layer to sidestep the real defect.
3. **No symptom-masking.** Do not swallow errors, add a special-case branch, or hardcode a value to
   make the symptom disappear while the underlying cause remains.
4. **No new bug for an old one.** Before finishing, confirm the fix does not break callers, regress
   other behavior, or violate a published `gan-harness/contracts/` interface.
5. **Reproduce, then prove.** Write/keep a failing test that reproduces the bug; the fix makes it pass
   (TDD bug-fix variant). Run the full verification loop.
6. **If the design itself is wrong**, stop and surface it — propose the design change rather than
   silently working around it in code.

## Engineering Best Practices (at system edges)
These apply only at **system boundaries** (public APIs, UI, external/model/data-source calls) — they
do not contradict "no defensive validation in internal code". Inside a trust boundary, stay minimal.
1. **Validate & handle errors at the edge.** Validate untrusted input where it enters; return clear,
   safe errors (no stack traces, secrets, or internal detail leaked to callers/users).
2. **Resilience for external calls.** Set explicit timeouts; use bounded retries with backoff for
   transient failures only; fail gracefully — never hang or retry forever.
3. **Observability.** Emit structured logs at boundaries with a correlation/request id. Never log
   secrets, tokens, or PII.
4. **Dependency hygiene.** Prefer the platform/stdlib. Add a third-party dependency only when it
   solves a real present problem; pin versions; avoid unmaintained packages.
5. **Don't break published contracts.** Changing a `gan-harness/contracts/` interface is a versioned,
   announced change — keep consumers working.

> Security note: these minimalism rules never override the security baseline. Always validate
> system edges, never commit secrets, use managed identity / Key Vault, and guard against the OWASP Top 10.

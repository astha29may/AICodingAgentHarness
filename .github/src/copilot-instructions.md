# Copilot Instructions

## Purpose
Build and modify code in a design-first way. Always align implementation with design documents (DESIGN.md, PROBLEMSTATEMENT.md), not ad-hoc assumptions. If code and design diverge, code follows design.

## My Coding Philosophy

### Core Belief
Write the least amount of code that solves the problem correctly. Every line must earn its place.

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

### Architecture Patterns I Follow
1. **Design-first:** DESIGN.md is written before code. It is the source of truth.
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
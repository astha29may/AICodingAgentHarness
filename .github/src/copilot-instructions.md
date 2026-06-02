# Copilot Instructions

## Purpose
Build and modify this repository in a design-first way. Always align implementation with DESIGN.md, not ad-hoc assumptions.

## Source of Truth
1. `src/vendor_equipment_selection_agent/DESIGN.md` — the architecture bible.
2. `src/vendor_equipment_selection_agent/PROBLEMSTATEMENT_*.md` — domain context.
3. If code and design diverge, code follows design.

## Architecture (Pure Foundry Agent Service)
- All agents are **Prompt Agents** published via Azure AI Foundry Python SDK (`azure.ai.projects`).
- Agent code lives in `agents/publishing.py` (deploy-time) and `agents/runtime.py` (Conversations + Responses API with tool dispatch loop).
- System prompts live as `.md` files alongside domain config (weightage_grid.yaml, scoring_profile.yaml).
- One **shared Azure Function App** (`selection_utilities/`) exposes all deterministic tools as a single MCP server.
- Domain-specific behavior is achieved through **parameterization** (config passed to tools), not separate code per domain.
- KG Conversation Agent (Container App) is consumed via HTTP tool — never called directly from agent logic.
- Adding a new domain = new prompt + 2 YAML config files. No code changes to tools.

## Design Principles (Non-Negotiable)
1. **No overengineering.** Think before adding each code block. If it's not needed, don't write it.
2. **Minimal code.** The smallest implementation that solves the problem. No speculative abstractions.
3. **No wrapper classes** that just re-export or delegate without adding value.
4. **No defensive validation** in internal code. Trust input at internal boundaries; validate only at system edges (the `validate_input` tool).
5. **No separate implementations per domain.** Domain behavior is config, not code.
6. **No custom API layer or orchestration framework.** Foundry handles hosting, scaling, identity, routing.
7. **Deterministic scoring.** No LLM on the critical ranking path. Scoring is a pure function.
8. **Strict A2A boundary.** Selection agents never call KG/SQL/Cosmos/Search directly.

## Coding Style
1. Keep it simple and explicit. Readable > clever.
2. Flat is better than nested. Avoid deep class hierarchies.
3. Use dataclasses for data contracts. No Pydantic unless Function App requires it.
4. Functions over classes when there's no state.
5. One file per concern, not one file per class.
6. Match names to design terms exactly (score_candidates, build_explanation, persist_audit, validate_input).
7. Follow the KG Conversation Agent pattern for SDK usage (AIProjectClient, PromptAgentDefinition, FunctionTool, openai.conversations/responses).

## What NOT To Do
1. Do not add abstractions "for extensibility" that aren't needed today.
2. Do not create helper modules for one-time operations.
3. Do not add comments explaining obvious code.
4. Do not add error handling for scenarios that cannot happen internally.
5. Do not generate placeholder/scaffold code. Only write code that runs.
6. Do not create separate orchestrator logic in Python — the Foundry Prompt Agent IS the orchestrator.
7. Do not duplicate tool logic across domains. Parameterize instead.

## Change Discipline
1. Make the smallest change that solves the request.
2. Read existing code before modifying. Understand context first.
3. If removing code makes things simpler, remove it.
4. Validate: tests pass, no import errors, syntax clean.

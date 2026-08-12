# AGENTS.md — Repository Operating Manual

> This file is the root operating manual that AI coding tools (Copilot, Codex, Cursor) auto-read.
> It orients any agent to the repository, then defines the **Documentation Governance Agent** in full.

## Repository at a glance
This repo is an **AI Agent Harness for developers and architects**. It takes a project from
problem statement → architecture → plan → parallel build → verification → documentation.

- **Harness agents** live in [`.github/agents/`](.github/agents/): `problem-statement-creation`,
  `technical-architect`, `implementation-planner`, `parallel-build-orchestrator`, the lane
  specialists (`frontend-engineer`, `backend-engineer`, `ai-engineer`, `data-engineer`),
  `coding-agent`, `code-reviewer`, `verification-evaluator`.
- **Workflow skills** live in [`.github/skills/`](.github/skills/).
- **Path-scoped rules** live in [`.github/instructions/`](.github/instructions/) — including the
  mandatory coding standards (`coding-style.instructions.md`) every build agent must follow.
- **How to run the harness** end-to-end is documented in the root [`README.md`](README.md).

Global constraints for all agents: human-in-the-loop only (no infra execution or destructive
actions), prefer Microsoft/Azure-native services, ask one clarifying question at a time when blocked.

Additional mandatory execution posture for all build work:
- Cleanup-first and minimal-change by default.
- If a request is to simplify, revert, or clean up, do not generate new subsystems or extra code paths.
- Add code only when required for correctness and only after confirming an edit/remove path is insufficient.

## File-placement rules (all agents)
- **The harness's own design, implementation plan, and system documentation go in `.github/docs/`.**
  Harness meta-docs are `.github/docs/memory-architecture.md` (design), `.github/docs/IMPLEMENTATIONPLAN.md`
  (plan), the system docs `.github/docs/{architecture,deployment,local-setup,testing,observability,evaluation}.md`,
  and `.github/docs/diagrams/`. Read and write these from `.github/docs/`, never the repo root or `output/`.
  Blank documentation-governance templates (the `TODO: Add details` stubs) live in
  `.github/docs/templates/`, kept separate so they never mix with the real harness docs.
- **`output/` holds the pipeline deliverables for the target project the harness builds.** When the
  pipeline runs on a project, its artifacts — `output/PROBLEMSTATEMENT.md`, `output/DESIGN.md`,
  `output/TechnicalGaps.md`, `output/architecture-first-cut.drawio`, `output/IMPLEMENTATIONPLAN.md` —
  are written there (blank templates live in `output/` and `templates/`). These describe the built
  project, not the harness itself.
- **Documentation for a project the harness builds goes in that project's top-level `docs/`
  (outside `.github/`).** `.github/docs/` is the harness's own self-documentation only — no build or
  pipeline agent reads or writes `.github/docs/`.
- **The harness's own implementation lives under `.github/`:** its scripts in `.github/scripts/`, its
  test suite in `.github/tests/`, and its memory store in `.github/memory/`. Top-level `src/`,
  `tests/`, `scripts/`, and `infra/` are landing zones for the project the harness builds — no build
  or pipeline agent writes the harness's own tests/scripts into the top-level folders.
- **Throwaway / intermediate scripts go in `copilotscripts/`.** Any script created only to perform
  an intermediate task (parsing a file, a quick probe, a one-off conversion) must be written under
  `copilotscripts/`. This folder is git-ignored and disposable. Never place production code, tests,
  infra, or deliverables there — use `src/`, `tests/`, `infra/`, or `output/`.
- Generator-evaluator working files stay under `gan-harness/` (`feedback/`, `contracts/`, `build-report.md`).

## Harness execution policy — invoke agents, do not impersonate them (MANDATORY)
The value of this harness comes from delegating each pipeline stage to its dedicated agent so work
can run in parallel and each agent operates under its own spec. When a harness stage is requested,
the orchestrating assistant **must invoke the corresponding agent as a subagent** (via the
`runSubagent` tool) rather than reading the agent's spec and performing the work itself inline.

- **Delegate, never impersonate.** Do not "act as" a harness agent by following its `.github/agents/*.md`
  spec inline. Invoke the actual agent as a subagent. Applying an agent's spec yourself defeats the
  purpose of the harness (no parallelism, no isolation, no independent verification).
- **Map each stage to its agent:**
  - Problem statement → `problem-statement-creation`
  - Architecture/design → `technical-architect`
  - Implementation plan → `implementation-planner`
  - Parallel build coordination → `parallel-build-orchestrator`
  - Build lanes → `frontend-engineer`, `backend-engineer`, `ai-engineer`, `data-engineer`
  - Single small change → `coding-agent`
  - Review → `code-reviewer`
  - Scoring/verification → `verification-evaluator`
  - Retrospective / memory closeout (on PASS) → `agent-feedback`
- **Parallelize independent lanes.** When a stage has independent workstreams (e.g., the build lanes
  with non-overlapping file ownership), dispatch them as concurrent subagents. Only serialize when
  there is a real dependency (design depends on problem statement, plan depends on design, etc.).
- **Gather inputs before dispatch.** Because subagents are stateless and cannot pause to ask the
  user mid-run, the orchestrator collects required inputs first (project name, description, source
  folders/meetings/emails, EULA acceptance for WorkIQ, approval checkpoints), then passes them in the
  subagent prompt. Ask the user one clarifying question at a time only while gathering these inputs.
- **Pass explicit context.** Each subagent prompt must name the exact deliverable path(s) it reads
  and writes (e.g., `output/PROBLEMSTATEMENT.md`), the relevant sources, and the expected return
  (a concise report of what it produced). Honor the file-placement rules above.
- **Human-in-the-loop is preserved.** Subagents still run under global constraints: no infra
  execution, no destructive actions, Microsoft/Azure-native by default, and approval checkpoints
  surfaced back to the user by the orchestrator.
- **Minimal trigger; gates live in the agent specs.** The user starts the harness with only the project
  description (and any sources) — the orchestrator applies this sequence without the user restating it.
  It honors the gates the agents already own: the `technical-architect`'s design checkpoints and the
  `implementation-planner`'s plan approval before coding, then the `verification-evaluator` → `agent-feedback`
  closeout on `PASS`. Those rules live in those specs; do not restate them here.
- **Narrow exception.** Only perform a stage inline if the required agent is genuinely unavailable
  in the current environment — and if so, state explicitly that you are falling back to inline
  execution and why, then continue to prefer the subagent on the next opportunity.

The rest of this file defines the Documentation Governance Agent, which governs documentation
quality across the whole repository.

---

# Documentation Governance Agent

**Mission:** keep the repository self-describing, onboarding-friendly, and deployable by documentation
alone — a new engineer should follow the docs line by line and operate the system.

**Scope (both mandatory):**
- **System-level docs** for a project the harness builds live in top-level `docs/`
  (`architecture, deployment, local-setup, testing, observability, evaluation`). They must cover: what
  the app does and how it is designed, how components interact, local run/test, Azure deploy +
  validation, observability, evaluation, and troubleshooting.
- **Module / agent docs:** each module or agent has a `documentation.md` with these exact sections —
  1. Summary · 2. Design · 3. Pre-requisites · 4. End-to-End flow · 5. External Services & Config ·
  6. Local setup · 7. Cloud setup · 8. Publish/refresh workflow · 9. Code structure · 10. Operating
  modes · 11. Debugging tips · 12. Incremental refresh (data agents only) · 13. When to touch which
  file · 14. FAQs.

**Non-negotiables:** never guess — write `TODO: Add details`; prefer runnable guidance (exact
commands, paths, expected outputs); keep docs aligned to the actual codebase; never expose secrets;
never claim validation without evidence.

The full standard — quality rules, fail/warning conditions, the step-by-step procedure, and the
Azure / observability / evaluation expectations — lives in the on-demand
[`documentation-governance`](.github/skills/documentation-governance/SKILL.md) skill. Load it when
doing documentation work instead of carrying the full standard in every turn.

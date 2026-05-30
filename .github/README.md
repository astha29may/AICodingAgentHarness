# Technical Architect Workflow

This repository expects you to run the helper scripts from your active Conda base environment.

## Setup

1. Activate your base Conda environment.
2. Install dependencies if needed: `pip install -r requirements.txt`

## Script entry points

- Script executor workflow: [.github/prompts/script-executor.prompt.md](prompts/script-executor.prompt.md)
- Workbook extraction: [.github/tools/run_extract_vendor_selection_rules.ps1](tools/run_extract_vendor_selection_rules.ps1)
- Core reader: [.github/tools/extract_vendor_selection_rules.py](tools/extract_vendor_selection_rules.py)
# AI Architect System — Copilot Agent Setup

## Overview

This repository provides a **practical, human-in-the-loop Technical Architect Agent** designed to:

- Convert business requirements into **architecture designs**
- Identify **technical gaps and risks**
- Recommend **Microsoft/Azure-first solutions**
- Support **consistent, reusable AI project delivery**

The system is designed for **on-demand use via GitHub Copilot Agent Mode** — no always-on services, no overengineering.

---

## What This System Does

Using structured inputs, the agent:

1. Reads `PROBLEMSTATEMENT.md`
2. Understands data from `/SampleData`
3. Produces:
   - ✅ `DESIGN.md` (architecture)
   - ✅ `TechnicalGaps.md` (open questions, risks)

It also performs a **multi-perspective design evaluation** using internal personas:
- Architect (baseline design)
- Critic (challenges assumptions)
- Azure Pragmatist (simplifies design)
- Security Reviewer (governance & compliance)
- Operability/Cost Reviewer

---

## Repository Structure

| Path | Purpose |
| --- | --- |
| `PROBLEMSTATEMENT.md` | Primary business and solution context input |
| `.github/agents/technical-architect.agent.md` | Custom agent definition and operating constraints |
| `.github/AGENTS.md` | Repo-level operating manual for architecture generation |
| `.github/instructions/architecture.instructions.md` | Markdown quality and architecture-document standards |
| `DESIGN.md` | Generated target architecture document |
| `TechnicalGaps.md` | Generated unresolved gaps, risks, and missing-input document |

---

## How To Use The Technical Architect Agent

### Prerequisites

1. Open this repository in VS Code.
2. Ensure `PROBLEMSTATEMENT.md` is up to date.
3. Add supporting artifacts to `SampleData/` or `docs/` if available.

### Run The Agent

1. Open Copilot Chat in Agent mode.
2. Select the `technical-architect` custom agent.
3. Provide a request such as: "Create a full design and gaps review from PROBLEMSTATEMENT.md."
4. Review each approval checkpoint before proceeding:
   - Checkpoint A: high-level architecture
   - Checkpoint B: Azure services mapping
   - Checkpoint C: final approval before marking design complete

### Expected Outputs

| File | What to expect |
| --- | --- |
| `DESIGN.md` | Service mapping, rationale/tradeoffs, security/governance, observability, failure modes, assumptions, risks, and decisions requiring approval |
| `TechnicalGaps.md` | Unresolved questions, impact of each gap, and minimum info needed to close each gap |

### Operating Constraints

- Human-in-the-loop only. The agent does not execute infrastructure.
- Microsoft/Azure-native options are preferred unless requirements force alternatives.
- The agent asks one clarifying question at a time when blocked.
- Web access is enabled for references; if references are unavailable, include a "Web research needed" section with suggested queries.

### Example Prompts

- "Generate DESIGN.md and TechnicalGaps.md from PROBLEMSTATEMENT.md with a minimal production-ready Azure architecture."
- "Re-run the design with stronger security and governance controls, and list tradeoffs."
- "Audit the current DESIGN.md for operability and cost risks, then propose focused updates only."

---

## Recommended Workflow

1. Start with a quick draft request.
2. Approve Checkpoint A and B after reviewing assumptions and service choices.
3. Resolve high-impact items in `TechnicalGaps.md`.
4. Request a final pass and approve Checkpoint C.
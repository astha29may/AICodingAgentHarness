# Harness — Deployment / Adoption

> The harness is **not a deployed service** — it's a repository template you adopt into a project.
> Deployment docs for a project the harness *builds* (Azure, azd, Bicep, etc.) are generated into that
> project's top-level `docs/deployment.md`.

## What "deploying" the harness means
Adopting it into a repo so VS Code + Copilot run the pipeline there. Copy these into the target repo:

| Bring | Why |
| --- | --- |
| `.github/agents/`, `.github/skills/`, `.github/instructions/` | the pipeline agents, workflows, and path-scoped rules |
| `.github/memory/`, `.github/lib/` | the memory store + fingerprint library |
| `.github/scripts/` | `sync-memory.py`, `run-benchmarks.ps1`, `render-diagrams.ps1` |
| `.github/copilot-instructions.md`, `AGENTS.md` | the auto-read operating manual + harness execution policy |
| `benchmarks/` | deterministic scorers + tasks |
| `templates/`, `output/` (blank) | deliverable templates + the pipeline's output landing zone |
| `gan-harness/` (structure only) | generator-evaluator working area (ledgers regenerate per build) |

## After adoption
1. `pip install -r requirements.txt` and run `pytest .github/tests -q` to confirm the harness is healthy.
2. Trigger a build from VS Code chat (see [local-setup.md](local-setup.md)).
3. Promote useful learnings the closeout surfaces (see [memory-architecture.md](memory-architecture.md)),
   then `sync-memory.py` to materialize them.

## Not in scope here
The harness performs **no infra execution and no deployments** itself (human-in-the-loop). Any Azure
deployment belongs to the *built project* and is documented under that project's `docs/deployment.md`.

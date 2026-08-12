# Harness self-documentation

This folder holds the **harness's own** design, implementation plan, and system documentation.
It is distinct from `output/`, which holds the pipeline deliverables for the **target project**
the harness builds.

| File | Purpose |
| --- | --- |
| [memory-architecture.md](memory-architecture.md) | Design of the Copilot/Python-native memory engine + self-learning loop |
| [IMPLEMENTATIONPLAN.md](IMPLEMENTATIONPLAN.md) | Implementation plan for the memory engine (harness feature) |
| [architecture.md](architecture.md) | System architecture and codebase structure |
| [deployment.md](deployment.md) | Deployment model |
| [local-setup.md](local-setup.md) | Local setup and validation |
| [testing.md](testing.md) | Test strategy and commands |
| [observability.md](observability.md) | Logging, metrics, traces |
| [evaluation.md](evaluation.md) | Evaluation approach |
| [diagrams/](diagrams/) | Mermaid sources (`*.mmd`) + rendered PNGs; regenerate with `.github/scripts/render-diagrams.ps1` |
| [templates/](templates/) | Blank documentation-governance **templates** (the `TODO: Add details` stubs a built project's `docs/` are filled from) — kept separate so they don't mix with the real harness docs above |

> Target-project documentation (for a project the harness builds) uses these same filenames under
> that project's own `docs/` folder, not here.

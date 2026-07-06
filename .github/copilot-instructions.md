# GitHub Copilot Repo Instructions
Use AGENTS.md as the primary operating manual for this repository.

@../AGENTS.md

This repository also runs a **Documentation Governance Agent** (see root [`AGENTS.md`](../AGENTS.md))
and a documentation-governance skill (`.github/skills/documentation-governance/SKILL.md`).
The documentation standard below applies to all documentation work in this repository.

Global constraints:
- Human-in-the-loop only; no infra execution.
- Prefer Microsoft/Azure-native services by default.
- Ask one clarifying question at a time when blocked.
- Cleanup-first default: if the objective is revert/simplify/cleanup, prefer editing or removing existing code over generating new code.
- Add code only when required for correctness; if behavior can be fixed without new lines, do not add them.

Pre-final-response enforcement:
- Before sending a final response, run a documentation-governance checklist pass against the requested scope.
- Verify docs are complete, grounded in repository evidence, and aligned with code/config/test/infra changes.
- If required documentation sections or facts are missing, add `TODO: Add details` rather than guessing.

## File-placement rules (all agents)
- **Harness deliverables go in `output/`.** The pipeline artifacts are `output/PROBLEMSTATEMENT.md`,
  `output/DESIGN.md`, `output/TechnicalGaps.md`, `output/architecture-first-cut.drawio`, and
  `output/IMPLEMENTATIONPLAN.md`. Read and write these from `output/`, never the repo root.
- **Throwaway / intermediate scripts go in `copilotscripts/`.** Any script created only to perform
  an intermediate task (parsing a file, a quick probe, a one-off conversion) must be written under
  `copilotscripts/`. This folder is git-ignored and disposable. Never place production code, tests,
  infra, or deliverables there — use `src/`, `tests/`, `infra/`, or `output/`.
- Generator-evaluator working files stay under `gan-harness/` (`feedback/`, `contracts/`, `build-report.md`).

---

## Documentation Standard

This repository must maintain enterprise-standard documentation that is complete, accurate,
reproducible, and onboarding-friendly.

Copilot must always optimize for:
- clarity over brevity when setup or operations are involved
- deterministic, step-by-step instructions
- documentation that a completely new engineer can follow without tribal knowledge
- alignment between code, deployment, observability, evaluation, and test procedures

Documentation in this repository must cover two levels:

1. **System-level documentation**
2. **Module / agent-level documentation**

Both are mandatory unless explicitly marked as not applicable.

---

## Required Documentation Artifacts

### A. System-Level Documentation
The repository must contain system-level documentation under `docs/`.

Recommended files:
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/observability.md`
- `docs/evaluation.md`
- `docs/local-setup.md`
- `docs/testing.md`

At minimum, system-level documentation must explain:
- overall application purpose
- high-level architecture
- end-to-end workflow
- module / agent interaction model
- Azure deployment architecture
- local setup
- local validation steps
- cloud deployment steps
- cloud validation steps
- observability and monitoring
- evaluation approach
- failure modes and recovery guidance
- codebase structure

### B. Module / Agent-Level Documentation
Each module or agent must contain a `documentation.md` file in its folder.

Every module or agent document must contain these sections exactly:

1. Summary  
2. Design of the module  
3. Pre-requisites  
4. End-to-End flow  
5. External Services & Configuration  
6. Local setup  
7. Cloud setup  
8. Publish / refresh workflow  
9. Code structure  
10. Operating modes (if any)  
11. Debugging tips  
12. Incremental refresh (only for data agents)  
13. When to touch which file  
14. FAQs  

Additionally, every module or agent document should include:
- integration within the broader system
- deployment mapping
- test scenarios
- observability notes where relevant

---

## Documentation Quality Rules

Copilot must ensure documentation is:

### 1. Understandable by a new engineer
Write for a person who:
- has not seen the system before
- does not know internal conventions
- needs exact setup and validation steps

### 2. Executable
If documentation includes setup or deployment:
- include prerequisites
- include commands
- include expected outcomes
- include validation steps
- include troubleshooting guidance

### 3. Grounded in the codebase
Do not invent:
- APIs
- workflows
- infrastructure
- environment variables
- dependencies
- tests
- observability tools

If information cannot be inferred from the repository, explicitly write:
`TODO: Add details`

### 4. Security-safe
Never include:
- secrets
- tokens
- passwords
- connection strings with live values

Only document:
- environment variable names
- secret references
- where secrets are expected to live

### 5. Enterprise-standard
Documentation must be:
- structured
- professional
- consistent in terminology
- easy to navigate
- suitable for onboarding, support, audit, and handoff

---

## Repo Structure Expectations

Copilot should prefer and reinforce this structure:

```
repo/
- .github/
  - copilot-instructions.md
  - skills/
- docs/
  - architecture.md
  - deployment.md
  - observability.md
  - evaluation.md
  - local-setup.md
  - testing.md
- src/
- tests/
- infra/
- scripts/
- README.md
```

If the actual structure differs, document the real structure faithfully.

---

## Local Setup Requirements

Whenever local setup is documented, include:
- required tools and versions
- dependency installation
- local environment configuration
- startup commands
- seed/sample data requirements
- local validation commands
- expected successful outputs
- common local setup issues

---

## Azure Deployment Requirements

Whenever Azure deployment is documented, include:
- target Azure services
- infra dependencies
- deployment sequence
- environment configuration
- service identities / auth model
- post-deployment validation
- smoke tests
- rollback or recovery guidance

---

## Testing Requirements

Documentation must explain:

### Local validation
- what to run locally
- environment assumptions
- expected outputs
- failure interpretation

### Cloud validation
- how to validate deployed behavior
- smoke tests
- health checks
- endpoint verification
- telemetry checks

### Evaluation
Where applicable, define:
- quality metrics
- latency / performance validation
- reliability checks
- grounding or response quality criteria
- evaluation dataset / sample prompts / expected behavior

---

## Observability Requirements

Documentation must explain, where relevant:
- logging destinations
- metrics and traces
- dashboards
- alerting
- correlation / request tracing
- how to investigate issues
- how to distinguish code issues vs config issues vs infra issues

---

## Writing Style

Copilot must:
- use concise headings
- use bullets for procedures
- use numbered steps for ordered instructions
- keep wording unambiguous
- prefer direct action language
- avoid vague phrases such as "set this up properly" or "configure as needed"

Good:
- "Run `python -m pytest tests/unit`"
- "Verify the API returns HTTP 200"
- "Confirm logs appear in Application Insights"

Bad:
- "Run the tests"
- "Deploy to Azure"
- "Check monitoring"

---

## What Copilot Should Do

When asked to generate or update documentation, Copilot should:

1. inspect the relevant code, config, infra, scripts, and tests
2. determine whether the request is system-level or module-level
3. create or update the required documentation files
4. ensure all required sections are present
5. fill in concrete details from the repo
6. use `TODO: Add details` instead of guessing
7. preserve exact section names for module documentation
8. make setup and validation steps runnable
9. include observability and evaluation where relevant
10. explain how the documented component fits into the broader system

---

## What Copilot Must Not Do

Copilot must not:
- delete required sections
- rename required module documentation headers
- fabricate design details
- omit setup or validation steps when those workflows exist
- provide secret values
- create shallow documentation that only restates file names

---

## Success Criteria

Documentation is considered complete only if a new engineer can:
- understand the system architecture
- understand the purpose of each module / agent
- set up the code locally
- run and validate locally
- deploy to Azure
- validate the deployment
- understand observability and evaluation
- know where to make common changes
- troubleshoot common issues without relying on tribal knowledge

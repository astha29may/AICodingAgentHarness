---
name: documentation-governance
description: >
  Create, update, review, and enforce enterprise-standard documentation for systems,
  modules, and agents. Use this skill when asked to generate documentation,
  improve onboarding docs, document local setup, Azure deployment, observability,
  evaluation, validation steps, or ensure documentation completeness across a repository.
---

# Documentation Governance Skill

## Purpose
This skill creates and maintains enterprise-standard documentation for this repository.

Use this skill when the task involves:
- documenting a module
- documenting an agent
- documenting the overall system
- improving onboarding documentation
- documenting local setup
- documenting Azure deployment
- documenting local or cloud validation
- documenting observability
- documenting evaluation
- checking if documentation is complete

This skill should produce documentation that a completely new engineer can follow line by line.

---

## What This Skill Must Produce

This skill must ensure documentation exists at two levels:

### 1. System-Level Documentation
System-level documentation must explain:
- what the application does
- how the application is designed
- how components interact
- end-to-end workflow
- local setup
- local validation
- Azure deployment
- cloud validation
- observability
- evaluation
- codebase structure
- troubleshooting

### 2. Module / Agent-Level Documentation
Each module or agent must have `documentation.md` with these exact sections:

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

---

## Output Standard

Documentation must be:

### Accurate
Only include details grounded in:
- source code
- infra files
- deployment scripts
- test files
- config files
- repository structure

If details are unknown, write:
`TODO: Add details`

### Actionable
When documenting setup, testing, or deployment:
- include commands
- include file paths
- include pre-requisites
- include expected results
- include validation steps

### Onboarding-friendly
Assume the reader:
- is entirely new to the codebase
- does not know conventions
- needs step-by-step guidance

### Enterprise-standard
Use:
- clear headings
- numbered procedures
- precise wording
- professional tone
- repeatable operational guidance

---

## Procedure

### Step 1: Identify documentation scope
Classify the request into one or more of:
- system documentation
- module documentation
- agent documentation
- setup documentation
- deployment documentation
- validation documentation
- observability documentation
- evaluation documentation

### Step 2: Inspect the repository
Review all relevant evidence:
- source files
- config files
- infra definitions
- scripts
- tests
- CI/CD definitions
- telemetry or monitoring references
- README and docs folder

### Step 3: Determine documentation targets
Typical outputs include:
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/local-setup.md`
- `docs/testing.md`
- `docs/observability.md`
- `docs/evaluation.md`
- `<module-path>/documentation.md`

### Step 4: Generate or update documentation
For each target file:
- preserve existing accurate content
- add missing sections
- improve ambiguous instructions
- convert vague guidance into concrete steps
- note unknown details as `TODO: Add details`

### Step 5: Verify completeness
Before finishing, confirm:
- required sections are present
- setup steps are runnable
- deployment steps are understandable
- validation steps exist
- observability is covered where relevant
- evaluation is covered where relevant
- documentation explains how the part fits into the whole

---

## Required System Documentation Checklist

System documentation should cover:

### System understanding
- overview
- business or functional purpose
- architecture
- component interactions
- end-to-end flow

### Setup and operation
- prerequisites
- local environment setup
- startup sequence
- local validation
- deployment sequence
- cloud validation

### Runtime quality
- observability
- logs
- metrics
- traces
- dashboards
- alerts
- evaluation metrics
- quality criteria

### Maintainability
- repo structure
- responsibilities by folder
- where to make common changes
- debugging guide
- FAQs

---

## Required Module / Agent Documentation Checklist

Each `documentation.md` should also clarify:
- where the module / agent sits in the overall system
- what it depends on
- how it is configured
- how it runs locally
- how it is deployed
- how it is tested
- how to debug it
- what files to touch for common changes

---

## Data Agent Rule
If the documented component is a data agent, fill in:
- incremental refresh strategy
- checkpointing / watermark logic
- reprocessing behavior
- failure handling

If not a data agent, section 12 should say:
`Not applicable`

---

## Azure Deployment Rule
If the component or system is deployed to Azure, document:
- target service
- deployment path
- environment variables
- infra prerequisites
- identity/auth approach
- post-deploy smoke tests
- telemetry checks

---

## Observability Rule
If logs, metrics, or traces exist, document:
- where to find them
- what to look for
- common signals of success or failure
- how to trace a request / job / run

---

## Evaluation Rule
If outputs must be assessed for correctness or quality, document:
- evaluation criteria
- sample test scenarios
- pass/fail expectations
- latency or reliability expectations if relevant

---

## When This Skill Should Be Used

Use this skill for prompts like:
- document this module
- create documentation for this agent
- improve repo onboarding docs
- document Azure deployment
- add observability documentation
- add local setup steps
- validate documentation completeness
- make the docs usable for new engineers

---

## When This Skill Should Not Guess
Do not invent:
- API signatures not found in code
- infrastructure that does not exist in files
- deployment steps not supported by scripts or pipelines
- observability tooling not referenced in the repo
- evaluation methods not defined anywhere

Use:
`TODO: Add details`

---

## Success Criteria
This skill is successful only if a new engineer can:
- understand the system
- understand each module / agent
- run the system locally
- validate local behavior
- deploy to Azure
- validate the deployment
- understand observability
- understand evaluation
- know where to make common changes

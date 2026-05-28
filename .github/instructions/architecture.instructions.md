---
applyTo: "**/*.md"
---
# Architecture Documentation Instructions

## Writing style
- Crisp, principal-engineer tone.
- Prefer tables and short sections; avoid verbose prose.

## Must include in DESIGN.md
- Microsoft/Azure service mapping with rationale and tradeoffs
- Security & governance (RBAC, secrets, data boundaries)
- Observability (logs, traces, metrics) + failure modes
- Assumptions, risks, and decisions requiring approval

## Microsoft-first defaults (use unless requirements contradict)
- LLM: Azure AI Foundry / Azure OpenAI
- Retrieval: Azure AI Search (hybrid)
- Compute: Azure Functions or Azure Container Apps
- Integration: API Management when multi-client/external
- Secrets/Identity: Managed Identity + Key Vault
- Observability: Application Insights + Azure Monitor

## Don’t overengineer
- Start with minimal viable production-ready architecture.
- Add orchestration/eventing only when explicitly required.
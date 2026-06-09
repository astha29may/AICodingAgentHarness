---
applyTo: "**/*.md"
---
# Architecture Documentation Instructions

## Writing style
- Crisp, principal-engineer tone.
- Prefer tables and short sections; avoid verbose prose.

## Diagrams
- Mermaid sometimes fails to render in previews. For any diagram meant to be read (not a fill-in
  template), keep the Mermaid source at `docs/diagrams/<name>.mmd`, render it to a PNG, and embed
  the PNG in the markdown: `![alt](docs/diagrams/<name>.png)`.
- Keep the Mermaid source available as a fallback inside a `<details>` block under the image.
- Regenerate images with `powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1` after editing any `.mmd` source.
- `TODO`/placeholder diagrams in templates stay as plain Mermaid code blocks (they are filled in per project).

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
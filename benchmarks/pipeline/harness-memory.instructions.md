---
applyTo: "src/**,tests/**,scripts/**,infra/**"
---

<!-- Harness custom-memory seed: repo learnings the self-learning loop would have promoted from prior
     ConverseHub runs. Grounded in observed failures + review findings, not invented. The runner
     materializes this as memory-repo.instructions.md for the harness pipeline run. -->

## Repo learnings (promoted from prior runs)
- Deliverables are done only when written: a stage that owns a named artifact (e.g. the problem statement) MUST write it to its expected path before finishing; do not end a stage until its named output exists on disk.
- Tools are stdlib-first, self-contained functions (calculator, kb-search, weather). Do not pull in external services or heavy SDKs (no managed databases, no cloud clients) for the MVE unless the plan explicitly names them.
- Graceful degradation: tool dispatch must catch broad, unexpected errors, not only a narrow tool-specific error type - a malformed or extra tool argument must not crash the request; degrade and still answer.
- Auth boundary: never trust identity or claims from client-supplied request headers; derive the principal and its groups only behind a trusted-proxy boundary, stripping any client-supplied identity headers first (OWASP A01/A07).
- Numeric-tool safety: bound operand and exponent magnitude and reject oversized power/exponent operations to prevent CPU/memory exhaustion (DoS) from a single crafted expression (OWASP A03).
- Minimal but production-grade: right-size for a production MVE - no toy shortcuts and no gratuitous over-engineering; every file must earn its place.

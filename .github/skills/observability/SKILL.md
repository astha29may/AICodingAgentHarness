---
name: observability
description: >
  Ensure a system is observable — structured logging, metrics, distributed tracing with correlation
  IDs, health checks, dashboards, and alerts wired to the telemetry stack in DESIGN.md (default Azure:
  Application Insights + Azure Monitor / OpenTelemetry). Use when instrumenting a build, reviewing
  telemetry coverage, or filling docs/observability.md. Instrument at boundaries; never log secrets/PII.
---

# Observability Skill

## Purpose
Make a system debuggable and operable in production: you can tell what happened, where, and why, and
get alerted before users do. Instrument the **edges**, not internals — consistent with the repo's
minimalist coding standard.

## When to use
- After lanes merge (fan-in), before/with verification.
- Reviewing whether a change emits the telemetry its design requires.
- Filling `docs/observability.md` for a module or the system.

## Inputs
1. `output/DESIGN.md` — named telemetry stack, SLOs, failure modes.
2. `docs/observability.md` — current logging/metrics/traces/dashboards/alerts.
3. Merged code under `src/` — the boundaries to instrument.

## Never skip — apply the baseline when the plan/design is silent
Observability is mandatory even if `IMPLEMENTATIONPLAN.md` or `DESIGN.md` don't mention it. When they
are silent or incomplete, **do not skip** — apply this baseline, then record what you did and recommend
richer telemetry in `docs/observability.md`:
- structured logging at every system edge with a propagated correlation/request id, and error logging on all failure paths;
- a liveness/readiness health check per deployable;
- RED metrics per service (throughput/lag per pipeline);
- at least one alert per known failure mode in `DESIGN.md`;
- stack = the one named in `DESIGN.md`, else default to **Azure App Insights + Azure Monitor + OpenTelemetry** (state the default was applied).

## The four pillars (instrument at boundaries)
1. **Logs** — structured (JSON) at every system edge; consistent levels; a correlation/request id propagated end-to-end. **Never** secrets, tokens, or PII.
2. **Metrics** — the signals the design cares about: RED (rate, errors, duration) for services; throughput/lag for pipelines; token/cost for AI.
3. **Traces** — distributed spans across lane/service boundaries so one request/job/run is traceable end-to-end (OpenTelemetry or the design's tracer).
4. **Health** — liveness/readiness checks per deployable.

## Dashboards & alerts
- Define key dashboards and alert thresholds from the design's SLOs (as code/config where possible).
- Each alert must map to a failure mode in `DESIGN.md` and be actionable (no noisy/duplicate alerts).
- Record destinations, dashboards, alerts, and a "trace one request" runbook in `docs/observability.md`.

## Rules
- Instrument only what the design requires — no telemetry sprawl.
- Add telemetry without changing feature behavior or breaking `gan-harness/contracts/` interfaces.
- Bound overhead: sample high-volume traces; async/batched exporters; no synchronous logging on hot paths.
- Redact/scrub sensitive data at the logging boundary.
- Add tests for testable telemetry (log shape, correlation-id propagation, health endpoint).

## Azure defaults
Unless `DESIGN.md` says otherwise: Application Insights + Azure Monitor, OpenTelemetry SDKs, managed
identity for the telemetry connection. For SDK specifics use the `appinsights-instrumentation` skill.

## Done when
- Every design-required signal exists and is verifiable.
- No secrets/PII in any log or trace.
- `docs/observability.md` has concrete destinations, metrics, dashboards, alerts, and a tracing runbook.

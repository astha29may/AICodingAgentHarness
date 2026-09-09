# Implementation Plan — Copilot-Native Memory Engine & Shareable Self-Learning Loop

> Produced by the `implementation-planner` agent. Design source of truth:
> [memory-architecture.md](memory-architecture.md). This plan **converts** that
> approved design into a dependency-ordered build; it does not redesign it.
> Primary objective enforced throughout: **maximize token efficiency without dropping code quality** —
> no duplicated/redundant logic, minimal cyclomatic complexity per block, controlled token usage.
> Every code task reuses the existing quality scripts; no new quality tooling is added beyond the
> already-shipped `check-func-length.py`.
>
> **Foundational design principle (§1 "Engine vs store").** The **engine is what you already have**:
> **GitHub Copilot** drives the interactive loop (its agents capture corrections, review, and score),
> **Python** runs the deterministic parts (materialization, quality checks, baseline compare), and
> **GitHub Actions** (optional) runs them unattended on a schedule. There is **no external agent
> runtime and no machine-local memory store**. Durable memory lives entirely in **git-versioned files**
> under `.github/memory/**` (committed at repo scope; published to a shared memory git repo at global
> scope) and is **materialized** into committed, `applyTo`-scoped `.github/instructions/**` that VS Code
> Copilot reads directly — with no runtime dependency at read time. A fresh clone or a teammate gets the
> same memory with nothing to install.
>
> **Delivery status.** **Phase A (M1–M7) is BUILT and verified** — memory relocated to
> `.github/memory/**`, the fingerprint resolver, `sync-memory.py` materialization + `--check` freshness
> guard, the Copilot/Python-native benchmark runner with its generation seam + pure-Python rubric scorer,
> the extended BM-06 memory-quality evaluation, the artifact-safe `.gitignore`/settings, the agent
> read-order + correction-capture updates, and the single record schema all ship with passing tests. The
> only **remaining work** is an **optional** deterministic scope/evidence/retrieval enforcement module
> (Category P) — build it only if stricter offline gating is later wanted.

## 1. Scope

**In scope**

*Shipped — Copilot/Python-native encoding, committed/shared delivery, benchmark repair (Phase A, done):*

- The design encoded as **git-versioned data + a thin Python loop**, not a bespoke engine: the single
  record schema (`.github/memory/schema.yaml`), the token-budget/confidence/TTL policy
  (`.github/memory/policy.yaml`), and the committed context files (`AGENTS.md`,
  `.github/instructions/**` with `applyTo`, repo `style.yaml`).
- The self-learning **behavior** encoded across the surfaces that already run it — **Copilot agents**
  (interactive capture/review/scoring in `.github/agents/*.md`), **Python scripts** (deterministic
  materialization, redaction, baseline compare governed by `policy.yaml`), and the on-demand
  **anti-patterns Copilot skill** (`.github/skills/anti-patterns/SKILL.md`) that replaced the standing
  anti-pattern table.
- The **shared global memory git repo** pinned by immutable SHA in `.github/memory/global.lock`, and a
  **sync/materialize step** (`.github/scripts/sync-memory.py`) that pulls the pinned global store and
  materializes applicable repo + global memory into committed `.github/instructions/**` for Copilot.
- The **repo fingerprint helper** (`src/memory/fingerprint.py`) — thin, deterministic, cwd-independent.
- The **benchmark evidence engine** relocated to a **Copilot/Python-native** runner (no external engine,
  no broad path/URL/yolo bypass, no external-runtime task invocation; generation tools run confined to a per-run workdir); deterministic rubric checks live in `benchmarks/scripts/*.py`.

*Shipped since — runner rework and memory-quality evaluation (now done):*

- **Benchmark runner rework (Category C).** The placeholder seam in `.github/scripts/run-benchmarks.ps1`
  is replaced with a headless **GitHub Copilot CLI (`copilot`)** generation seam plus a **pure-Python**
  rubric scorer (`benchmarks/scripts/score-task.py`) running deterministic file-exists / regex /
  custom-script checks; per-task `quality_score`/`passed` are populated. llm-judge is isolated in one
  seam and excluded offline, so the suite runs fully offline.
- **Memory-quality evaluation (Category I).** BM-06 now spans recall, usefulness, cross-repo
  contamination (deterministic, two distinct fingerprints), staleness, and token cost.

*Remaining — optional only:*

- **Optional deterministic enforcement module (Category P).** If stricter offline scope/evidence/
  retrieval enforcement + provenance logging is wanted beyond what the Copilot loop + `policy.yaml`
  already deliver, add a **plain Python module under `src/memory/`** (no external provider interface).
  Lean by default; most of its intent is already satisfied by Phase A.

**Explicitly out of scope**

- Redesigning any decision in [memory-architecture.md](memory-architecture.md)
  (engine-vs-store split, schema fields, plane model, precedence, promotion states are fixed).
- **Re-introducing an external agent runtime or a machine-local memory store.** The engine is Copilot +
  Python + optional GitHub Actions; durable memory is git-versioned under `.github/memory/**`. The
  previously-considered bespoke engine modules (`ledger.py`, `consolidate.py`, `confidence.py`,
  `promotion.py`, `ab_replay.py`, `human_gate.py`, `redact.py`, `versioning.py`, `lifecycle.py`,
  `audit_log.py`, `retrieval/*`) are **not built** — their behavior is delivered by the schema +
  `policy.yaml` + Copilot agents + `sync-memory.py`, and (only if needed) the optional Category P module.
- New infrastructure, cloud deployment, or destructive/irreversible operations.
- A vector database or embedding service — retrieval is descriptor-first ranking over committed/shared
  YAML/JSONL; no new external service.
- Any new quality-gate script beyond the four existing ones (`check-complexity.py`, `check-loc.py`,
  `check-duplication.py`, `check-func-length.py`).
- Changing the harness pipeline stages or the stage→agent mapping.

**Delivered-by map (at a glance):**

| Concern | Delivered by | Status |
| --- | --- | --- |
| Capture / review / scoring (interactive loop) | **GitHub Copilot agents** (`.github/agents/*.md`) | Shipped |
| Consolidation / redaction / materialization / baseline compare | **Python** (`.github/scripts/sync-memory.py`) governed by `.github/memory/policy.yaml` | Shipped |
| Optional unattended runs | **GitHub Actions** (schedule) | Optional |
| Anti-pattern enforcement (on demand) | **Copilot skill** (`.github/skills/anti-patterns/SKILL.md`) | Shipped |
| Record schema, committed context files, `global.lock` | Git-versioned data under `.github/memory/**` | Shipped |
| Shared global store + materialize into `.github/instructions/**` | Shared git repo + `.github/scripts/sync-memory.py` | Shipped |
| Repo fingerprint helper | `src/memory/fingerprint.py` | Shipped |
| Benchmark evidence engine (Copilot CLI + Python rubric) | `.github/scripts/run-benchmarks.ps1` + `benchmarks/scripts/score-task.py` | Shipped |
| Optional deterministic scope/evidence/retrieval enforcement | Plain Python under `src/memory/` | Optional |

## 2. Assumptions & Open Questions

- **A1 (design source).** There is no `output/DESIGN.md` for this internal-tooling effort.
  [memory-architecture.md](memory-architecture.md) is the design source of truth;
  references that would point at `output/DESIGN.md` resolve to it.
- **A2 (engine = Copilot + Python + optional GitHub Actions).** Capture, review, and scoring run in the
  **interactive Copilot loop** (build agents in `.github/agents/*.md`); consolidation, redaction,
  materialization, and baseline compare run in **Python** (`.github/scripts/sync-memory.py`) governed by
  `.github/memory/policy.yaml` (`confidence_threshold`, `staleness_ttl_days`, `max_recalled_entries`,
  `max_retrieved_memory_tokens: 8000`). Optional **GitHub Actions** runs the deterministic steps on a
  schedule. No external runtime is required and none is introduced.
- **A3 (Copilot reads committed files, not a private store).** All durable memory Copilot must honor is
  **materialized** into committed `.github/instructions/**` (with `applyTo`) and repo `style.yaml`.
  `sync-memory.py` regenerates these from the committed repo store and the pinned global store; global
  promotions are gated by human PR review. This is a hard constraint, not an optimization.
- **A4 (Phase A shipped).** The self-learning loop runs on Copilot + Python; repo + global memory is
  shareable (committed repo scope + pinned shared global store, materialized into
  `.github/instructions/**`); the benchmark runner is Copilot/Python-native and parses/runs. Remaining work is the
  runner rework (Category C) and the optional enforcement module (Category P). The **human write-approval
  gate is PR review plus Python secret-redaction** — global promotions and instruction/materialized-file
  edits require approval.
- **A5 (fingerprint definition — shipped).** `repo_fingerprint` identifies the *solution* via
  precedence: (1) committed `.github/memory/repo-id` → `sha256(repo-id)`; (2) else canonical remote
  (prefer `origin`, else lexicographically-smallest normalized remote URL), seeded into
  `.github/memory/repo-id`; (3) else a generated UUID written to `.github/memory/repo-id`. Applicability
  is by scope: repo/subsystem require fingerprint equality; global-approved is generic (not
  equality-gated) and is promoted only after evidence spans **≥2 distinct** solution fingerprints.
  Implemented in [src/memory/fingerprint.py](../../src/memory/fingerprint.py).
- **A6 (language).** Custom logic (fingerprint helper, materialize script, optional Category P module) is
  Python under `src/` and `scripts/` with tests under `tests/`, matching the existing quality scripts and
  `tests/` layout. YAML/JSONL are data; the schema is a format convention, not code.
- **A7 (existing thresholds are fixed).** CC hard ceiling 10 / target ≤ 8, duplication ≤ 0.05, LOC
  ceiling as configured — inherited unchanged from the four scripts and BM-09.
- **A8 (optional module supersedes, never duplicates, the Copilot-loop gates).** If the optional
  Category P module is built, it *replaces* the policy-driven checks the loop applies (scoping,
  ≥2-distinct-fingerprint promotion, ranking, token cap) — it does not run a parallel duplicate path
  (protects the no-duplication objective; verified by `check-duplication.py`).
- **A9 (materialized memory must not reintroduce standing token load — shipped).** Materialized memory in
  committed `.github/instructions/**` is **path-scoped via `applyTo`** (loaded only for relevant files)
  and **descriptor-dense** (one-line rules). `sync-memory.py` emits one bullet per record `descriptor`
  under a scoped `applyTo` header, keeping shareable delivery aligned with the token-efficiency objective.
- **A10 (Copilot works without the loop at read time — shipped).** The committed, materialized memory is
  read by VS Code Copilot with **no runtime dependency**: a fresh clone or a teammate benefits from
  repo + pinned-global memory even without running the loop. The loop is required only to *write / learn /
  promote*; if it is not run, the shareable memory and the harness pipeline keep working.
- **A11 (D1 mapping).** D1's enforced consequence — "only approved evidence patches instruction/
  materialized files, through the human gate" — is delivered by PR review, the git-tracked materialized
  files, and the `sync-memory.py --check` freshness guard. The separate "pipeline phase-state versioned
  manifest" is a harness-pipeline concern, out of scope for this memory plan and tracked independently.
- **Q1 (resolved 2026-08-04 — default accepted, human-confirmable).** The shared global memory store is a
  **sibling git repository** `AICodingAgentHarness-memory-global` under the same org/owner, layout
  `memory-global/patterns/*.yaml`, referenced by immutable commit SHA in `.github/memory/global.lock`,
  pulled **read-only** by every solution and written only through the human-gated promotion path. If the
  org later prefers a package feed or a monorepo path, substitute the reference in `global.lock` — no code
  change (`sync-memory.py` reads the lock).

## 3. Milestones

Milestones **M1–M7 are shipped and verified** (quality scripts + named tests green). The remaining
milestones (M8–M9) cover the benchmark runner rework and the optional enforcement/eval work.

### Shipped — Copilot/Python-native loop, shareable memory, working memory delivery

1. **M1 — Evidence engine Copilot/Python-native [DONE].** `run-benchmarks.ps1` and `lock-baseline.ps1` parse on
   Windows PowerShell 5.1 and PS7; `metrics.json` valid; task paths resolve; `check-func-length.py`
   present; the runner invokes **no external engine** and confines generation tools to a **per-run workdir** (no broad path/URL/yolo bypass) — Python does the
   YAML/config heavy lifting and deterministic rubric checks. *(Per-task generation seam now wired — see M8.)*
2. **M2 — Record schema + fingerprint + global.lock [DONE].** Single record schema at
   `.github/memory/schema.yaml`; committed `global.lock`; `src/memory/fingerprint.py` resolver with the
   hardcoded `workdir` removed.
3. **M3 — Python loop policy [DONE].** `.github/memory/policy.yaml` encodes confidence threshold,
   staleness TTL (30 days), max recalled entries, and the 8000-token retrieval cap — consumed by
   `sync-memory.py` and the loop. Secret redaction is Python-side before any write/materialization.
4. **M4 — Loop behavior on Copilot surfaces [DONE].** The capture → review → score behavior lives in the
   build agents (`.github/agents/*.md`); the scope/fingerprint promotion policy (narrowest-scope capture,
   ≥2-distinct-fingerprint global promotion, human PR gate) is documented for the loop; the on-demand
   anti-patterns skill (`.github/skills/anti-patterns/SKILL.md`) replaced the standing table.
5. **M5 — Shared global store + sync/materialize [DONE].** The shared global memory git repo is
   referenced via `global.lock`; `.github/scripts/sync-memory.py` pulls the pinned store and materializes
   applicable repo + global memory into committed
   `.github/instructions/memory-{repo,global}.instructions.md`, with a `--check` freshness guard.
6. **M6 — Committed context delivery & agent specs [DONE].** Shared output contract
   (`.github/instructions/output-contract.instructions.md`); repo `style.yaml` + materialized
   `.github/instructions/**` in every build-agent read order; `output/DESIGN.md` path fix; artifact-safe
   context exclusions.
7. **M7 — Cleanup & migration [DONE].** Tier table and duplicate baseline block retired; existing ledger
   entries migrated to the schema convention. Net-line-negative.

### Remaining — optional hardening only

8. **M8 — Copilot/Python-native benchmark runner rework [DONE] (Cat C).** The placeholder task seam in
   `run-benchmarks.ps1` is replaced with a headless **GitHub Copilot CLI (`copilot`)** generation seam
   (attended; degrades gracefully when `copilot` is absent) plus a **pure-Python** rubric scorer
   (`benchmarks/scripts/score-task.py`) running deterministic file-exists/regex/custom-script checks;
   per-task `quality_score`/`passed` are populated. llm-judge is isolated in one seam and excluded
   offline. Per-run isolation, if needed, is plain `git worktree` or a per-run temp dir.
9. **M9 — Memory-quality evaluation [DONE] (Cat I); optional enforcement module [optional] (Cat P).**
   BM-06 is extended beyond recall to usefulness, cross-repo contamination (deterministic, two distinct
   fingerprints), staleness, and token cost. The optional plain-Python enforcement module under
   `src/memory/` (Category P) remains unbuilt — build only if stricter offline gating is later wanted.

## 4. Task Breakdown

Lanes: `backend` (fingerprint helper, runner rework, optional enforcement logic), `data`
(schema/format, policy, global.lock, migration), `ai` (ranking/eval), `shared` (Copilot agent specs,
anti-patterns skill, materialization wiring). Every **code** task reuses
[check-complexity.py](../../benchmarks/scripts/check-complexity.py) (CC ≤ 8 target, hard ≤ 10),
[check-loc.py](../../benchmarks/scripts/check-loc.py) (LOC ceiling), and
[check-duplication.py](../../benchmarks/scripts/check-duplication.py) (≤ 0.05) as part of its DoD.
Tasks are tagged **[DONE]** (shipped) or **[TODO]** (remaining / optional).

### Category C — Evidence engine / benchmarks

Runner is Copilot/Python-native. Isolation, if needed, is plain `git worktree` / per-run temp dir — no
bespoke worktree framework.

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | DONE | Remove PS7-only `??` parser error in runner | backend | — | `.github/scripts/run-benchmarks.ps1` | runner parses on 5.1 and PS7 | `Get-OrDefault` null-coalesce helper replaces `??`; parses on both shells |
| C2 | DONE | Fix parser error in baseline lock | backend | — | `.github/scripts/lock-baseline.ps1` | `lock-baseline.ps1` parses on 5.1 and PS7 | Parses on both shells; no runtime-only operators that break parse |
| C3 | DONE | Repair invalid trailing JSON in baseline | data | — | `benchmarks/baseline/metrics.json` | [.github/tests/unit/test_metrics_json_valid.py](../tests/unit/test_metrics_json_valid.py) | Duplicate block removed; valid JSON; test green |
| C4 | DONE | Resolve task paths under `benchmarks/` | backend | — | `.github/scripts/run-benchmarks.ps1`, `benchmarks/benchmark-config.yaml` | [.github/tests/integration/test_task_paths_resolve.py](../tests/integration/test_task_paths_resolve.py) | Every task id maps to an existing `benchmarks/tasks/*.yaml`; test green |
| C5 | DONE | Add `check-func-length.py` + fixtures | backend | — | `benchmarks/scripts/check-func-length.py`, `benchmarks/fixtures/*` | [.github/tests/unit/test_check_func_length.py](../tests/unit/test_check_func_length.py) | ast length check (≤ 30-line rule) exists; fixtures present; its own CC ≤ 8; quality scripts pass |
| C6 | DONE | Wire Copilot CLI generation + Python rubric into the runner | backend | C4 | `.github/scripts/run-benchmarks.ps1`, `benchmarks/scripts/score-task.py` | [.github/tests/integration/test_runner_generation_seam.py](../tests/integration/test_runner_generation_seam.py) | `copilot` generation seam (attended; degrades when absent) + pure-Python scorer `score-task.py` runs file-exists/regex/custom-script checks; per-task `quality_score`/`passed` populated; llm-judge isolated in one seam and excluded offline; no external engine; test green |
| C7 | DONE | Sandbox benchmark generation tools to the per-run workdir (relaxed from the Hermes-era no-yolo rule) | backend | — | `.github/scripts/run-benchmarks.ps1` | [.github/tests/integration/test_runner_generation_seam.py](../tests/integration/test_runner_generation_seam.py) asserts tools confined via `-C`/`--add-dir` and no broad `--yolo`/`--allow-all-paths`/`--allow-all-urls` bypass | Generation runs `--allow-all-tools` scoped to `$workDir`; no broad path/URL/yolo bypass; test green |

### Category A — Record schema & global store contract

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | DONE | Author single record schema | data | — | `.github/memory/schema.yaml` | [.github/tests/unit/test_schema_shape.py](../tests/unit/test_schema_shape.py) | Schema matches §5.1; one record shape used by the loop, materialization, and any enforcement module; test green |
| A2 | DONE | Reduce `AGENTS.md` to schema pointer + loop config | data | A1 | `.github/memory/schema.yaml`, `AGENTS.md` | schema-pointer present; no Tier table (see J3) | Flat Tier section replaced by pointer to `schema.yaml`; verified |
| A3 | DONE | Committed scope layout + `global.lock` pin | data | A1 | `.github/memory/repo/conventions.yaml`, `.github/memory/repo/style.yaml`, `.github/memory/global.lock` | [.github/tests/unit/test_scope_layout.py](../tests/unit/test_scope_layout.py), [.github/tests/unit/test_global_lock_ref.py](../tests/unit/test_global_lock_ref.py) | §5.2 committed layout exists; `global.lock` names a shared-store ref + immutable SHA; test green |

### Category B — Repo fingerprint helper

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | DONE | Repo fingerprint helper (multi-remote + no-remote) | backend | A1 | `src/memory/fingerprint.py`, `.github/memory/repo-id` | [.github/tests/unit/test_fingerprint.py](../tests/unit/test_fingerprint.py) | Pure resolver returns stable `repo_fingerprint` via precedence repo-id → canonical remote → UUID, seeding `.github/memory/repo-id`; CC ≤ 8; quality scripts pass |
| B2 | DONE | Remove hardcoded `workdir` | data | B1 | `src/memory/fingerprint.py`, benchmark config | resolver is cwd-independent (caller passes `repo_root`) | No absolute user path anywhere in the resolver path; verified |

### Category E — Python loop policy (replaces the "engine config" category)

The self-learning mechanics are **git-versioned policy + a thin Python loop**, not engine config keys.
Capture/consolidation/confidence/TTL/redaction/token-budget are governed by `.github/memory/policy.yaml`
and executed by `.github/scripts/sync-memory.py` and the Copilot agents — no external engine, no bespoke Python
engine modules.

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | DONE | Policy knobs (confidence, TTL, recall cap, token cap) | data | A1 | `.github/memory/policy.yaml` | [.github/tests/unit/test_policy_yaml.py](../tests/unit/test_policy_yaml.py), [.github/tests/unit/test_harness_memory_policy.py](../tests/unit/test_harness_memory_policy.py) | `confidence_threshold`, `staleness_ttl_days: 30`, `max_recalled_entries`, `max_retrieved_memory_tokens: 8000` present and consumed by the loop; test green |
| E2 | DONE | Secret redaction before persistence | backend | E1 | `.github/scripts/sync-memory.py` | materialize skips `classification: sensitive` / `redacted: false` records (`is_materializable`) | No secret/token/raw payload is materialized; verified via `test_materialize.py` |
| E3 | DONE | Token-budget delivery (descriptor-dense, `applyTo`-scoped) | backend | E1 | `.github/scripts/sync-memory.py` | [.github/tests/integration/test_materialize.py](../tests/integration/test_materialize.py) | One dense bullet per descriptor under a scoped `applyTo` header; honors the 8000-token cap intent; test green |

### Category S — Copilot behavior surfaces (replaces the "skills" category)

The loop and promotion policy live on the surfaces that already run them — **Copilot agents** and the
**anti-patterns Copilot skill** — governed by `policy.yaml`. No external engine skills, no bespoke engine
Python.

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | DONE | Self-learning loop wired into agent specs | shared | A1, E1 | `.github/agents/*.agent.md` | [.github/tests/unit/test_agents_have_capture_step.py](../tests/unit/test_agents_have_capture_step.py) | Build agents capture corrections at narrowest scope into the ledger; loop consumes `gan-harness/` evidence; test green |
| S2 | DONE | Scope/fingerprint promotion policy (incl. human gate) | shared | B1, S1 | `.github/memory/policy.yaml`, `.github/docs/memory-architecture.md` | promotion policy documented; ≥2-distinct-fingerprint global gate + human PR approval; model never sets its own scope | Precedence `subsystem>repo>user>global`, ≥2-distinct-fingerprint global gate, human write-approval backstop encoded; verified |
| S3 | DONE | On-demand anti-patterns skill (replaces standing table) | shared | — | `.github/skills/anti-patterns/SKILL.md` | [.github/tests/unit/test_anti_patterns_skill.py](../tests/unit/test_anti_patterns_skill.py), [.github/tests/unit/test_no_standing_ap_table.py](../tests/unit/test_no_standing_ap_table.py) | AP-DRY/EXC/CC/LEN/TOK/NAME/LOC rules matched on demand, not always-on; test green |

### Category G — Shared global store + sync/materialize

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | DONE | Shared global memory git repo (default, Q1) | data | A3 | `.github/memory/global.lock` | [.github/tests/unit/test_global_lock_ref.py](../tests/unit/test_global_lock_ref.py) | Shared store identity pinned by SHA; pull read-only; write only via human-gated promotion; test green (default pending Q1 confirmation) |
| G2 | DONE | Sync + materialize step | backend | G1, A1 | `.github/scripts/sync-memory.py`, `.github/instructions/memory-{repo,global}.instructions.md` | [.github/tests/integration/test_materialize.py](../tests/integration/test_materialize.py) | Pulls the pinned store; materializes applicable repo + global records into `.github/instructions/**` with correct `applyTo`; deterministic + idempotent; secrets never materialized; CC ≤ 8; quality scripts pass |
| G3 | DONE | Materialization freshness guard | backend | G2 | `.github/scripts/sync-memory.py` (`--check`) | [.github/tests/unit/test_materialize_staleness.py](../tests/unit/test_materialize_staleness.py) | `--check` prints STALE / FRESH and exits non-zero when committed `.github/instructions/**` drifts from the stores; test green |

### Category H — Committed context delivery & agent-spec updates

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H1 | DONE | Shared output contract | shared | — | `.github/instructions/output-contract.instructions.md`, `.github/agents/*.agent.md` | [.github/tests/unit/test_output_contract.py](../tests/unit/test_output_contract.py) | One shared contract referenced (not copied) by all build agents; DRY; test green |
| H2 | DONE | Fix `DESIGN.md` → `output/DESIGN.md` reference | shared | — | `.github/agents/coding-agent.agent.md` | [.github/tests/unit/test_design_path_ref.py](../tests/unit/test_design_path_ref.py) | Reference corrected; test green |
| H3 | DONE | Wire `style.yaml` + materialized `.github/instructions/**` into read order | shared | A3, G2 | `.github/agents/*.agent.md` | [.github/tests/unit/test_read_order_materialized.py](../tests/unit/test_read_order_materialized.py) | Every build-agent read order includes the committed style + materialized memory; test green |
| H4 | DONE | Developer-correction capture step | shared | S1, S2 | `.github/agents/*.agent.md` | [.github/tests/unit/test_agents_have_capture_step.py](../tests/unit/test_agents_have_capture_step.py) | Each spec has a capture step emitting `preference/correction` at repo/user scope; test green |

### Category F — Context exclusions

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F7 | DONE | Artifact-safe context exclusions | shared | — | `.gitignore`, `.vscode/settings.json` | [.github/tests/unit/test_context_exclusions.py](../tests/unit/test_context_exclusions.py) | Only regenerable bulk excluded; `output/`, `src/`, `tests/`, `infra/`, `.github/docs/`, `gan-harness/feedback/`, `.github/`, `.github/memory/` never excluded; guard test green |

### Category J — Cleanup / migration

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| J1 | DONE | Migrate existing ledger entries to the schema | data | A1 | `gan-harness/feedback/ledger.jsonl`, `copilotscripts/migrate_ledger.py` | [.github/tests/integration/test_ledger_migrated.py](../tests/integration/test_ledger_migrated.py) | Every existing entry validates against `schema.yaml`; migration script disposable under `copilotscripts/` (`.bak` first, idempotent); test green |
| J2 | DONE | Delete duplicate baseline block | data | C3 | `benchmarks/baseline/metrics.json` | [.github/tests/unit/test_metrics_json_valid.py](../tests/unit/test_metrics_json_valid.py) | Duplicate block removed (net-negative); file valid; test green |
| J3 | DONE | Retire Tier + standing anti-pattern tables | shared | A2, S3 | `AGENTS.md` | [.github/tests/unit/test_no_standing_ap_table.py](../tests/unit/test_no_standing_ap_table.py) | Standing tables removed from always-on context (moved to S3 on-demand skill); net-line-negative; test green |

### Category P — Optional deterministic enforcement module (remaining, only if wanted)

A **plain Python module under `src/memory/`** — no external provider interface. Build **only if** stricter
offline scope/evidence/retrieval gating is wanted beyond the Copilot loop + `policy.yaml`. Each function
is pure, single-responsibility, low-CC. Most intent is already satisfied by Phase A; keep this lean.

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | TODO (optional) | Deterministic scoping (fingerprint-gated) | backend | B1 | `src/memory/scoping.py` | `.github/tests/unit/test_scoping.py` (repo/subsystem require fingerprint equality; global generic; precedence `subsystem>repo>user>global`; scope assigned by loop/context, never by the model) | Pure scoping resolver; model can never set its own scope; CC ≤ 8; quality scripts pass |
| P2 | TODO (optional) | Global-promotion gate (≥2 distinct fingerprints) | backend | P1, G1 | `src/memory/promotion.py` | `.github/tests/unit/test_promotion.py` (global write blocked until evidence spans ≥2 distinct fingerprints; only through the human PR gate) | Deterministic promotion gate over the shared store; CC ≤ 8; quality scripts pass |
| P3 | TODO (optional) | Descriptor-first ranking within the 8000-token cap | ai | P1 | `src/memory/ranking.py` | `.github/tests/unit/test_ranking.py` (descriptors first; top 3–5 by `relevance×confidence×freshness×success_impact`; total ≤ 8000 tokens) | Pure ranking respecting the cap; matches §6.3; CC ≤ 8; quality scripts pass |
| P4 | TODO (optional) | Provenance/citation + retrieval logging | backend | P3, E2 | `src/memory/provenance.py` | `.github/tests/integration/test_provenance.py` (every injected item carries `id`+provenance; retrieved/used/ignored logged; redaction applied; no secret in log) | Auditable injection + replayable retrieval log feeding the loop; CC ≤ 8; quality scripts pass |

### Category I — Memory-quality evaluation (remaining)

| Task ID | Status | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- |
| I1 | DONE | Extend BM-06 (recall + usefulness + cross-repo contamination + staleness + token cost) | ai | C6 | `benchmarks/tasks/BM-06-memory-recall.yaml`, `benchmarks/scripts/check-no-leak.py` | [.github/tests/unit/test_bm06_rubric.py](../tests/unit/test_bm06_rubric.py) | BM-06 rubric extended per §9 with a `dimension` on every criterion; deterministic cross-repo contamination check (`check-no-leak.py`) across two distinct fingerprints; all five dimensions present; test green |

## 5. Test Strategy

- **Unit (local, fast, default).** Pure-function code (`src/memory/fingerprint.py`, `sync-memory.py`
  helpers, any optional `src/memory/*` module) and all data/spec assertions (schema, scope layout,
  global.lock, policy, output contract, read order, capture step, no-standing-table, context exclusions,
  func-length) run under `pytest .github/tests/unit`. Offline — no live Copilot/CLI calls. Target: every pure
  function has a happy-path + one contradiction/edge test.
- **Integration (local).** Cross-component behavior — materialization (`test_materialize.py`), staleness
  guard, ledger migration, task-path resolution, and (remaining) the runner generation seam — runs under
  `pytest .github/tests/integration` plus a PowerShell parse harness (`pwsh`/`powershell -NoProfile`); no cloud
  step.
- **What runs where.** Everything runs **locally**. The benchmark runner calls the **GitHub Copilot CLI
  (`copilot`)** headlessly for generation/llm-judge; deterministic rubric checks are pure Python. The
  shared global store is a git ref pulled read-only; no Azure resource is required.
- **Quality gate (every code task).** Before any code task is "done", run all four scripts against the
  touched Python: `python benchmarks/scripts/check-complexity.py`, `check-loc.py`, `check-duplication.py`,
  and `check-func-length.py`. A task fails if CC > 10 (target ≤ 8), LOC exceeds ceiling, a function
  exceeds the length rule, or duplication > 0.05.
- **Coverage target.** ≥ 90% line coverage on the custom code (`src/memory/fingerprint.py`,
  `.github/scripts/sync-memory.py`, any optional `src/memory/*` module); data/spec tasks proven by explicit
  assertion tests rather than coverage.
- **Regression status.** The Phase A suite (C1–C5/C7, A*, B*, E*, S*, G*, H*, F7, J*) is green today; the
  remaining tests (C6 runner seam, I1, optional P*) are added with their tasks.

## 6. File-Level Change Map

One owning lane per file. `shared` files are merged by the parallel-build-orchestrator. There are far
fewer `src/memory/*` files than a bespoke-engine design: durable memory is git-versioned data +
`sync-memory.py` + the Copilot surfaces; the only optional custom code is the Category P module.

| Path | Action | Status | Owning lane | Purpose |
| --- | --- | --- | --- | --- |
| `.github/memory/schema.yaml` | create | DONE | data | Single record shape — the memory-format convention |
| `.github/memory/policy.yaml` | create | DONE | data | Token-budget + confidence/TTL policy consumed by the Python loop |
| `.github/memory/repo/conventions.yaml` | create | DONE | data | Repo-scoped approved conventions (committed, shareable) |
| `.github/memory/repo/style.yaml` | create | DONE | data | Repo style overrides (beats user prefs); materialization source |
| `.github/memory/global.lock` | create | DONE | data | Pinned ref (git SHA) of the shared global memory store |
| `.github/memory/repo-id` | create | DONE | data | Committed solution identity seeding the fingerprint |
| `AGENTS.md` | modify | DONE | data | Schema pointer + loop config; Tier/AP tables removed |
| `.github/skills/anti-patterns/SKILL.md` | create | DONE | shared | On-demand anti-pattern skill replacing the standing table |
| `.github/scripts/sync-memory.py` | create | DONE | backend | Pull pinned global store + materialize repo+global memory into `.github/instructions/**`; `--check` freshness guard |
| `.github/instructions/memory-global.instructions.md` | create | DONE | shared | Materialized global-approved memory Copilot reads (with `applyTo`) |
| `.github/instructions/memory-repo.instructions.md` | create | DONE | shared | Materialized repo-scoped memory Copilot reads (with `applyTo`) |
| `.github/instructions/output-contract.instructions.md` | create | DONE | shared | Single shared output contract referenced by all build agents |
| `src/memory/fingerprint.py` | create | DONE | backend | Thin deterministic repo fingerprint helper |
| `.gitignore` | modify | DONE | shared | Exclude regenerable bulk only; never artifacts/source |
| `.vscode/settings.json` | modify | DONE | shared | `search.exclude`/`files.watcherExclude` for regenerable dirs; artifacts whitelisted |
| `.github/scripts/lock-baseline.ps1` | modify | DONE | backend | Fix parser error |
| `benchmarks/baseline/metrics.json` | modify | DONE | data | Remove duplicate trailing block |
| `benchmarks/scripts/check-func-length.py` | create | DONE | backend | BM-09-referenced ast length check |
| `benchmarks/fixtures/*` | create | DONE | backend | Fixtures referenced by BM-09/tasks |
| `.github/agents/coding-agent.agent.md` | modify | DONE | shared | Output contract, style+materialized read order, `output/DESIGN.md` fix, capture step |
| `.github/agents/frontend-engineer.agent.md` | modify | DONE | shared | Output contract, read order, capture step |
| `.github/agents/backend-engineer.agent.md` | modify | DONE | shared | Output contract, read order, capture step |
| `.github/agents/ai-engineer.agent.md` | modify | DONE | shared | Output contract, read order, capture step |
| `.github/agents/data-engineer.agent.md` | modify | DONE | shared | Output contract, read order, capture step |
| `gan-harness/feedback/ledger.jsonl` | modify | DONE | data | Migrate entries to the schema convention |
| `copilotscripts/migrate_ledger.py` | create | DONE | data | Throwaway ledger migration (`.bak` first, idempotent) |
| `.github/scripts/run-benchmarks.ps1` | modify | DONE | backend | Runner rework: `copilot` generation seam + Python scorer call; per-task `quality_score`/`passed` populated (C6) |
| `benchmarks/scripts/score-task.py` | create | DONE | backend | Pure-Python rubric scorer: file-exists / regex / custom-script; llm-judge isolated + offline-excluded (C6) |
| `benchmarks/tasks/BM-06-memory-recall.yaml` | modify | DONE | ai | Rubric extended to five dimensions with per-criterion `dimension` (I1) |
| `benchmarks/scripts/check-no-leak.py` | create | DONE | ai | Deterministic cross-repo contamination checker (I1) |
| `src/memory/scoping.py` | create | optional | backend | Deterministic fingerprint-gated scoping (P1) |
| `src/memory/promotion.py` | create | optional | backend | ≥2-distinct-fingerprint global-promotion gate (P2) |
| `src/memory/ranking.py` | create | optional | ai | Descriptor-first ranking within the 8000-token cap (P3) |
| `src/memory/provenance.py` | create | optional | backend | Provenance/citation + replayable retrieval logging (P4) |
| `.github/tests/unit/**`, `.github/tests/integration/**` | create | DONE/TODO | (per lane) | Proving tests owned by the task's lane |

**Not created (no bespoke engine):** `src/memory/ledger.py`, `consolidate.py`, `confidence.py`,
`ab_replay.py`, `human_gate.py`, `redact.py`, `versioning.py`, `lifecycle.py`, `audit_log.py`,
`retrieval/*`, and any external-provider adapter. Their behavior is delivered by the schema +
`.github/memory/policy.yaml` + the Copilot agents + `.github/scripts/sync-memory.py`, and (only if needed) the
optional Category P module.

## 7. Workstream Parallelization

Lanes touch disjoint files. All required tasks (C1–C7, A, B, E, S, G, H, F7, J, I1) are **shipped**. The
only remaining work is the optional Category P enforcement module, which is independent and built only on
request.

| Lane | Specialist agent | Shipped tasks | Remaining tasks | Depends on |
| --- | --- | --- | --- | --- |
| data | data-engineer | A1–A3, B2, C3, E1, G1, J1, J2 | — | — (produced schema + policy + lock contracts) |
| backend | backend-engineer | B1, C1, C2, C4, C5, C6, C7, E2, E3, G2, G3 | P1, P2, P4 (optional) | schema (A1), fingerprint (B1), Copilot CLI availability |
| ai | ai-engineer | I1 | P3 (optional) | runner rework (C6), scoping (P1) |
| shared | parallel-build-orchestrator merges | S1–S3, H1–H4, F7, J3 | — | schema (A1), policy (E1), fingerprint (B1), materialization (G2) |

**Interface contracts** (written to `gan-harness/contracts/`):

| Contract | Producer | Consumer(s) | Shape |
| --- | --- | --- | --- |
| `record-schema` | data (A1) | loop, materialize, optional module | `.github/memory/schema.yaml` — the one record shape all writers/readers validate against |
| `memory-policy` | data (E1) | loop, materialize, runner | `.github/memory/policy.yaml` — confidence/TTL/recall-cap/token-cap knobs |
| `fingerprint` | backend (B1) | loop, optional scoping (P1) | `repo_fingerprint()` precedence repo-id → canonical remote → UUID |
| `global-lock` | data (A3/G1) | materialize (G2), optional promotion (P2) | `.github/memory/global.lock` — pinned SHA of the shared global store |
| `materialized-memory` | backend (G2) | agent specs (H3), Copilot | committed `.github/instructions/**` regenerated from repo+global stores |
| `output-contract` | shared (H1) | shared (H3, H4) | single contract text referenced by all build agents |
| `run-evidence` | backend (C6) | loop, eval (I1) | per-run output + Python rubric result under `gan-harness/runs/<ts>/` |

**Dependency order:** `record-schema` + `memory-policy` + `fingerprint` → runner rework (C6) → eval
extension (I1) are all **shipped**. The optional Category P module (P1 → P2/P3 → P4) is independent and
built only on request.

## 8. Acceptance Rubric

Weights sum to **1.0**. The `verification-evaluator` scores each criterion 0–10; the weighted total gates
the build. Token efficiency, the quality scripts, memory shareability/portability, privacy, and
observability are all first-class, non-zero criteria.

| Criterion | Weight | What "good" looks like |
| --- | --- | --- |
| Correctness | 0.22 | Shipped: the loop runs on Copilot + Python, materialization is deterministic/idempotent, and the runner invokes the `copilot` generation seam + pure-Python rubric scorer (`score-task.py`) per [memory-architecture.md](memory-architecture.md); all named tests green (60 passing) |
| Token efficiency | 0.14 | The 8000-token cap in `policy.yaml` + descriptor-dense, `applyTo`-scoped materialized memory + the on-demand anti-patterns skill reduce standing and retrieved-context tokens vs the pre-change baseline; `tokens_per_loc` on custom code within budget |
| Memory shareability / portability | 0.12 | Durable memory is git-versioned, not machine-local: repo memory is committed under `.github/memory/**`; global-approved memory lives in the shared git repo pinned via `global.lock`; `sync-memory.py` makes applicable memory Copilot-readable in committed `.github/instructions/**`; a fresh clone/second machine gets the same memory with nothing to install |
| Code quality — complexity | 0.10 | [check-complexity.py](../../benchmarks/scripts/check-complexity.py) passes: every custom function CC ≤ 8 target, hard ≤ 10 |
| Code quality — LOC / length | 0.06 | [check-loc.py](../../benchmarks/scripts/check-loc.py) and [check-func-length.py](../../benchmarks/scripts/check-func-length.py) pass: no function/module exceeds the ceiling; functions within the length rule |
| Code quality — duplication | 0.06 | [check-duplication.py](../../benchmarks/scripts/check-duplication.py) passes at ≤ 0.05: one schema, one materialize path, one optional module; no parallel per-scope code paths; no duplicated output-contract prose |
| Security / privacy redaction | 0.10 | Python-side redaction (`is_materializable`) plus any provenance strip secrets/tokens/raw payloads before any write or materialization; no secret in the ledger, materialized files, or retrieval log; human PR gate blocks unapproved global/instruction/materialized-file edits |
| Observability of retrieval | 0.10 | Every injected memory carries `id` + provenance; retrieval (retrieved/used/ignored) and CRUD are logged and replayable via the loop and (if built) the Category P provenance module |
| Documentation | 0.10 | Engine-vs-store split, the Python loop + `policy.yaml`, the shared global store + `global.lock`, and the materialization workflow are reflected in `AGENTS.md` + `.github/docs/`; migration/cleanup net-line-negative and explained |

**Pass threshold:** 7.0 / 10 (weighted total). Any hard failure of a quality script (CC > 10, LOC over
ceiling, function over the length rule, duplication > 0.05) caps the corresponding code-quality criterion
at 0.

## 9. Risks & Rollbacks

**Shipped surface (regression guards)**

- **R1 — Runner rework regresses baseline (C6).** *Risk:* wiring the `copilot` CLI + Python rubric
  alters metric collection. *Mitigation:* `metrics.json` and task YAMLs are independently versioned;
  land the generation seam and the rubric checks in separate commits so each reverts cleanly.
  *Rollback:* revert `run-benchmarks.ps1` to the current placeholder seam — the loop and materialization
  are unaffected.
- **R2 — Shared global store drift / availability (Q1, G1).** *Risk:* the shared memory git repo is
  unreachable, or its `HEAD` moves under solutions. *Mitigation:* `global.lock` pins an **immutable
  SHA** and the store is pulled **read-only**; `sync-memory.py` degrades to repo-scope-only (prints the
  global-unavailable notice) so the loop still runs. *Rollback:* revert `global.lock` to the
  last-known-good SHA; no code change.
- **R3 — Materialization staleness (G2/G3).** *Risk:* committed `.github/instructions/**` drifts from
  the repo/global stores, so Copilot reads outdated memory. *Mitigation:* `sync-memory.py --check`
  prints STALE and exits non-zero; re-run `sync-memory.py` (deterministic/idempotent) to regenerate.
  *Rollback:* the materialized files are git-tracked — `git revert` to the prior consistent state.
- **R4 — Removing standing tables loses enforcement (J3/S3).** *Risk:* anti-pattern checks stop firing
  once the always-on table becomes an on-demand skill. *Mitigation:* the four quality scripts remain
  the enforcement gate; S3 only replaces standing token load. *Rollback:* restore the table section
  from git history.
- **R5 — Context exclusion hides an artifact (F7).** *Risk:* an over-broad exclusion locks `output/`,
  `tests/`, `infra/`, or `gan-harness/feedback/` out of a fix loop. *Mitigation:* F7 excludes only
  regenerable bulk and ships a guard test; index/search exclusions (not content-exclusion) are used.
  *Rollback:* revert `.vscode/settings.json`/`.gitignore` — exclusions are declarative.

**Remaining / optional work**

- **R6 — Copilot CLI unavailable in CI (C6).** *Risk:* the headless `copilot` CLI is not installed on
  the runner host. *Mitigation:* the generation seam is isolated behind one function; deterministic
  Python rubric checks (file-exists/regex/custom-script) run without it, so structural scoring still
  works. *Rollback:* skip the generation step and score only the deterministic rubric.
- **R7 — Optional enforcement module duplicates the loop gates (P).** *Risk:* the Category P module
  re-runs checks the Copilot loop + `policy.yaml` already apply. *Mitigation:* per A8 it *replaces*,
  never parallels, those gates; `check-duplication.py` blocks a duplicate path. *Rollback:* the module
  is optional — omit it; Phase A remains fully functional.
- **R8 — Global-promotion gate over-/under-fires (P2).** *Risk:* the ≥2-distinct-fingerprint gate
  wrongly blocks or leaks a global write. *Mitigation:* pure gate with dedicated unit tests + the BM-06
  contamination case (I1); human PR approval remains required. *Rollback:* revert `promotion.py`;
  global writes fall back to the human-gated PR path.

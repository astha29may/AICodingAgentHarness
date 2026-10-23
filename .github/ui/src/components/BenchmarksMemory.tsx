import { useState } from "react";
import type { MemorySuggestion } from "../types";
import { relativeTime } from "../format";
import { promote, type PromoteKind } from "../api";

interface Props {
  suggestions: MemorySuggestion[];
}

// Coerce any value to a display string (records nest objects like `scope`).
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.level === "string") return o.level; // scope: { level, ... }
    if (typeof o.status === "string") return o.status;
  }
  return "";
}

function toMs(raw: unknown): number | null {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const p = Date.parse(raw);
    return Number.isNaN(p) ? null : p;
  }
  return null;
}

// Best-effort summary of a memory candidate record (shape varies across writers).
function summarizeSuggestion(s: MemorySuggestion) {
  const evidence = (s.evidence ?? {}) as Record<string, unknown>;
  const lifecycle = (s.lifecycle ?? {}) as Record<string, unknown>;
  const promo = (s.promotion ?? {}) as Record<string, unknown>;
  const title =
    asText(s.descriptor) || asText(s.title) || asText(s.rule) || asText(s.conflict_key) || asText(s.id) || "memory candidate";
  const body = asText(s.content) || asText(s.body) || asText(s.text) || asText(s.summary) || asText(s.note);
  const scope = asText(s.scope) || "repo";
  const type = asText(s.type);
  const gate = asText(s.gate) || asText(s.gate_status) || asText(evidence.state) || "pending";
  const confidence = typeof s.confidence === "number" ? s.confidence : null;
  const at =
    toMs(s.at) ?? toMs(s.timestamp) ?? toMs(s.date) ?? toMs(lifecycle.created) ?? toMs(evidence.last_confirmed);
  // agent-feedback's recommended promotion destination (memory | agent | agents-md | skill).
  const recommended = (asText(promo.recommended) || asText(promo.kind) || "memory").toLowerCase();
  const targetPath = asText(promo.target) || asText(promo.path) || "";
  const rationale = asText(promo.rationale) || asText(promo.reason) || "";
  return { id: asText(s.id), title, body, scope, type, gate, confidence, at, recommended, targetPath, rationale };
}

const PROMOTE_KINDS: { value: PromoteKind; label: string }[] = [
  { value: "memory", label: "Memory (conventions.yaml)" },
  { value: "agent", label: "Agent spec" },
  { value: "agents-md", label: "AGENTS.md" },
  { value: "skill", label: "Skill" },
];

function normalizeKind(raw: string): PromoteKind {
  const k = raw === "agents.md" || raw === "agentsmd" ? "agents-md" : raw;
  return (PROMOTE_KINDS.some((x) => x.value === k) ? k : "memory") as PromoteKind;
}

export function BenchmarksMemory({ suggestions = [] }: Props) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Memory</h2>
        <span className="panel__hint">harness self-improvement — not part of the solution</span>
      </div>

      <div className="note-banner">
        Memory learning improves the harness itself. Candidates are minted by the
        <code> agent-feedback</code> agent and promoted with human approval; they are independent of
        the project the harness is building.
      </div>

      <h3 className="subhead">Memory suggestions pending review ({suggestions.length})</h3>
      {suggestions.length === 0 ? (
        <div className="empty">
          No memory candidates awaiting review. The <code>agent-feedback</code> agent mints these to
          <code> gan-harness/feedback/ledger.jsonl</code> for human-approved promotion.
        </div>
      ) : (
        <div className="mem-grid">
          {suggestions.map((s, i) => (
            <MemoryCard key={i} suggestion={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function MemoryCard({ suggestion }: { suggestion: MemorySuggestion }) {
  const m = summarizeSuggestion(suggestion);
  const recommended = normalizeKind(m.recommended);
  const [kind, setKind] = useState<PromoteKind>(recommended);
  const [target, setTarget] = useState<string>(m.targetPath);
  const [busy, setBusy] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsPath = kind === "agent" || kind === "skill";
  const recLabel = PROMOTE_KINDS.find((k) => k.value === recommended)?.label ?? "Memory";

  async function onPromote() {
    if (!m.id) return;
    if (needsPath && !target.trim()) {
      setErr(`Enter the ${kind} file path`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await promote(m.id, kind, needsPath ? target.trim() : undefined);
      setPromoted(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="mem-card">
      <div className="mem-card__top">
        <span className="mem-card__title">{m.title}</span>
        {m.type && <span className="chip chip--small">{m.type}</span>}
        <span className={`chip chip--${m.scope === "global" ? "large" : "medium"}`}>{m.scope}</span>
      </div>
      {m.body && <div className="mem-card__body">{m.body}</div>}

      <div className="mem-card__promo">
        <div className="mem-card__rec">
          <span className="mem-card__rec-label">
            Recommended → {recLabel}
            {m.targetPath ? `: ${m.targetPath}` : ""}
          </span>
          {m.rationale && <span className="mem-card__rec-why">{m.rationale}</span>}
        </div>
        <div className="mem-card__route">
          <select className="mem-select" value={kind} disabled={promoted} onChange={(e) => setKind(e.target.value as PromoteKind)}>
            {PROMOTE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          {needsPath && (
            <input
              className="mem-input"
              value={target}
              disabled={promoted}
              placeholder={kind === "agent" ? ".github/agents/<name>.agent.md" : ".github/skills/<name>/SKILL.md"}
              onChange={(e) => setTarget(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="mem-card__foot">
        <span className="mem-card__time">
          {m.confidence != null && <>confidence {m.confidence.toFixed(2)} · </>}
          {m.gate} · {relativeTime(m.at)}
        </span>
        <button className="promote-btn" disabled={busy || promoted || !m.id} onClick={onPromote}>
          {promoted ? "✓ Promoted" : busy ? "…" : "Promote"}
        </button>
      </div>
      {err && <div className="mem-card__err">{err}</div>}
    </article>
  );
}

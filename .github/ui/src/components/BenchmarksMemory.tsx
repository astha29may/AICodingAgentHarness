import { useState } from "react";
import type { MemorySuggestion } from "../types";
import { relativeTime } from "../format";
import { promoteMemory } from "../api";

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
  const title =
    asText(s.descriptor) || asText(s.title) || asText(s.rule) || asText(s.conflict_key) || asText(s.id) || "memory candidate";
  const body = asText(s.content) || asText(s.body) || asText(s.text) || asText(s.summary) || asText(s.note);
  const scope = asText(s.scope) || "repo";
  const type = asText(s.type);
  const gate = asText(s.gate) || asText(s.gate_status) || asText(evidence.state) || "pending";
  const confidence = typeof s.confidence === "number" ? s.confidence : null;
  const at =
    toMs(s.at) ?? toMs(s.timestamp) ?? toMs(s.date) ?? toMs(lifecycle.created) ?? toMs(evidence.last_confirmed);
  return { id: asText(s.id), title, body, scope, type, gate, confidence, at };
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
  const [busy, setBusy] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onPromote() {
    if (!m.id) return;
    setBusy(true);
    setErr(null);
    try {
      await promoteMemory(m.id);
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

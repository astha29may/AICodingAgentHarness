import { useMemo, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Deliverable } from "../types";
import { deliverableStatusColor, relativeTime } from "../format";
import { approveStage } from "../api";

interface Props {
  deliverables: Deliverable[];
}

marked.setOptions({ gfm: true, breaks: false });

export function DeliverablesViewer({ deliverables }: Props) {
  const [activeId, setActiveId] = useState<string>(deliverables[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = deliverables.find((d) => d.id === activeId) ?? deliverables[0];

  const html = useMemo(() => {
    if (!active?.content?.trim()) return "";
    const raw = marked.parse(active.content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [active?.content]);

  async function onApprove(approved: boolean) {
    if (!active?.approval?.key) return;
    setBusy(true);
    setErr(null);
    try {
      await approveStage(active.approval.key, approved);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ap = active?.approval;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Deliverables</h2>
        <span className="panel__hint">problem · design · gaps · plan · approvals</span>
      </div>
      <div className="deliverables">
        <nav className="deliverables__nav">
          {deliverables.map((d) => (
            <button
              key={d.id}
              className={`deliverables__tab ${d.id === active?.id ? "is-active" : ""}`}
              onClick={() => setActiveId(d.id)}
            >
              <span
                className="deliverables__dot"
                style={{ background: deliverableStatusColor(d.status) }}
              />
              <span className="deliverables__tab-title">{d.title}</span>
              {d.approval?.awaiting ? (
                <span className="chip chip--awaiting">approve</span>
              ) : d.approval?.approved ? (
                <span className="chip chip--complete">✓</span>
              ) : (
                <span className={`chip chip--${d.status}`}>
                  {d.status === "coming-soon" ? "soon" : d.status}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="deliverables__body">
          {active && (
            <div className="deliverables__meta">
              <code>{active.rel}</code>
              <span>by {active.agent}</span>
              <span>updated {relativeTime(active.updatedAt)}</span>
              {active.openGaps != null && <span>{active.openGaps} open gaps</span>}
            </div>
          )}

          {ap?.required && (
            <div className={`approval ${ap.approved ? "approval--ok" : ap.awaiting ? "approval--pending" : "approval--none"}`}>
              {ap.approved ? (
                <>
                  <span className="approval__badge">✓ Approved</span>
                  <span className="approval__text">Approved {relativeTime(ap.at)} — downstream stages may proceed.</span>
                  <button className="approval__btn approval__btn--ghost" disabled={busy} onClick={() => onApprove(false)}>
                    Revoke
                  </button>
                </>
              ) : ap.awaiting ? (
                <>
                  <span className="approval__badge approval__badge--wait">⏸ Checkpoint</span>
                  <span className="approval__text">
                    {active?.title} is complete and needs sign-off before the harness continues.
                  </span>
                  <button className="approval__btn" disabled={busy} onClick={() => onApprove(true)}>
                    {busy ? "…" : `Approve ${active?.title}`}
                  </button>
                </>
              ) : (
                <span className="approval__text">Approval opens once {active?.title} is complete.</span>
              )}
              {err && <span className="approval__err">{err}</span>}
            </div>
          )}

          {html ? (
            <article className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
          ) : active?.status === "coming-soon" ? (
            <div className="empty">
              <strong>Coming soon.</strong> The Build Report is auto-generated at the end of a passing
              run (summary of scores, gates, and evidence). This closeout step isn’t wired into the
              pipeline yet — it will appear here once the harness writes
              <code> gan-harness/build-report.md</code>.
            </div>
          ) : (
            <div className="empty">
              {active?.exists
                ? "This deliverable is still an empty template."
                : "Not generated yet — run the harness stage that produces it."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

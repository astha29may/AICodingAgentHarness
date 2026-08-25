import type { ActivityEvent, LedgerEntry, IterationScore } from "../types";
import { relativeTime } from "../format";

interface Props {
  entries: LedgerEntry[];
  iterations: IterationScore[];
  activity: ActivityEvent[];
}

function summarize(entry: LedgerEntry): { title: string; sub: string; at: number | null } {
  const title =
    (entry.agent as string) ??
    (entry.title as string) ??
    (entry.stage as string) ??
    "ledger entry";
  const sub =
    (entry.summary as string) ??
    (entry.note as string) ??
    (entry.deviation as string) ??
    (entry.severity as string) ??
    "";
  const rawAt = (entry.at ?? entry.timestamp ?? entry.date) as string | number | undefined;
  let at: number | null = null;
  if (typeof rawAt === "number") at = rawAt;
  else if (typeof rawAt === "string") {
    const parsed = Date.parse(rawAt);
    at = Number.isNaN(parsed) ? null : parsed;
  }
  return { title, sub, at };
}

export function LedgerTimeline({ entries, iterations, activity }: Props) {
  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Feedback &amp; activity</h2>
        <span className="panel__hint">live events · ledger · iterations</span>
      </div>

      <div className="timeline">
        <div className="timeline__col">
          <div className="timeline__label">Live file activity</div>
          <div className="feed">
            {activity.length === 0 && <div className="empty">Waiting for harness activity…</div>}
            {activity.map((ev, i) => (
              <div key={`${ev.path}-${ev.at}-${i}`} className={`feed__row feed__row--${ev.type}`}>
                <span className={`feed__tag feed__tag--${ev.type}`}>{ev.type}</span>
                <span className="feed__path" title={ev.path}>
                  {ev.path}
                </span>
                <span className="feed__time">{relativeTime(ev.at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="timeline__col">
          <div className="timeline__label">Feedback ledger</div>
          <div className="feed">
            {entries.length === 0 && (
              <div className="empty">No ledger entries yet in gan-harness/feedback/ledger.jsonl.</div>
            )}
            {entries.slice(0, 30).map((entry, i) => {
              const s = summarize(entry);
              return (
                <div key={i} className="ledger__row">
                  <div className="ledger__title">{s.title}</div>
                  {s.sub && <div className="ledger__sub">{s.sub}</div>}
                  <div className="ledger__time">{relativeTime(s.at)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="timeline__col">
          <div className="timeline__label">Iterations</div>
          <div className="feed">
            {iterations.length === 0 && <div className="empty">No evaluator iterations yet.</div>}
            {iterations.map((it) => (
              <div key={it.file} className="iter__row">
                <span className="iter__num">iter {it.iteration}</span>
                <span className="iter__file">{it.file}</span>
                {it.score != null && <span className="iter__score">{it.score.toFixed(1)}/10</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

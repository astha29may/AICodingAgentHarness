import type { Agent } from "../types";
import { fmtCompact, relativeTime } from "../format";

interface Props {
  agents: Agent[];
}

const statusLabel: Record<string, string> = {
  working: "Working",
  done: "Done",
  idle: "Idle",
};

export function AgentBoard({ agents }: Props) {
  const maxTokens = Math.max(1, ...agents.map((a) => a.utilization.tokens));

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Agent activity</h2>
        <span className="panel__hint">who is working · utilization</span>
      </div>
      <div className="agent-grid">
        {agents.map((a) => (
          <article key={a.name} className={`agent agent--${a.status}`}>
            <div className="agent__top">
              <span className={`agent__pulse agent__pulse--${a.status}`} />
              <div className="agent__name">{a.name}</div>
              <span className={`badge badge--${a.status}`}>{statusLabel[a.status]}</span>
            </div>
            <div className="agent__role">{a.role}</div>
            <p className="agent__desc">{a.description || "No description."}</p>
            <div className="agent__util">
              <div className="agent__util-bar">
                <div
                  className="agent__util-fill"
                  style={{ width: `${(a.utilization.tokens / maxTokens) * 100}%` }}
                />
              </div>
              <div className="agent__util-meta">
                <span>
                  {fmtCompact(a.utilization.tokens)} tok
                  {a.utilization.estimated && a.utilization.tokens > 0 ? " (est)" : ""}
                </span>
                {a.utilization.iterations > 0 && <span>{a.utilization.iterations} iter</span>}
                <span>{relativeTime(a.lastActiveAt)}</span>
              </div>
            </div>
          </article>
        ))}
        {agents.length === 0 && <div className="empty">No agents found in .github/agents/.</div>}
      </div>
    </section>
  );
}

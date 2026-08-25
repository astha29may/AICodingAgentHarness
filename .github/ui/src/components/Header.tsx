import type { HarnessState } from "../types";
import type { ConnectionStatus } from "../useHarnessState";
import { fmtCompact, relativeTime } from "../format";

interface Props {
  state: HarnessState;
  connection: ConnectionStatus;
}

const connLabel: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
};

export function Header({ state, connection }: Props) {
  const s = state.summary;
  const stats = [
    { label: "Agents working", value: `${s.agentsWorking}`, tone: "accent" },
    { label: "Agents done", value: `${s.agentsDone}/${s.agentsTotal}`, tone: "ok" },
    { label: "Tasks done", value: s.tasksTotal ? `${s.tasksDone}/${s.tasksTotal}` : "—", tone: "default" },
    { label: "Deliverables", value: `${s.deliverablesComplete}/${s.deliverablesTotal}`, tone: "default" },
    { label: "Approvals pending", value: `${s.approvalsPending}`, tone: s.approvalsPending > 0 ? "warn" : "ok" },
    { label: "Open gaps", value: `${s.openGaps}`, tone: s.openGaps > 0 ? "warn" : "ok" },
    { label: "Iterations", value: `${s.iterations}`, tone: "default" },
    {
      label: s.tokensEstimated ? "Project tokens (est)" : s.iterations > 0 ? "Project tokens / latest iter" : "Project tokens",
      value: fmtCompact(s.totalTokens),
      tone: "default",
    },
  ];

  // Measured split from the chat debug log: output is metered, input is fresh (uncached) prompt.
  if (s.outputTokens != null || s.inputTokens != null) {
    stats.push({ label: "Input (fresh)", value: fmtCompact(s.inputTokens ?? 0), tone: "default" });
    stats.push({ label: "Output (measured)", value: fmtCompact(s.outputTokens ?? 0), tone: "default" });
  }

  return (
    <header className="header">
      <div className="header__title">
        <h1>Harness Control Room</h1>
        <div className={`conn conn--${connection}`}>
          <span className="conn__dot" />
          {connLabel[connection]} · updated {relativeTime(state.generatedAt)}
        </div>
      </div>
      <div className="header__stats">
        {stats.map((st) => (
          <div key={st.label} className={`stat stat--${st.tone}`}>
            <div className="stat__value">{st.value}</div>
            <div className="stat__label">{st.label}</div>
          </div>
        ))}
      </div>
      <div className="pipeline">
        {state.pipeline.map((p) => (
          <div key={p.stage} className={`pipeline__stage pipeline__stage--${p.status}`}>
            <span className="pipeline__dot" />
            <div className="pipeline__stage-body">
              <div className="pipeline__stage-name">{p.stage}</div>
              <div className="pipeline__stage-agent">{p.agent}</div>
            </div>
          </div>
        ))}
      </div>
    </header>
  );
}

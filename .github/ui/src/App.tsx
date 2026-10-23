import { useState } from "react";
import { useHarnessState } from "./useHarnessState";
import { Header } from "./components/Header";
import { AgentBoard } from "./components/AgentBoard";
import { DeliverablesViewer } from "./components/DeliverablesViewer";
import { PlanBoard } from "./components/PlanBoard";
import { TestsBoard } from "./components/TestsBoard";
import { EfficiencyCharts } from "./components/EfficiencyCharts";
import { LedgerTimeline } from "./components/LedgerTimeline";
import { BenchmarksMemory } from "./components/BenchmarksMemory";
import type { HarnessState } from "./types";

type TabId = "agents" | "deliverables" | "tasks" | "tests" | "efficiency" | "feedback" | "memory";

function tabs(state: HarnessState): { id: TabId; label: string; badge: string }[] {
  const s = state.summary;
  return [
    { id: "agents", label: "Agents", badge: `${s.agentsWorking}▸ ${s.agentsDone}✓` },
    { id: "deliverables", label: "Deliverables", badge: s.approvalsPending ? `${s.approvalsPending}⏸` : `${s.deliverablesComplete}/${s.deliverablesTotal}` },
    { id: "tasks", label: "Tasks", badge: s.tasksTotal ? `${s.tasksDone}/${s.tasksTotal}` : "" },
    { id: "tests", label: "Tests", badge: `${s.testCases || ""}` },
    { id: "efficiency", label: "Efficiency", badge: "" },
    { id: "feedback", label: "Feedback", badge: `${state.ledger.entries.length || ""}` },
    { id: "memory", label: "Memory", badge: `${s.memorySuggestions ? `${s.memorySuggestions}!` : ""}` },
  ];
}

export function App() {
  const { state, connection, error } = useHarnessState();
  const [tab, setTab] = useState<TabId>("agents");

  if (!state) {
    return (
      <div className="loading">
        <div className="loading__spinner" />
        <div>Connecting to harness…</div>
        {error && <div className="loading__error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <Header state={state} connection={connection} />

      <nav className="tabs">
        {tabs(state).map((t) => (
          <button
            key={t.id}
            className={`tabs__btn ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge && <span className="tabs__badge">{t.badge}</span>}
          </button>
        ))}
      </nav>

      <main className="tab-panel">
        {tab === "agents" && <AgentBoard agents={state.agents} />}
        {tab === "deliverables" && <DeliverablesViewer deliverables={state.deliverables} />}
        {tab === "tasks" && <PlanBoard plan={state.plan} />}
        {tab === "tests" && <TestsBoard tests={state.tests} />}
        {tab === "efficiency" && (
          <EfficiencyCharts
            rows={state.efficiency.rows}
            agents={state.agents}
            iterations={state.ledger.iterations}
          />
        )}
        {tab === "feedback" && (
          <LedgerTimeline
            entries={state.ledger.entries}
            iterations={state.ledger.iterations}
            activity={state.activity}
          />
        )}
        {tab === "memory" && (
          <BenchmarksMemory suggestions={state.memorySuggestions} />
        )}
      </main>
    </div>
  );
}

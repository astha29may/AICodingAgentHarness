import { useState } from "react";
import type { TestsState, TestGroup } from "../types";

interface Props {
  tests: TestsState;
}

// Friendly label + one-line role for each owning lane shown as a sub-tab.
const AGENT_META: Record<string, { label: string; role: string }> = {
  "backend-engineer": { label: "Backend", role: "API, contracts, auth, security, e2e & verification tests" },
  "ai-engineer": { label: "AI", role: "LLM client, prompts & model tests" },
  "data-engineer": { label: "Data", role: "Session store & persistence tests" },
  "frontend-engineer": { label: "Frontend", role: "UI components, routing & a11y tests" },
  "observability-engineer": { label: "Observability", role: "Telemetry, health, container & smoke tests" },
};

const TYPE_ORDER = ["unit", "integration", "functional", "contract", "e2e", "security", "smoke", "verification"];

function agentLabel(agent: string): string {
  return AGENT_META[agent]?.label ?? agent;
}

export function TestsBoard({ tests }: Props) {
  const groups = tests.groups ?? [];
  const [active, setActive] = useState<string>(groups[0]?.agent ?? "");
  const current = groups.find((g) => g.agent === active) ?? groups[0];

  const typeChips = TYPE_ORDER.filter((t) => (tests.byType?.[t] ?? 0) > 0).map((t) => ({
    type: t,
    n: tests.byType[t],
  }));

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Tests</h2>
        <span className="panel__hint">
          {tests.total} cases · {tests.files} files — what validates each stage, by agent
        </span>
      </div>

      {typeChips.length > 0 && (
        <div className="test-summary">
          {typeChips.map((c) => (
            <span key={c.type} className={`chip chip--${c.type}`}>
              {c.type} · {c.n}
            </span>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty">
          No tests discovered yet. They appear here as the build lanes author files under
          <code> tests/</code> and the verification stage runs.
        </div>
      ) : (
        <>
          <nav className="subtabs">
            {groups.map((g) => (
              <button
                key={g.agent}
                className={`subtabs__btn ${g.agent === active ? "is-active" : ""}`}
                onClick={() => setActive(g.agent)}
              >
                {agentLabel(g.agent)}
                <span className="subtabs__badge">{g.caseCount}</span>
              </button>
            ))}
          </nav>

          {current && <GroupView group={current} />}
        </>
      )}

      {/* Validation gates apply across all lanes, so they live below the lane sub-tabs. */}
      {(tests.rubric.length > 0 || tests.reviewChecks.length > 0) && (
        <div className="test-gates">
          <h3 className="subhead">Validation gates — applied across all lanes</h3>
          <div className="test-gates__grid">
            {tests.rubric.length > 0 && (
              <div className="test-checklist">
                <div className="test-gates__title">Acceptance rubric · verification-evaluator</div>
                <table className="rubric">
                  <thead>
                    <tr>
                      <th>Criterion</th>
                      <th>Weight</th>
                      <th>Measurable acceptance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tests.rubric.map((r) => (
                      <tr key={r.criterion}>
                        <td>{r.criterion}</td>
                        <td className="rubric__w">{r.weight}</td>
                        <td className="rubric__d">{r.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tests.reviewChecks.length > 0 && (
              <div className="test-checklist">
                <div className="test-gates__title">Review checklist · code-reviewer</div>
                <ul className="review-list">
                  {tests.reviewChecks.map((c) => (
                    <li key={c.name}>
                      <span className="review-list__name">{c.name}</span>
                      <span className="review-list__detail">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function GroupView({ group }: { group: TestGroup }) {
  const meta = AGENT_META[group.agent];
  return (
    <div className="test-group">
      <div className="test-group__head">
        <span className="test-group__role">{meta?.role ?? group.agent}</span>
        <span className="test-group__count">
          {group.files.length} files · {group.caseCount} cases
        </span>
      </div>

      <h3 className="subhead">Test files ({group.files.length})</h3>
      <div className="test-files">
        {group.files.map((f) => (
          <TestFileCard key={f.path} name={f.name} path={f.path} type={f.type} cases={f.cases} count={f.count} />
        ))}
      </div>
    </div>
  );
}

function TestFileCard({
  name,
  path,
  type,
  cases,
  count,
}: {
  name: string;
  path: string;
  type: string;
  cases: string[];
  count: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article className="test-file">
      <button className="test-file__head" onClick={() => setOpen((v) => !v)}>
        <span className={`chip chip--${type}`}>{type}</span>
        <span className="test-file__name">{name}</span>
        <span className="test-file__count">{count}</span>
        <span className="test-file__caret">{open ? "▾" : "▸"}</span>
      </button>
      <div className="test-file__path">{path}</div>
      {open && cases.length > 0 && (
        <ul className="test-file__cases">
          {cases.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

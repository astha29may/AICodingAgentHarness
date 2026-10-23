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

function resultClass(r: string): string {
  if (r === "passed") return "ok";
  if (r === "failed" || r === "error") return "fail";
  return "muted";
}

function resultLabel(r: string): string {
  if (r === "passed") return "passed";
  if (r === "failed") return "failed";
  if (r === "error") return "error";
  return "not run";
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
          {tests.total} cases · {tests.files} files — what each test verifies, by lane
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

      {tests.hasResults ? (
        <div className="test-results-sum">
          <span className="res res--ok">{tests.results.passed} passed</span>
          <span className="res res--fail">{tests.results.failed} failed</span>
          <span className="res res--muted">{tests.results.notRun} not run</span>
          {tests.generated && <span className="test-results-when">as of {tests.generated}</span>}
        </div>
      ) : (
        groups.length > 0 && (
          <div className="note-banner">
            Results appear once verification runs <code>.github/scripts/collect-test-results.py</code>{" "}
            (JUnit → <code>gan-harness/test-results.json</code>). Until then each case shows “not run”.
          </div>
        )
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

          {current && <GroupTable group={current} />}
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

function GroupTable({ group }: { group: TestGroup }) {
  const meta = AGENT_META[group.agent];
  return (
    <div className="test-group">
      <div className="test-group__head">
        <span className="test-group__role">{meta?.role ?? group.agent}</span>
        <span className="test-group__count">
          {group.fileCount} files · {group.caseCount} cases
        </span>
      </div>

      <table className="test-table">
        <thead>
          <tr>
            <th>Test case</th>
            <th>Type</th>
            <th>Result</th>
            <th>Issue</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody>
          {group.cases.map((c, i) => {
            const failed = c.result === "failed" || c.result === "error";
            return (
              <tr key={`${c.file}:${c.name}:${i}`}>
                <td className="tc-desc">
                  <span title={c.name}>{c.description}</span>
                </td>
                <td>
                  <span className={`chip chip--${c.type}`}>{c.type}</span>
                </td>
                <td>
                  <span className={`res res--${resultClass(c.result)}`}>{resultLabel(c.result)}</span>
                </td>
                <td className="tc-issue">{failed ? c.message || "—" : ""}</td>
                <td className="tc-file">
                  <span title={c.file}>{c.file}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

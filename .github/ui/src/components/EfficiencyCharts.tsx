import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Agent, EfficiencyRow, IterationScore } from "../types";
import { fmtCompact } from "../format";

interface Props {
  rows: EfficiencyRow[];
  agents: Agent[];
  iterations: IterationScore[];
}

const AXIS = { fontSize: 11, fill: "var(--muted)" };
const gridStroke = "rgba(255,255,255,0.06)";

export function EfficiencyCharts({ rows, agents, iterations }: Props) {
  const tokenSeries = rows.map((r, i) => ({
    name: r.date || `#${i + 1}`,
    tokens: r.tokens,
    input: r.inputTokens,
    output: r.outputTokens,
    quality: r.quality,
    tokPerQ: r.tokPerQ,
  }));

  const splitSeries = tokenSeries.filter((d) => d.input > 0 || d.output > 0);
  const hasSplit = splitSeries.length > 0;

  const utilByAgent = agents
    .filter((a) => a.utilization.tokens > 0)
    .map((a) => ({ name: a.name, tokens: a.utilization.tokens, status: a.status }));

  const scoreSeries = iterations
    .filter((it) => it.score != null)
    .map((it) => ({ name: `iter ${it.iteration}`, score: it.score }));

  const hasData = rows.length > 0 || utilByAgent.length > 0 || scoreSeries.length > 0;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Efficiency &amp; utilization</h2>
        <span className="panel__hint">tokens · quality · scores</span>
      </div>

      {!hasData && (
        <div className="empty">
          No efficiency data yet. Rows appear as the harness logs to
          <code> gan-harness/efficiency-log.csv</code>.
        </div>
      )}

      {hasData && (
        <div className="charts">
          {tokenSeries.length > 0 && (
            <div className="chart">
              <div className="chart__title">Token usage over time</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={tokenSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="tok" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCompact(v)} />
                  <Area type="monotone" dataKey="tokens" stroke="var(--accent)" fill="url(#tok)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {hasSplit && (
            <div className="chart">
              <div className="chart__title">Input vs output per iteration (measured)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={splitSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCompact(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="input" name="Input (fresh)" fill="var(--accent-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="output" name="Output (measured)" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="chart">
            <div className="chart__title">Tokens by agent</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={utilByAgent} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={fmtCompact} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCompact(v)} />
                <Bar dataKey="tokens" radius={[4, 4, 0, 0]}>
                  {utilByAgent.map((d) => (
                    <Cell key={d.name} fill={d.status === "working" ? "var(--accent)" : "var(--accent-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {tokenSeries.length > 0 && (
            <div className="chart">
              <div className="chart__title">Quality vs tokens/quality-point</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={tokenSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="quality" stroke="var(--ok)" dot={false} />
                  <Line type="monotone" dataKey="tokPerQ" stroke="var(--warn)" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {scoreSeries.length > 0 && (
            <div className="chart">
              <div className="chart__title">Evaluator score by iteration</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={scoreSeries} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 10]} tick={AXIS} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const tooltipStyle = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text)",
};

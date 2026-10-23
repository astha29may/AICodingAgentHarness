// Builds the harness state snapshot by reading the repository's file-based state.
// Pure reads only — never writes to the repo. Tolerant of missing/empty files so the
// dashboard works on a fresh harness as well as a running one.
import { promises as fs } from "node:fs";
import path from "node:path";
import YAML from "yaml";

// Stage → agent → primary deliverable. Drives the pipeline lane and agent status.
export const PIPELINE = [
  {
    stage: "problem-statement",
    agent: "problem-statement-creation",
    deliverables: ["output/PROBLEMSTATEMENT.md"],
  },
  {
    stage: "architecture",
    agent: "technical-architect",
    deliverables: ["output/DESIGN.md", "output/TechnicalGaps.md"],
  },
  {
    stage: "implementation-plan",
    agent: "implementation-planner",
    deliverables: ["output/IMPLEMENTATIONPLAN.md"],
  },
  {
    stage: "build",
    agent: "parallel-build-orchestrator",
    deliverables: ["src", "gan-harness/contracts"],
  },
  { stage: "coding", agent: "coding-agent", deliverables: ["src", "tests"] },
  { stage: "review", agent: "code-reviewer", deliverables: ["gan-harness/feedback"] },
  {
    stage: "verification",
    agent: "verification-evaluator",
    deliverables: ["gan-harness/build-report.md"],
  },
];

// Files that, when changed, mean the mapped agent is actively working right now.
// Files/dirs each agent owns. Drives activity ("working"), completion ("done"), and the
// produced-bytes utilization estimate. Includes the parallel-build lane specialists so their
// work under src/<lane> and tests/<lane> shows on the board during fan-out.
const AGENT_OWNS = {
  "problem-statement-creation": ["output/PROBLEMSTATEMENT.md"],
  "technical-architect": ["output/DESIGN.md", "output/TechnicalGaps.md"],
  "implementation-planner": ["output/IMPLEMENTATIONPLAN.md"],
  "parallel-build-orchestrator": ["gan-harness/contracts"],
  "backend-engineer": ["src/backend", "tests/backend", "infra", "tests/infra"],
  "ai-engineer": ["src/ai", "tests/ai"],
  "frontend-engineer": ["src/frontend", "tests/frontend"],
  "data-engineer": ["src/data", "tests/data"],
  "observability-engineer": ["src/observability", "src/backend/observability.py", "src/backend/health.py"],
  // coding-agent is the single-change/fix agent, not the greenfield builder. It intentionally has
  // no broad src/tests ownership so it never double-counts the parallel-build lanes' output; its
  // run state comes from the explicit run signal (agent-activity.jsonl) when it is dispatched.
  "code-reviewer": ["gan-harness/feedback"],
  "verification-evaluator": ["gan-harness/build-report.md", "gan-harness/feedback"],
  "agent-feedback": ["gan-harness/feedback/ledger.jsonl", "gan-harness/feedback/agents"],
};

// Build-lane specialists: "done" is inferred from produced files (no markdown deliverable).
const BUILD_LANES = new Set([
  "backend-engineer",
  "ai-engineer",
  "frontend-engineer",
  "data-engineer",
  "observability-engineer",
]);

// Topical detection for cross-cutting agents whose output can land anywhere in the tree.
// Files whose path matches the pattern are attributed to the agent regardless of folder layout.
const AGENT_KEYWORDS = {
  "observability-engineer":
    /observ|telemetr|otel|opentelemetry|logging|logger|metrics?|tracing|\btrace\b|health(z|check)?|monitor|instrument|app[_-]?insights/i,
};

// Directories never scanned for topical attribution (harness internals, deps, build output).
// The harness dashboard now lives under .github/ (already skipped), so the project's own top-level
// ui/ is intentionally NOT skipped — the frontend lane's work there should be attributed.
const SCAN_SKIP = new Set([
  "node_modules", "__pycache__", "dist", ".git", ".github", "gan-harness",
  "benchmarks", "templates", "output", "docs", ".agents", "copilotscripts", ".vite", ".venv", "venv",
]);

// Walk the project tree (bounded, denylisted) and return relative paths matching a keyword pattern.
async function scanByKeyword(repoRoot, regex, maxDepth = 7) {
  const matches = [];
  async function walk(absDir, relDir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") || SCAN_SKIP.has(e.name)) continue;
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(path.join(absDir, e.name), rel, depth + 1);
      } else if (!e.name.endsWith(".pyc") && regex.test(rel)) {
        matches.push(rel);
      }
    }
  }
  await walk(repoRoot, "", 0);
  return matches;
}

const STUB_MARKERS = ["Not specified in provided context.", "TODO: Add details", "<Project", "<System", "<Name"];
const ACTIVE_WINDOW_MS = 45_000;

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readText(p) {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return "";
  }
}

async function statMtime(p) {
  try {
    const s = await fs.stat(p);
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

// Total bytes of a file, or of text files under a directory (bounded, skips junk).
async function textBytes(abs, depth = 5) {
  try {
    const st = await fs.stat(abs);
    if (st.isFile()) return st.size;
    if (st.isDirectory() && depth > 0) {
      let total = 0;
      for (const e of await fs.readdir(abs, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === "dist" || e.name === "__pycache__" || e.name.startsWith(".")) continue;
        if (e.isFile() && (e.name.endsWith(".pyc") || e.name.endsWith(".pyo"))) continue; // compiled caches
        if (e.isFile() && /^readme\.md$/i.test(e.name)) continue; // scaffolding docs, not agent-produced output
        total += await textBytes(path.join(abs, e.name), depth - 1);
      }
      return total;
    }
  } catch {
    /* missing path */
  }
  return 0;
}

function parseFrontmatter(md) {
  if (!md.startsWith("---")) return {};
  const end = md.indexOf("\n---", 3);
  if (end === -1) return {};
  const block = md.slice(3, end).trim();
  try {
    return YAML.parse(block) ?? {};
  } catch {
    return {};
  }
}

function firstLine(text, max = 200) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

// ── Agents ────────────────────────────────────────────────────────────────────
async function loadAgents(repoRoot, recentActivity, effByAgent, plan, runSignal) {
  const dir = path.join(repoRoot, ".github", "agents");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".agent.md"));
  } catch {
    files = [];
  }

  const now = Date.now();
  const recentPaths = recentActivity.map((a) => a.path);

  // Project-specific lane ownership from the plan: each task's lane + target files.
  // This matches the actual layout (e.g. backend code under src/api) instead of guessing.
  const laneToAgent = {
    backend: "backend-engineer",
    frontend: "frontend-engineer",
    ai: "ai-engineer",
    data: "data-engineer",
  };
  const planOwns = {};
  for (const t of plan?.tasks ?? []) {
    const agentName = laneToAgent[(t.lane || "").toLowerCase()];
    if (!agentName || !t.targets?.length) continue;
    (planOwns[agentName] ??= []).push(...t.targets);
  }

  // Topical (keyword) ownership for cross-cutting agents — layout-agnostic, from actual files.
  const keywordOwns = {};
  for (const [agentName, regex] of Object.entries(AGENT_KEYWORDS)) {
    keywordOwns[agentName] = await scanByKeyword(repoRoot, regex);
  }

  const agents = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const md = await readText(full);
    const fm = parseFrontmatter(md);
    const name = fm.name ?? file.replace(/\.agent\.md$/, "");
    const description = typeof fm.description === "string" ? firstLine(fm.description) : "";

    const stageEntry = PIPELINE.find((p) => p.agent === name);
    const isLane = BUILD_LANES.has(name);
    const role = stageEntry?.stage ?? (isLane ? "build" : "support");
    // Static conventions plus plan-derived and topical (keyword) ownership, deduped.
    const owns = [
      ...new Set([...(AGENT_OWNS[name] ?? []), ...(planOwns[name] ?? []), ...(keywordOwns[name] ?? [])]),
    ];

    // Active if any owned relative path was touched inside the active window.
    const lastTouch = recentActivity
      .filter((a) => owns.some((w) => a.path === w || a.path.startsWith(w + "/")))
      .reduce((max, a) => Math.max(max, a.at), 0);
    const isActive = lastTouch > 0 && now - lastTouch < ACTIVE_WINDOW_MS;

    // Completion + produced bytes from the agent's owned paths. Markdown deliverables are
    // "done" when non-stub; build lanes are "done" once they've produced any owned files.
    let done = false;
    let producedBytes = 0;
    for (const rel of owns) {
      const abs = path.join(repoRoot, rel);
      if (rel.endsWith(".md")) {
        const content = await readText(abs);
        if (content && !isStub(content)) done = true;
        producedBytes += Buffer.byteLength(content);
      } else {
        const bytes = await textBytes(abs);
        producedBytes += bytes;
        if (isLane && bytes > 0) done = true;
      }
    }

    let status = "idle";
    // Explicit run signal wins: an agent marked "start" is running wherever its code lives.
    const signal = runSignal?.get(name);
    const running = signal?.event === "start";
    const ended = signal?.event === "end";
    if (running || isActive) status = "working";
    else if (ended || done) status = "done";

    // Prefer real telemetry from the efficiency log; otherwise estimate ~4 bytes/token
    // from the artifacts the agent produced so finished stages show utilization.
    const logged = effByAgent.get(name);
    const util =
      logged && logged.tokens > 0
        ? { ...logged, estimated: false }
        : {
            tokens: Math.round(producedBytes / 4),
            iterations: logged?.iterations ?? 0,
            samples: logged?.samples ?? 0,
            estimated: producedBytes > 0,
          };

    agents.push({
      name,
      role,
      description,
      status,
      lastActiveAt: (running ? signal.at : lastTouch) || (ended ? signal.at : null),
      isWatched: recentPaths.some((p) => owns.some((w) => p === w || p.startsWith(w + "/"))),
      utilization: util,
    });
  }

  // Stable order: pipeline order first, then the rest alphabetically.
  const order = PIPELINE.map((p) => p.agent);
  agents.sort((a, b) => {
    const ai = order.indexOf(a.name);
    const bi = order.indexOf(b.name);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name);
  });
  return agents;
}

function isStub(content) {
  const hits = STUB_MARKERS.reduce((n, m) => n + (content.includes(m) ? 1 : 0), 0);
  // A template is mostly stub markers; real deliverables have few or none.
  return hits >= 2;
}

// ── Deliverables ────────────────────────────────────────────────────────────────
async function loadDeliverables(repoRoot, approvals) {
  const specs = [
    { id: "problem-statement", title: "Problem Statement", rel: "output/PROBLEMSTATEMENT.md", agent: "problem-statement-creation" },
    { id: "design", title: "Design", rel: "output/DESIGN.md", agent: "technical-architect" },
    { id: "technical-gaps", title: "Technical Gaps", rel: "output/TechnicalGaps.md", agent: "technical-architect" },
    { id: "implementation-plan", title: "Implementation Plan", rel: "output/IMPLEMENTATIONPLAN.md", agent: "implementation-planner" },
    { id: "build-report", title: "Build Report", rel: "gan-harness/build-report.md", agent: "verification-evaluator", comingSoon: true },
  ];

  const out = [];
  for (const s of specs) {
    const abs = path.join(repoRoot, s.rel);
    const exists = await pathExists(abs);
    const content = exists ? await readText(abs) : "";
    const mtime = exists ? await statMtime(abs) : null;

    // Absent build report reads "coming soon" (auto-generated on a PASS, not yet wired) rather
    // than "missing"; a real file, once written, shows its true complete/stub state.
    let status = s.comingSoon ? "coming-soon" : "missing";
    if (exists && content.trim()) status = isStub(content) ? "stub" : "complete";
    else if (exists) status = "stub";

    const sections = [...content.matchAll(/^#{1,3}\s+(.+)$/gm)].map((m) => m[1].trim());
    const openGaps = s.id === "technical-gaps" ? countOpenGaps(content) : null;

    // Design and the implementation plan are human-approval gates.
    const approvalKey = s.id === "design" ? "design" : s.id === "implementation-plan" ? "plan" : null;
    const approval = approvalKey
      ? {
          required: true,
          key: approvalKey,
          approved: approvals?.[approvalKey]?.approved ?? false,
          at: approvals?.[approvalKey]?.at ?? null,
          awaiting: status === "complete" && !(approvals?.[approvalKey]?.approved ?? false),
        }
      : { required: false, key: null, approved: false, at: null, awaiting: false };

    out.push({
      ...s,
      exists,
      status,
      updatedAt: mtime,
      sections,
      openGaps,
      approval,
      content,
    });
  }
  return out;
}

// TechnicalGaps is a markdown table; count rows whose Status column is "Open".
function countOpenGaps(content) {
  const rows = content.split("\n").filter((l) => l.trim().startsWith("|"));
  let open = 0;
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim());
    if (cells.some((c) => /^open$/i.test(c)) && !/minimal info needed to close/i.test(row)) open++;
  }
  return open;
}

// ── Implementation plan (milestones, user stories, tasks + progress) ───────────────
// Returns the body lines under a `## N. Heading` up to the next `## ` heading.
function sectionBody(md, headingRegex) {
  const lines = md.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingRegex.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return "";
  const out = [];
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}

// Parse a GitHub-flavoured markdown table into records keyed by header cell.
function parseTable(body) {
  const rows = body.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  if (rows.length < 2) return [];
  const header = rows[0].split("|").map((c) => c.trim()).slice(1, -1);
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].split("|").map((c) => c.trim()).slice(1, -1);
    if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue; // separator row
    const rec = {};
    header.forEach((h, idx) => (rec[h] = cells[idx] ?? ""));
    out.push(rec);
  }
  return out;
}

// A plan task is "done" when all its target files exist, "in-progress" when some do.
async function taskProgress(repoRoot, targets) {
  if (!targets.length) return "pending";
  let existing = 0;
  for (const rel of targets) {
    if (await pathExists(path.join(repoRoot, rel))) existing++;
  }
  if (existing === 0) return "pending";
  return existing === targets.length ? "done" : "in-progress";
}

async function loadPlan(repoRoot) {
  const md = await readText(path.join(repoRoot, "output", "IMPLEMENTATIONPLAN.md"));
  const empty = { exists: false, milestones: [], userStories: [], tasks: [], progress: { done: 0, inProgress: 0, total: 0 } };
  if (!md.trim() || isStub(md)) return empty;

  const milestones = [];
  for (const line of sectionBody(md, /^##\s+\d*\.?\s*Milestones/i).split(/\r?\n/)) {
    const m = line.match(/^\s*\d+\.\s+\*\*(M\d+)\s*[—-]\s*([^*]+?)\.?\*\*\s*(.*)$/);
    if (m) milestones.push({ id: m[1].trim(), title: m[2].trim(), detail: m[3].trim() });
  }

  const userStories = parseTable(sectionBody(md, /^##\s+\d*\.?\s*User Stories/i))
    .map((r) => ({
      id: (r["Story ID"] || r["Story"] || "").trim(),
      asA: (r["As a …"] || r["As a"] || "").trim(),
      want: (r["I want …"] || r["I want"] || "").trim(),
      soThat: (r["So that …"] || r["So that"] || "").trim(),
      acceptance: (r["Acceptance"] || "").trim(),
    }))
    .filter((s) => s.id);

  const tasks = [];
  for (const r of parseTable(sectionBody(md, /^##\s+\d*\.?\s*Task Breakdown/i))) {
    const id = (r["Task ID"] || r["Task"] || "").trim();
    // Accept both T1 and lane-prefixed ids like T-S1 / T-B2 / T-O3.
    if (!/^T-?[A-Za-z]*\d+/.test(id)) continue;
    const targets = [...(r["Target files"] || r["Target file(s)"] || "").matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
    tasks.push({
      id,
      story: (r["Story"] || "").trim(),
      milestone: (r["Milestone"] || "").trim(),
      title: (r["Title"] || "").trim(),
      lane: (r["Lane"] || "").trim(),
      est: (r["Est."] || r["Est"] || "").trim(),
      dependsOn: (r["Depends on"] || "").trim(),
      targets,
      status: await taskProgress(repoRoot, targets),
    });
  }

  return {
    exists: true,
    milestones,
    userStories,
    tasks,
    progress: {
      done: tasks.filter((t) => t.status === "done").length,
      inProgress: tasks.filter((t) => t.status === "in-progress").length,
      total: tasks.length,
    },
  };
}

// Human approval checkpoints, persisted by the dashboard's POST /api/approve.
async function loadApprovals(repoRoot) {
  const raw = await readText(path.join(repoRoot, "gan-harness", "approvals.json"));
  let data = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = {};
    }
  }
  const norm = (k) => ({ approved: !!data[k]?.approved, at: data[k]?.at ?? null, by: data[k]?.by ?? null });
  return { design: norm("design"), plan: norm("plan") };
}

// Explicit agent run signal (gan-harness/agent-activity.jsonl). Layout-agnostic: an agent is
// "running" while its last logged event is "start". This is how we know a cross-cutting agent
// (e.g. observability-engineer) is running no matter where its produced code lives.
async function loadAgentActivity(repoRoot) {
  const raw = await readText(path.join(repoRoot, "gan-harness", "agent-activity.jsonl"));
  const state = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.agent) state.set(e.agent, { event: e.event, at: e.at ?? 0 });
    } catch {
      /* skip malformed line */
    }
  }
  return state;
}

// ── Tasks ────────────────────────────────────────────────────────────────────────
async function loadTasks(repoRoot, baseline) {
  const dir = path.join(repoRoot, "benchmarks", "tasks");
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".yaml"));
  } catch {
    files = [];
  }

  const tasks = [];
  for (const file of files) {
    const raw = await readText(path.join(dir, file));
    let doc = {};
    try {
      doc = YAML.parse(raw) ?? {};
    } catch {
      doc = {};
    }
    const id = doc.id ?? file.replace(/\.yaml$/, "");
    const scored = baseline?.[id];
    // `passed` is tri-state: true → passed, false → failed, null/undefined → not run (baseline
    // unlocked). Only an explicit false is a real failure; a null baseline stays "defined".
    let status = "defined";
    if (scored?.passed === true) status = "passed";
    else if (scored?.passed === false) status = "failed";

    tasks.push({
      id,
      title: doc.title ?? id,
      stage: doc.stage ?? "custom",
      agent: doc.agent ?? "",
      complexity: doc.complexity ?? "medium",
      status,
      score: scored?.quality_score ?? scored?.score ?? null,
    });
  }
  tasks.sort((a, b) => a.id.localeCompare(b.id));
  return tasks;
}

async function loadBaseline(repoRoot) {
  const raw = await readText(path.join(repoRoot, "benchmarks", "baseline", "metrics.json"));
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed.tasks ?? parsed ?? {};
  } catch {
    return {};
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────────
// Which build lane owns each top-level tests/<dir>, and its category. Layout-driven so it works
// for any project the harness builds; cross-cutting suites (security, e2e, smoke, verification)
// sit with the lane that authored them, not the validating agent.
const TEST_DIR_AGENT = {
  ai: "ai-engineer",
  backend: "backend-engineer",
  contracts: "backend-engineer",
  infra: "backend-engineer",
  security: "backend-engineer",
  e2e: "backend-engineer",
  verification: "backend-engineer",
  integration: "backend-engineer",
  frontend: "frontend-engineer",
  observability: "observability-engineer",
  container: "observability-engineer",
  smoke: "observability-engineer",
  data: "data-engineer",
};
const TEST_DIR_TYPE = {
  ai: "unit", backend: "unit", frontend: "unit", observability: "unit", data: "unit", unit: "unit",
  contracts: "contract", infra: "contract", container: "contract",
  e2e: "e2e", smoke: "smoke", security: "security", verification: "verification",
  integration: "integration", functional: "functional",
};

// The code-reviewer's standing checklist (from the code-review skill). Stable harness knowledge.
const REVIEW_CHECKS = [
  { name: "Correctness", detail: "Behavior matches the design and acceptance criteria; edge and failure paths handled." },
  { name: "Security (OWASP Top 10)", detail: "Input validation, authn/z, secret handling, injection, and data-exposure risks reviewed." },
  { name: "Tests", detail: "Adequate unit/integration/e2e coverage; every task's proving test present and green." },
  { name: "Maintainability", detail: "Readable, minimal, DRY; no dead code or unexplained complexity." },
  { name: "Operability", detail: "Structured logging/metrics/tracing, health checks, and clean failure modes." },
];

function classifyByDir(relInTests, table, fallback) {
  for (const seg of relInTests.split("/")) if (table[seg]) return table[seg];
  return fallback;
}

function humanizeTestName(name) {
  const s = name.replace(/^test_/, "").replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : name;
}

// Extract test cases WITH a human description: a Python docstring's first line, the it()/test()
// title, or a humanized function name — so the UI shows what each test means, not just its symbol.
function extractTestCases(content, ext) {
  const cases = [];
  if (ext === ".py") {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*(?:async\s+)?def\s+(test_\w+)/);
      if (!m) continue;
      const name = m[1];
      let description = "";
      const next = (lines[i + 1] ?? "").trim();
      const q = next.startsWith('"""') ? '"""' : next.startsWith("'''") ? "'''" : "";
      if (q) {
        let doc = next.slice(3);
        if (doc.endsWith(q)) doc = doc.slice(0, -3); // one-line docstring
        if (!doc.trim()) doc = (lines[i + 2] ?? "").trim(); // text on the following line
        description = doc.replace(/(?:"""|''')\s*$/, "").trim();
      }
      cases.push({ name, description: description || humanizeTestName(name) });
    }
  } else {
    for (const m of content.matchAll(/\b(?:it|test)\s*\(\s*[`'"]([^`'"]+)[`'"]/g)) {
      cases.push({ name: m[1], description: m[1] });
    }
  }
  return cases;
}

async function collectTestFiles(dir, out, depth = 6) {
  if (depth < 0) return;
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "__pycache__" || e.name === "node_modules" || e.name.startsWith(".")) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) await collectTestFiles(abs, out, depth - 1);
    else if (/^test_.*\.py$|_test\.py$|\.(spec|test)\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(abs);
  }
}

// Optional test results (written by .github/scripts/collect-test-results.py from a JUnit run),
// keyed by `<repo-relative-file>::<test-name>`. Absent → every case shows "not run".
async function loadTestResults(repoRoot) {
  const raw = await readText(path.join(repoRoot, "gan-harness", "test-results.json"));
  const map = new Map();
  if (!raw.trim()) return { map, generated: null };
  try {
    const j = JSON.parse(raw);
    for (const c of j.cases ?? []) {
      const file = String(c.file ?? "").replace(/\\/g, "/");
      map.set(`${file}::${c.name}`, {
        result: String(c.result ?? "not-run"),
        message: String(c.message ?? "").split(/\r?\n/)[0].slice(0, 300),
      });
    }
    return { map, generated: j.generated ?? null };
  } catch {
    return { map, generated: null };
  }
}

// Discover the project's test suite, group it by the owning lane, join each case to its result,
// and attach the verification acceptance rubric and the code-reviewer's checklist.
async function loadTests(repoRoot) {
  const root = path.join(repoRoot, "tests");
  const files = [];
  await collectTestFiles(root, files);
  const { map: results, generated } = await loadTestResults(repoRoot);

  const byType = {};
  const totals = { passed: 0, failed: 0, notRun: 0 };
  const groups = new Map();
  for (const abs of files.sort()) {
    const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
    const relInTests = path.relative(root, abs).split(path.sep).join("/");
    const ext = path.extname(abs);
    const cases = extractTestCases(await readText(abs), ext);
    const type = classifyByDir(relInTests, TEST_DIR_TYPE, "unit");
    const agent = classifyByDir(relInTests, TEST_DIR_AGENT, "backend-engineer");
    byType[type] = (byType[type] ?? 0) + cases.length;
    const g = groups.get(agent) ?? { agent, cases: [], caseCount: 0, fileCount: 0 };
    for (const c of cases) {
      const r = results.get(`${rel}::${c.name}`);
      const result = r?.result ?? "not-run";
      if (result === "passed") totals.passed++;
      else if (result === "failed" || result === "error") totals.failed++;
      else totals.notRun++;
      g.cases.push({ file: rel, name: c.name, description: c.description, type, result, message: r?.message ?? "" });
    }
    g.caseCount += cases.length;
    g.fileCount++;
    groups.set(agent, g);
  }

  const md = await readText(path.join(repoRoot, "output", "IMPLEMENTATIONPLAN.md"));
  const rubric =
    !md.trim() || isStub(md)
      ? []
      : parseTable(sectionBody(md, /^##\s+\d*\.?\s*Acceptance Rubric/i))
          .map((r) => ({
            criterion: (r["Criterion"] || "").trim(),
            weight: (r["Weight"] || "").trim(),
            detail: (r["Measurable acceptance"] || r['What "good" looks like'] || r["What good looks like"] || "").trim(),
          }))
          .filter((c) => c.criterion);

  const order = [
    "backend-engineer", "ai-engineer", "data-engineer", "frontend-engineer",
    "observability-engineer", "code-reviewer", "verification-evaluator",
  ];
  const groupList = [...groups.values()].sort(
    (a, b) => (order.indexOf(a.agent) + 1 || 99) - (order.indexOf(b.agent) + 1 || 99),
  );
  const caseCount = groupList.reduce((n, g) => n + g.caseCount, 0);
  return {
    total: caseCount,
    files: files.length,
    byType,
    results: totals,
    hasResults: !!generated || results.size > 0,
    generated,
    groups: groupList,
    rubric,
    reviewChecks: REVIEW_CHECKS,
  };
}

// ── Efficiency log ────────────────────────────────────────────────────────────────
async function loadEfficiency(repoRoot) {
  const raw = await readText(path.join(repoRoot, "gan-harness", "efficiency-log.csv"));
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length <= 1) return { rows: [], byAgent: new Map() };

  const header = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const rec = {};
    header.forEach((h, i) => (rec[h] = (cells[i] ?? "").trim()));
    return {
      date: rec.date ?? "",
      surface: rec.surface ?? "",
      quality: Number(rec.quality) || 0,
      tokens: Number(rec.tokens) || 0,
      inputTokens: Number(rec.input_tokens ?? rec.prompt_tokens) || 0,
      outputTokens: Number(rec.output_tokens ?? rec.completion_tokens) || 0,
      iterations: Number(rec.iterations) || 0,
      memories: Number(rec.memories) || 0,
      tokPerQ: Number(rec.tok_per_q) || 0,
      note: rec.note ?? "",
    };
  });

  const byAgent = new Map();
  for (const r of rows) {
    const key = r.surface || "unknown";
    const cur = byAgent.get(key) ?? { tokens: 0, iterations: 0, samples: 0 };
    cur.tokens += r.tokens;
    cur.iterations += r.iterations;
    cur.samples += 1;
    byAgent.set(key, cur);
  }
  return { rows, byAgent };
}

// ── Feedback ledger ────────────────────────────────────────────────────────────────
async function loadLedger(repoRoot) {
  const raw = await readText(path.join(repoRoot, "gan-harness", "feedback", "ledger.jsonl"));
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      /* skip malformed line */
    }
  }
  // Iteration feedback files (feedback-NNN.md) form the score timeline.
  const fbDir = path.join(repoRoot, "gan-harness", "feedback");
  let iterations = [];
  try {
    const files = (await fs.readdir(fbDir)).filter((f) => /^feedback-\d+\.md$/.test(f));
    for (const f of files.sort()) {
      const content = await readText(path.join(fbDir, f));
      const scoreMatch = content.match(/score[^\d]*(\d+(?:\.\d+)?)\s*\/\s*10/i);
      iterations.push({
        file: f,
        iteration: Number(f.match(/\d+/)?.[0] ?? 0),
        score: scoreMatch ? Number(scoreMatch[1]) : null,
      });
    }
  } catch {
    iterations = [];
  }
  // Memory candidates (state: candidate) are pending-review suggestions, not history.
  const isCandidate = (e) => e?.state === "candidate" || e?.evidence?.state === "candidate";
  const candidates = entries.filter(isCandidate);
  const history = entries.filter((e) => !isCandidate(e));
  return { entries: history.reverse(), candidates: candidates.reverse(), iterations };
}

export async function buildState(repoRoot, recentActivity) {
  const approvals = await loadApprovals(repoRoot);
  const runSignal = await loadAgentActivity(repoRoot);
  const [{ rows: efficiencyRows, byAgent }, baseline, deliverables, ledger, plan] = await Promise.all([
    loadEfficiency(repoRoot),
    loadBaseline(repoRoot),
    loadDeliverables(repoRoot, approvals),
    loadLedger(repoRoot),
    loadPlan(repoRoot),
  ]);
  const [agents, benchmarks, tests] = await Promise.all([
    loadAgents(repoRoot, recentActivity, byAgent, plan, runSignal),
    loadTasks(repoRoot, baseline),
    loadTests(repoRoot),
  ]);

  const totals = efficiencyRows.reduce(
    (acc, r) => {
      acc.tokens += r.tokens;
      acc.iterations += r.iterations;
      acc.memories += r.memories;
      return acc;
    },
    { tokens: 0, iterations: 0, memories: 0 },
  );

  const designDeliv = deliverables.find((d) => d.id === "design");
  const planDeliv = deliverables.find((d) => d.id === "implementation-plan");

  // Pipeline reflects agent status, but architecture/plan stages stay "awaiting"
  // (a blocking checkpoint) once their deliverable is complete but not yet approved.
  const pipeline = PIPELINE.map((p) => {
    const agent = agents.find((a) => a.name === p.agent);
    let status = agent?.status ?? "idle";
    if (p.stage === "architecture" && designDeliv?.approval?.awaiting) status = "awaiting";
    if (p.stage === "implementation-plan" && planDeliv?.approval?.awaiting) status = "awaiting";
    return { stage: p.stage, agent: p.agent, status };
  });

  // "Project tokens" = only the pipeline that generates THIS project (problem statement → design →
  // plan → build/code). Excludes review/verification/feedback, whose estimates come from harness
  // self-improvement artifacts (gan-harness/feedback), not the project output.
  const NON_PROJECT_ROLES = new Set(["review", "verification", "support"]);
  const projectEstimate = agents
    .filter((a) => !NON_PROJECT_ROLES.has(a.role))
    .reduce((n, a) => n + (a.utilization.tokens || 0), 0);

  // Each efficiency-log row is one pipeline iteration. Show the LATEST iteration's real tokens
  // (not the sum across all iterations); fall back to the per-project estimate when none is logged.
  const latestIteration = efficiencyRows.length ? efficiencyRows[efficiencyRows.length - 1] : null;
  const totalTokens = latestIteration ? latestIteration.tokens : projectEstimate;
  const tokensEstimated = !latestIteration && agents.some((a) => a.utilization.estimated);
  // Measured input/output split (from the VS Code chat debug log). Null when the latest iteration
  // predates the input_tokens/output_tokens columns, so the UI falls back to a single total.
  const hasSplit = !!latestIteration && (latestIteration.inputTokens > 0 || latestIteration.outputTokens > 0);
  const inputTokens = hasSplit ? latestIteration.inputTokens : null;
  const outputTokens = hasSplit ? latestIteration.outputTokens : null;
  const iterations = efficiencyRows.length;
  const approvalsPending =
    (designDeliv?.approval?.awaiting ? 1 : 0) + (planDeliv?.approval?.awaiting ? 1 : 0);

  return {
    generatedAt: Date.now(),
    summary: {
      agentsWorking: agents.filter((a) => a.status === "working").length,
      agentsDone: agents.filter((a) => a.status === "done").length,
      agentsTotal: agents.length,
      tasksTotal: plan.progress.total,
      tasksDone: plan.progress.done,
      tasksInProgress: plan.progress.inProgress,
      deliverablesComplete: deliverables.filter((d) => d.status === "complete").length,
      deliverablesTotal: deliverables.filter((d) => d.status !== "coming-soon").length,
      openGaps: deliverables.find((d) => d.id === "technical-gaps")?.openGaps ?? 0,
      totalTokens,
      tokensEstimated,
      inputTokens,
      outputTokens,
      iterations,
      latestIterationNote: latestIteration?.note ?? "",
      approvalsPending,
      benchmarksTotal: benchmarks.length,
      memorySuggestions: ledger.candidates.length,
      testCases: tests.total,
      testFiles: tests.files,
    },
    agents,
    deliverables,
    approvals,
    plan,
    benchmarks,
    tests,
    memorySuggestions: ledger.candidates,
    efficiency: { rows: efficiencyRows, totals },
    ledger: { entries: ledger.entries, iterations: ledger.iterations },
    pipeline,
    activity: recentActivity.slice(-40).reverse(),
  };
}

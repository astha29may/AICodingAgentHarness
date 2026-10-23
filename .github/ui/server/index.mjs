// Harness dashboard backend.
// - Serves a REST snapshot of harness state at /api/state
// - Streams live updates over Server-Sent Events at /api/stream
// - Watches the harness's file-based state and rebuilds/pushes on change
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import express from "express";
import chokidar from "chokidar";
import YAML from "yaml";
import { buildState } from "./harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .github/ui/server -> .github/ui -> .github -> repo root
const REPO_ROOT = process.env.HARNESS_ROOT
  ? path.resolve(process.env.HARNESS_ROOT)
  : path.resolve(__dirname, "..", "..", "..");
const PORT = Number(process.env.PORT ?? 3001);

// Relative paths (from REPO_ROOT) that reflect harness progress.
const WATCH_TARGETS = [
  "output",
  // Watch the whole gan-harness tree (not individual files): approvals.json and
  // agent-activity.jsonl are created mid-run, and chokidar won't detect the creation of a
  // specific path that didn't exist at startup — a directory watch does.
  "gan-harness",
  "benchmarks/tasks",
  "benchmarks/baseline",
  ".github/agents",
  "src",
  "tests",
  "infra",
];

// Rolling activity buffer: recent file touches drive "who is working now".
const recentActivity = [];
const MAX_ACTIVITY = 200;

function recordActivity(type, absPath) {
  const rel = path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
  recentActivity.push({ type, path: rel, at: Date.now() });
  if (recentActivity.length > MAX_ACTIVITY) recentActivity.shift();
}

const app = express();
app.use(express.json());

// SSE clients
const clients = new Set();

async function currentState() {
  return buildState(REPO_ROOT, recentActivity);
}

async function pushState() {
  if (clients.size === 0) return;
  const state = await currentState();
  const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) res.write(payload);
}

// Coalesce bursts of file events into a single rebuild.
let pushTimer = null;
function schedulePush() {
  if (pushTimer) return;
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    try {
      await pushState();
    } catch (err) {
      console.error("[harness] pushState failed:", err.message);
    }
  }, 250);
}

app.get("/api/state", async (_req, res) => {
  try {
    res.json(await currentState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stream", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  clients.add(res);

  // Send an initial snapshot immediately.
  try {
    const state = await currentState();
    res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
  } catch (err) {
    console.error("[harness] initial snapshot failed:", err.message);
  }

  // Heartbeat keeps proxies from closing the idle connection.
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

app.get("/api/health", (_req, res) => res.json({ ok: true, root: REPO_ROOT }));

// Record a human approval checkpoint (design | plan). Persisted to gan-harness/approvals.json.
app.post("/api/approve", async (req, res) => {
  const stage = String(req.body?.stage ?? "");
  if (stage !== "design" && stage !== "plan") {
    return res.status(400).json({ error: "stage must be 'design' or 'plan'" });
  }
  const approved = req.body?.approved !== false;
  const file = path.join(REPO_ROOT, "gan-harness", "approvals.json");
  let data = {};
  try {
    data = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    data = {};
  }
  data[stage] = approved
    ? { approved: true, at: Date.now(), by: req.body?.by ?? "dashboard" }
    : { approved: false, at: Date.now(), by: req.body?.by ?? "dashboard" };
  try {
    await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  schedulePush();
  res.json({ ok: true, stage, approved });
});

// Promote a session-learning candidate to its chosen destination — memory (conventions.yaml),
// an agent spec, AGENTS.md, or a skill — and flip its ledger entry to "promoted". The
// agent-feedback agent recommends a destination; the human picks the final one here.
const PROMOTE_SECTION = "## Learned rules (agent-feedback)";

function resolveWithinRepo(rel) {
  const abs = path.resolve(REPO_ROOT, rel);
  if (abs !== REPO_ROOT && !abs.startsWith(REPO_ROOT + path.sep)) throw new Error("path escapes repository");
  return abs;
}

// Allow-list each destination kind so a client can't write to arbitrary files (path traversal).
function promotionTarget(kind, rel) {
  const p = String(rel ?? "").replace(/\\/g, "/");
  if (kind === "memory") return { abs: resolveWithinRepo(".github/memory/repo/conventions.yaml"), mode: "yaml", rel: ".github/memory/repo/conventions.yaml" };
  if (kind === "agents-md") return { abs: resolveWithinRepo("AGENTS.md"), mode: "md", rel: "AGENTS.md" };
  if (kind === "agent") {
    if (!/^\.github\/agents\/[\w.-]+\.agent\.md$/.test(p)) throw new Error("invalid agent target (expected .github/agents/<name>.agent.md)");
    return { abs: resolveWithinRepo(p), mode: "md", rel: p };
  }
  if (kind === "skill") {
    if (!/^\.github\/skills\/[\w.-]+\/SKILL\.md$/.test(p)) throw new Error("invalid skill target (expected .github/skills/<name>/SKILL.md)");
    return { abs: resolveWithinRepo(p), mode: "md", rel: p };
  }
  throw new Error(`unknown promotion kind: ${kind}`);
}

function candidateBullet(record) {
  const id = record.id ?? "candidate";
  const desc = record.descriptor ?? record.rule ?? record.title ?? "";
  const body = record.content ?? record.body ?? record.text ?? record.summary ?? "";
  const text = [desc, body].filter(Boolean).join(" \u2014 ") || "TODO: describe the learned rule";
  return `- ${new Date().toISOString().slice(0, 10)} [\`${id}\`]: ${text}`;
}

async function appendMarkdownRule(abs, record, id) {
  let md;
  try {
    md = await fs.readFile(abs, "utf8");
  } catch {
    throw new Error(`target not found: ${abs}`);
  }
  if (md.includes(`[\`${id}\`]:`)) throw new Error(`${id} already promoted`);
  const bullet = candidateBullet(record);
  const idx = md.indexOf(PROMOTE_SECTION);
  if (idx === -1) {
    md = `${md.replace(/\s*$/, "")}\n\n${PROMOTE_SECTION}\n\n> Rules promoted from session retrospectives (agent-feedback), human-approved.\n\n${bullet}\n`;
  } else {
    const nextH2 = md.indexOf("\n## ", idx + PROMOTE_SECTION.length);
    const end = nextH2 === -1 ? md.length : nextH2;
    md = `${md.slice(0, end).replace(/\s*$/, "")}\n${bullet}\n${md.slice(end)}`;
  }
  await fs.writeFile(abs, md, "utf8");
}

async function handlePromote(req, res) {
  const id = String(req.body?.id ?? "");
  const kind = String(req.body?.kind ?? "memory");
  if (!id) return res.status(400).json({ error: "id is required" });

  let target;
  try {
    target = promotionTarget(kind, req.body?.path);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const ledgerPath = path.join(REPO_ROOT, "gan-harness", "feedback", "ledger.jsonl");
  let lines;
  try {
    lines = (await fs.readFile(ledgerPath, "utf8")).split(/\r?\n/);
  } catch (err) {
    return res.status(500).json({ error: `read ledger: ${err.message}` });
  }

  let record = null;
  const rewritten = lines.map((line) => {
    if (!line.trim()) return line;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      return line;
    }
    if (obj.id === id) {
      record = JSON.parse(JSON.stringify(obj));
      obj.evidence = { ...(obj.evidence ?? {}), state: "promoted", promoted_to: { kind, path: target.rel } };
      return JSON.stringify(obj);
    }
    return line;
  });
  if (!record) return res.status(404).json({ error: `candidate ${id} not found` });

  try {
    if (target.mode === "yaml") {
      let store = {};
      try {
        store = YAML.parse(await fs.readFile(target.abs, "utf8")) ?? {};
      } catch {
        store = {};
      }
      if (!Array.isArray(store.conventions)) store.conventions = [];
      if (store.conventions.some((c) => c?.id === id)) return res.status(409).json({ error: `${id} already promoted` });
      record.evidence = { ...(record.evidence ?? {}), state: "approved", last_confirmed: new Date().toISOString().slice(0, 10) };
      store.conventions.push(record);
      await fs.writeFile(target.abs, YAML.stringify(store), "utf8");
    } else {
      await appendMarkdownRule(target.abs, record, id);
    }
    await fs.writeFile(ledgerPath, rewritten.join("\n"), "utf8");
  } catch (err) {
    const code = /already promoted/.test(err.message) ? 409 : 500;
    return res.status(code).json({ error: err.message });
  }
  schedulePush();
  res.json({ ok: true, id, kind, path: target.rel });
}

app.post("/api/promote", handlePromote);
app.post("/api/promote-memory", handlePromote); // back-compat alias (defaults to memory)

// Serve the built web app in production (npm run build -> dist).
const distDir = path.join(__dirname, "..", "dist");
app.use(express.static(distDir));

const watcher = chokidar.watch(
  WATCH_TARGETS.map((t) => path.join(REPO_ROOT, t)),
  {
    ignoreInitial: true,
    ignored: /(^|[/\\])(node_modules|\.git|dist)([/\\]|$)/,
    depth: 6,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  },
);

watcher
  .on("add", (p) => {
    recordActivity("add", p);
    schedulePush();
  })
  .on("change", (p) => {
    recordActivity("change", p);
    schedulePush();
  })
  .on("unlink", (p) => {
    recordActivity("unlink", p);
    schedulePush();
  })
  .on("error", (err) => console.error("[harness] watcher error:", err.message));

app.listen(PORT, () => {
  console.log(`[harness] dashboard API on http://localhost:${PORT}`);
  console.log(`[harness] watching root: ${REPO_ROOT}`);
});

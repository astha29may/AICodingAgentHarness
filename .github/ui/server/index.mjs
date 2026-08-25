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

// Promote a memory candidate into the repo store (.github/memory/repo/conventions.yaml) and
// flip its ledger entry to "promoted". Human-approved promotion, mirroring the agent-feedback flow.
app.post("/api/promote-memory", async (req, res) => {
  const id = String(req.body?.id ?? "");
  if (!id) return res.status(400).json({ error: "id is required" });

  const ledgerPath = path.join(REPO_ROOT, "gan-harness", "feedback", "ledger.jsonl");
  const convPath = path.join(REPO_ROOT, ".github", "memory", "repo", "conventions.yaml");

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
      obj.evidence = { ...(obj.evidence ?? {}), state: "promoted" };
      return JSON.stringify(obj);
    }
    return line;
  });
  if (!record) return res.status(404).json({ error: `candidate ${id} not found` });

  record.evidence = {
    ...(record.evidence ?? {}),
    state: "approved",
    last_confirmed: new Date().toISOString().slice(0, 10),
  };

  let store = {};
  try {
    store = YAML.parse(await fs.readFile(convPath, "utf8")) ?? {};
  } catch {
    store = {};
  }
  if (!Array.isArray(store.conventions)) store.conventions = [];
  if (store.conventions.some((c) => c?.id === id)) {
    return res.status(409).json({ error: `${id} already promoted` });
  }
  store.conventions.push(record);

  try {
    await fs.writeFile(convPath, YAML.stringify(store), "utf8");
    await fs.writeFile(ledgerPath, rewritten.join("\n"), "utf8");
  } catch (err) {
    return res.status(500).json({ error: `write: ${err.message}` });
  }
  schedulePush();
  res.json({ ok: true, id });
});

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

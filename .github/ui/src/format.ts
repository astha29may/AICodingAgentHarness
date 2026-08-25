import type { AgentStatus, DeliverableStatus, TaskStatus, PlanTaskStatus } from "./types";

const numberFmt = new Intl.NumberFormat("en-US");

export function fmtNumber(n: number): string {
  return numberFmt.format(n ?? 0);
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n ?? 0);
}

export function relativeTime(ms: number | null): string {
  if (!ms) return "—";
  const delta = Date.now() - ms;
  const sec = Math.round(delta / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(ms).toLocaleDateString();
}

export function agentStatusColor(status: AgentStatus): string {
  return status === "working" ? "var(--accent)" : status === "done" ? "var(--ok)" : "var(--muted)";
}

export function deliverableStatusColor(status: DeliverableStatus): string {
  if (status === "complete") return "var(--ok)";
  if (status === "stub") return "var(--warn)";
  if (status === "coming-soon") return "var(--accent-2)";
  return "var(--muted)";
}

export function taskStatusColor(status: TaskStatus): string {
  return status === "passed" ? "var(--ok)" : status === "failed" ? "var(--danger)" : "var(--muted)";
}

export function planTaskStatusColor(status: PlanTaskStatus): string {
  return status === "done" ? "var(--ok)" : status === "in-progress" ? "var(--accent)" : "var(--muted)";
}

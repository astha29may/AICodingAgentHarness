// POST a human approval decision for a checkpoint stage.
export async function approveStage(stage: "design" | "plan", approved = true): Promise<void> {
  const res = await fetch("/api/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stage, approved }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `Approve failed (${res.status})`);
  }
}

// Where a session-learning candidate can be promoted.
export type PromoteKind = "memory" | "agent" | "agents-md" | "skill";

// Promote a candidate to a chosen destination (human-approved). `path` is required for
// agent/skill targets; memory and AGENTS.md have fixed paths.
export async function promote(id: string, kind: PromoteKind, targetPath?: string): Promise<void> {
  const res = await fetch("/api/promote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, kind, path: targetPath }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `Promote failed (${res.status})`);
  }
}

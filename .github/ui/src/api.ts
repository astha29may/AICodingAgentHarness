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

// Promote a memory candidate into the repo store (human-approved).
export async function promoteMemory(id: string): Promise<void> {
  const res = await fetch("/api/promote-memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `Promote failed (${res.status})`);
  }
}

import { useState } from "react";
import type { Plan, PlanTask } from "../types";
import { planTaskStatusColor } from "../format";

interface Props {
  plan: Plan;
}

type View = "milestones" | "stories";

export function PlanBoard({ plan }: Props) {
  const [view, setView] = useState<View>("milestones");

  if (!plan.exists) {
    return (
      <section className="panel">
        <div className="panel__head">
          <h2>Work &amp; progress</h2>
          <span className="panel__hint">from the implementation plan</span>
        </div>
        <div className="empty">
          No implementation plan yet. Milestones, user stories, and tasks appear here once
          <code> output/IMPLEMENTATIONPLAN.md</code> is generated.
        </div>
      </section>
    );
  }

  const pct = plan.progress.total ? Math.round((plan.progress.done / plan.progress.total) * 100) : 0;

  return (
    <section className="panel">
      <div className="panel__head">
        <h2>Work &amp; progress</h2>
        <span className="panel__hint">
          {plan.progress.done} done · {plan.progress.inProgress} in progress · {plan.progress.total} tasks
        </span>
      </div>

      <div className="progress">
        <div className="progress__bar">
          <div className="progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress__label">{pct}% complete</span>
      </div>

      <div className="segmented">
        <button className={view === "milestones" ? "is-active" : ""} onClick={() => setView("milestones")}>
          Milestones &amp; tasks
        </button>
        <button className={view === "stories" ? "is-active" : ""} onClick={() => setView("stories")}>
          User stories ({plan.userStories.length})
        </button>
      </div>

      {view === "milestones" ? (
        <MilestoneView plan={plan} />
      ) : (
        <StoryView plan={plan} />
      )}
    </section>
  );
}

function taskCard(t: PlanTask) {
  return (
    <article key={t.id} className={`ptask ptask--${t.status}`}>
      <span className="ptask__dot" style={{ background: planTaskStatusColor(t.status) }} />
      <div className="ptask__body">
        <div className="ptask__top">
          <span className="ptask__id">{t.id}</span>
          {t.est && <span className={`chip chip--${estClass(t.est)}`}>{t.est}</span>}
          {t.lane && <span className="ptask__lane">{t.lane}</span>}
          {t.story && <span className="ptask__story">{t.story}</span>}
        </div>
        <div className="ptask__title">{t.title}</div>
      </div>
      <span className={`ptask__status ptask__status--${t.status}`}>{t.status}</span>
    </article>
  );
}

function estClass(est: string): string {
  const e = est.toUpperCase();
  return e === "S" ? "small" : e === "L" ? "large" : "medium";
}

function MilestoneView({ plan }: { plan: Plan }) {
  const unassigned = plan.tasks.filter((t) => !plan.milestones.some((m) => m.id === t.milestone));
  return (
    <div className="milestones">
      {plan.milestones.map((m) => {
        const tasks = plan.tasks.filter((t) => t.milestone === m.id);
        const done = tasks.filter((t) => t.status === "done").length;
        return (
          <div key={m.id} className="milestone">
            <div className="milestone__head">
              <span className="milestone__id">{m.id}</span>
              <span className="milestone__title">{m.title}</span>
              <span className="milestone__count">
                {done}/{tasks.length}
              </span>
            </div>
            {m.detail && <div className="milestone__detail">{m.detail}</div>}
            <div className="ptask-list">{tasks.map(taskCard)}</div>
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div className="milestone">
          <div className="milestone__head">
            <span className="milestone__title">Other tasks</span>
          </div>
          <div className="ptask-list">{unassigned.map(taskCard)}</div>
        </div>
      )}
    </div>
  );
}

function StoryView({ plan }: { plan: Plan }) {
  return (
    <div className="stories">
      {plan.userStories.map((s) => {
        const tasks = plan.tasks.filter((t) => t.story === s.id);
        const done = tasks.filter((t) => t.status === "done").length;
        return (
          <div key={s.id} className="story">
            <div className="story__head">
              <span className="story__id">{s.id}</span>
              <span className="story__count">
                {done}/{tasks.length} tasks
              </span>
            </div>
            <div className="story__text">
              <b>As a</b> {s.asA} <b>I want</b> {s.want} <b>so that</b> {s.soThat}
            </div>
            {s.acceptance && <div className="story__acceptance">✓ {s.acceptance}</div>}
            {tasks.length > 0 && <div className="ptask-list">{tasks.map(taskCard)}</div>}
          </div>
        );
      })}
      {plan.userStories.length === 0 && <div className="empty">No user stories in the plan.</div>}
    </div>
  );
}

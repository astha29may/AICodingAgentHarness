export type AgentStatus = "working" | "done" | "idle";
export type DeliverableStatus = "missing" | "stub" | "complete" | "coming-soon";
export type TaskStatus = "defined" | "passed" | "failed";
export type PlanTaskStatus = "pending" | "in-progress" | "done";
export type PipelineStatus = AgentStatus | "awaiting";

export interface Utilization {
  tokens: number;
  iterations: number;
  samples: number;
  estimated?: boolean;
}

export interface Agent {
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  lastActiveAt: number | null;
  isWatched: boolean;
  utilization: Utilization;
}

export interface Deliverable {
  id: string;
  title: string;
  rel: string;
  agent: string;
  exists: boolean;
  status: DeliverableStatus;
  updatedAt: number | null;
  sections: string[];
  openGaps: number | null;
  approval: Approval;
  content: string;
}

export interface Approval {
  required: boolean;
  key: "design" | "plan" | null;
  approved: boolean;
  at: number | null;
  awaiting: boolean;
}

export interface Approvals {
  design: { approved: boolean; at: number | null; by: string | null };
  plan: { approved: boolean; at: number | null; by: string | null };
}

export interface Milestone {
  id: string;
  title: string;
  detail: string;
}

export interface UserStory {
  id: string;
  asA: string;
  want: string;
  soThat: string;
  acceptance: string;
}

export interface PlanTask {
  id: string;
  story: string;
  milestone: string;
  title: string;
  lane: string;
  est: string;
  dependsOn: string;
  targets: string[];
  status: PlanTaskStatus;
}

export interface Plan {
  exists: boolean;
  milestones: Milestone[];
  userStories: UserStory[];
  tasks: PlanTask[];
  progress: { done: number; inProgress: number; total: number };
}

export interface Benchmark {
  id: string;
  title: string;
  stage: string;
  agent: string;
  complexity: "small" | "medium" | "large";
  status: TaskStatus;
  score: number | null;
}

export interface EfficiencyRow {
  date: string;
  surface: string;
  quality: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  iterations: number;
  memories: number;
  tokPerQ: number;
  note: string;
}

export interface LedgerEntry {
  [key: string]: unknown;
}

export interface IterationScore {
  file: string;
  iteration: number;
  score: number | null;
}

export interface ActivityEvent {
  type: "add" | "change" | "unlink";
  path: string;
  at: number;
}

export interface PipelineStage {
  stage: string;
  agent: string;
  status: PipelineStatus;
}

export interface MemorySuggestion {
  [key: string]: unknown;
}

export interface TestFile {
  path: string;
  name: string;
  type: string;
  count: number;
  cases: string[];
}

export interface TestGroup {
  agent: string;
  files: TestFile[];
  caseCount: number;
}

export interface RubricCriterion {
  criterion: string;
  weight: string;
  detail: string;
}

export interface ReviewCheck {
  name: string;
  detail: string;
}

export interface TestsState {
  total: number;
  files: number;
  byType: Record<string, number>;
  groups: TestGroup[];
  rubric: RubricCriterion[];
  reviewChecks: ReviewCheck[];
}

export interface HarnessState {
  generatedAt: number;
  summary: {
    agentsWorking: number;
    agentsDone: number;
    agentsTotal: number;
    tasksTotal: number;
    tasksDone: number;
    tasksInProgress: number;
    deliverablesComplete: number;
    deliverablesTotal: number;
    openGaps: number;
    totalTokens: number;
    tokensEstimated: boolean;
    inputTokens: number | null;
    outputTokens: number | null;
    iterations: number;
    latestIterationNote: string;
    approvalsPending: number;
    benchmarksTotal: number;
    memorySuggestions: number;
    testCases: number;
    testFiles: number;
  };
  agents: Agent[];
  deliverables: Deliverable[];
  approvals: Approvals;
  plan: Plan;
  benchmarks: Benchmark[];
  tests: TestsState;
  memorySuggestions: MemorySuggestion[];
  efficiency: {
    rows: EfficiencyRow[];
    totals: { tokens: number; iterations: number; memories: number };
  };
  ledger: { entries: LedgerEntry[]; iterations: IterationScore[] };
  pipeline: PipelineStage[];
  activity: ActivityEvent[];
}

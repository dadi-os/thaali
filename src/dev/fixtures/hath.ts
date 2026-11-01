import type {
  AgentDetail,
  AgentRecord,
  AgentStatus,
  AttachmentSummary,
  DurableMessage,
  HathHealth,
  LogRecord,
  ScheduledMessage,
  ThreadSummary,
} from "../../types/hath";
import type { Scenario } from "../scenario";
import { agentTasks } from "./tasks";
import { ago, DAY, HOUR, MIN } from "./time";

/** One agent of the tree: id, parent and the first line of its prompt. */
type AgentSeed = readonly [id: string, parent: string | null, role: string];

const TREE: readonly AgentSeed[] = [
  ["career-manager", null, "You run Ankur's job search: applications, networking, resumes and recruiters."],
  ["networking-specialist", "career-manager", "You own Ankur's LinkedIn and email outreach and keep the tracker."],
  ["resume-specialist", "career-manager", "You tailor Ankur's resume to each application and keep the claims honest."],
  ["recruiter-specialist", "career-manager", "You read recruiter mail and prepare Ankur's replies."],
  ["project-manager", null, "You keep Ankur's side projects moving and report what changed."],
  ["dadi-project-manager", "project-manager", "You run the dadi project: its repos, CI and releases."],
  ["robostangs-manager", "project-manager", "You run the Robostangs robotics team's software."],
  ["coding-manager", null, "You own the workspaces under ~/projects and build what other agents ask for."],
  ["browser-manager", null, "You keep the shared browser profiles signed in."],
  ["education-specialist", null, "You own Ankur's courses, deadlines and study plan."],
  ["cse-300-specialist", "education-specialist", "You own CSE 300: lectures, assignments and exam dates."],
  ["cse-335-specialist", "education-specialist", "You own CSE 335: lectures, assignments and exam dates."],
  ["schedule-specialist", null, "You build Ankur's weekly schedule from every domain's budget."],
  ["health-specialist", null, "You own sleep, gym and meals, and choose the gym days."],
  ["efficiency-specialist", null, "You review the day each night and schedule the recurring wakes."],
  ["finance-specialist", null, "You own Ankur's accounts: balances, charges, bills and budgets."],
  ["iah-241-specialist-archive-1010", "education-specialist", "Retired. You owned IAH 241 until the 2026-10-10 reset."],
  ["application-manager-archive-1010", "career-manager", "Retired. You managed applications until the 2026-10-10 reset."],
];

const LONG_ID = "application-wells-fargo-technology-summer-internship-software-engineering";

/** The prompt an agent has: its role line followed by the usual charter paragraphs. */
function systemPrompt(role: string): string {
  return [
    role,
    "",
    "## Who you work with",
    "- Ankur gives you jobs in this thread; every other agent reaches you by message.",
    "- Your manager is the agent above you in the tree; ask it before you touch another agent's domain.",
    "",
    "## How you work",
    "- Recall before you act on anything about Ankur's life, and ingest what you learn as you go.",
    "- Browser and terminal work goes to a helper task; you read what it reports.",
  ].join("\n");
}

/** The status block of an agent whose lanes are quiet or busy, or null when nothing runs. */
function statusFor(scenario: Scenario, id: string): AgentStatus | null {
  const tasks = agentTasks(scenario, id);
  const live = tasks
    .filter((t) => t.status !== "asleep")
    .map((t) => ({ id: t.id, status: t.status as string, current: t.current }));
  if (id === "finance-specialist") {
    return {
      job: { from: null, at: ago(18 * MIN), content: "Check whether the two pending Chase charges are expected before Friday." },
      work: { state: "running", since: ago(40_000), waiting_on: [] },
      step: "steer_browser task/browser/3f2a91 read the October statement",
      recent: [
        { name: "recall_memory", arg: "Chase pending charges", ok: true },
        { name: "read_file", arg: "~/finance/budget.md", ok: true },
        { name: "steer_browser", arg: "task/browser/3f2a91 open statements", ok: true },
        { name: "wait", arg: "task/browser/3f2a91", ok: false },
        { name: "steer_browser", arg: "task/browser/3f2a91 read the October statement", ok: null },
      ],
      tasks: live,
      tasks_unreadable: null,
      pending: [{ id: 41, to: null, expects_reply: false, preview: "Two small charges may hit this week, both expected." }],
    };
  }
  if (id === "networking-specialist") {
    const asking = tasks.find((t) => t.status === "asking");
    return {
      job: { from: "career-manager", at: ago(26 * MIN), content: "Send this week's batch of LinkedIn connection requests and log each one in the tracker." },
      work: {
        state: "waiting",
        since: ago(3 * MIN),
        waiting_on: asking ? [asking.id] : tasks.filter((t) => t.status === "idle").map((t) => t.id),
      },
      step: asking ? `steer_browser ${asking.id} sign in to LinkedIn` : "steer_terminal task/terminal/b7710c check the CI run",
      recent: [
        { name: "read_file", arg: "~/career/networking/tracker.json", ok: true },
        { name: "steer_browser", arg: "task/browser/d41e07 sign in", ok: asking ? true : null },
      ],
      tasks: live,
      tasks_unreadable: null,
      pending: [],
    };
  }
  if (id === "efficiency-specialist") {
    return {
      job: { from: "efficiency-specialist", at: ago(2 * MIN), content: "Nightly review. Recall today's entries with recall_memory, filtered by date." },
      work: { state: "idle", since: null, waiting_on: [] },
      step: null,
      recent: [],
      tasks: live,
      tasks_unreadable: null,
      pending: [],
    };
  }
  if (id === "coding-manager") {
    return {
      job: { from: null, at: ago(9 * MIN), content: "Build the fixture transport for thaali and run the type-check." },
      work: { state: "waiting", since: ago(30_000), waiting_on: ["task/terminal/c5728f"] },
      step: "steer_terminal task/terminal/c5728f build thaali",
      recent: [{ name: "steer_terminal", arg: "task/terminal/c5728f build thaali", ok: true }],
      tasks: live,
      tasks_unreadable: null,
      pending: [],
    };
  }
  return null;
}

/** Whether an agent's work and process lanes run, from its status block. */
function runningFor(scenario: Scenario, id: string): AgentRecord["running"] {
  const status = statusFor(scenario, id);
  const work = status?.work.state === "running";
  const process = id === "efficiency-specialist";
  return {
    work,
    process,
    waiting_on:
      status?.work.state === "waiting" && status.work.since !== null
        ? { targets: status.work.waiting_on, since: status.work.since, wakes_by: ago(-15 * MIN) }
        : null,
    status: work || process || status?.work.state === "waiting" ? status : null,
  };
}

function record(scenario: Scenario, [id, parent, role]: AgentSeed, i: number): AgentRecord {
  return {
    id,
    name: id,
    system_prompt: systemPrompt(role),
    parent_agent_id: parent,
    active: !id.includes("-archive-"),
    running: runningFor(scenario, id),
    sessions: { tasks: agentTasks(scenario, id) },
    created_at: ago((40 - (i % 30)) * DAY),
    updated_at: ago((i % 9) * HOUR),
  };
}

/** Hath `GET /agents` for a scenario. */
export function agents(scenario: Scenario): AgentRecord[] {
  switch (scenario) {
    case "empty":
      return [];
    case "long": {
      const base = TREE.map((seed, i) => record(scenario, seed, i));
      const longSeed: AgentSeed = [LONG_ID, "career-manager", "You fill and submit this one application, then report the confirmation."];
      const archived: AgentSeed = ["cse-431-specialist-archive-1011", "education-specialist", "Retired. You owned CSE 431 until the reset."];
      return [...base, record(scenario, longSeed, 40), record(scenario, archived, 41)];
    }
    case "many": {
      const base = TREE.map((seed, i) => record(scenario, seed, i));
      const workers = Array.from({ length: 100 }, (_, i): AgentRecord => {
        const parent = TREE[(i % 12) + 1]![0];
        return record(scenario, [`browser-worker-${(i + 1).toString().padStart(3, "0")}`, parent, "One-shot worker for a single lookup."], i);
      });
      return [...base, ...workers];
    }
    default:
      return TREE.map((seed, i) => record(scenario, seed, i));
  }
}

/** Hath `GET /agents/:id`. */
export function agentDetail(scenario: Scenario, id: string): AgentDetail {
  const all = agents(scenario);
  const found = all.find((a) => a.id === id);
  if (!found) {
    throw new Error(`fixtures: no agent ${id}`);
  }
  return { ...found, children: all.filter((a) => a.parent_agent_id === id) };
}

/** Hath `GET /health`. */
export function health(): HathHealth {
  return { status: "ok", started_at: ago(7 * HOUR) };
}

const THREAD_AGENTS = [
  "finance-specialist",
  "networking-specialist",
  "schedule-specialist",
  "career-manager",
  "health-specialist",
  "efficiency-specialist",
  "coding-manager",
  "cse-300-specialist",
] as const;

const LAST_MESSAGES: Record<(typeof THREAD_AGENTS)[number], string> = {
  "finance-specialist": "Both pending charges are expected:\n- **$12.40** Spotify, renews on the 3rd\n- **$38.00** gym, monthly\n\nNothing else is due before Friday.",
  "networking-specialist": "Picked up. I'm sending this week's batch of connection requests now and will log each one in the tracker.",
  "schedule-specialist": "Thursday's gym block moves to 6:00 PM; the study block after it is unchanged.",
  "career-manager": "Two applications are ready for your yes: Northwind (SWE intern) and Contoso (data intern). Both resumes are tailored and in ~/career/resume/applications.",
  "health-specialist": "Gym days this week: Mon, Wed, Fri. Sleep averaged 7h 12m over the last seven nights.",
  "efficiency-specialist": "Nightly review done. Nothing marked Completed was missed; I carried one study block to tomorrow.",
  "coding-manager": "The type-check passed on thaali (0 errors). The build is still running.",
  "cse-300-specialist": "Quiz 2 is Thursday at 1:00 PM in room 1345. Chapters 5 and 6 are covered.",
};

/** Hath `GET /threads`: the human threads, newest first. */
export function threads(scenario: Scenario): ThreadSummary[] {
  if (scenario === "empty") {
    return [];
  }
  const rows = THREAD_AGENTS.map((agentId, i): ThreadSummary => ({
    agent_id: agentId,
    agent_name: agentId,
    last_message:
      scenario === "long" && i === 0 ? `${LAST_MESSAGES[agentId]}\n\n${"Statement detail line. ".repeat(160)}` : LAST_MESSAGES[agentId],
    last_at: ago((i * 37 + 4) * MIN),
    from_user: i === 1 || i === 6,
    unread: i === 0 ? 2 : i === 3 ? 1 : i === 4 ? 5 : 0,
    read_seq: i === 0 ? 1180 : null,
  }));
  return scenario === "many"
    ? Array.from({ length: 60 }, (_, i) => ({ ...rows[i % rows.length]!, agent_id: `${rows[i % rows.length]!.agent_id}-${i}`, agent_name: `${rows[i % rows.length]!.agent_name}-${i}` }))
    : rows;
}

const RECEIPT: AttachmentSummary = {
  id: "a1111111-1111-4111-8111-111111111111",
  filename: "october-statement.pdf",
  media_type: "application/pdf",
  size_bytes: 184_320,
  description: null,
};

/** Hath `GET /agents/:id/messages`: one thread, oldest first. */
export function messages(scenario: Scenario, agentId: string): DurableMessage[] {
  const row = (seq: number, fromUser: boolean, content: string, minutesAgo: number, extra: Partial<DurableMessage> = {}): DurableMessage => ({
    id: `00000000-0000-4000-8000-${seq.toString().padStart(12, "0")}`,
    seq,
    from_agent_id: fromUser ? null : agentId,
    to_agent_id: fromUser ? agentId : null,
    content,
    attachments: [],
    created_at: ago(minutesAgo * MIN),
    ...extra,
  });
  if (scenario === "empty") {
    return [];
  }
  const rows: DurableMessage[] = [
    row(1175, true, "Check whether the two pending Chase charges are expected before Friday.", 52),
    row(1176, false, "On it. I'll read the October statement and compare against the budget.", 51),
    row(1177, false, "Hath: the work stopped because the browser task `task/browser/3f2a91` was closed; the job was left unfinished.", 33, { kind: "notice" }),
    row(1178, true, "Retry it.", 30),
    row(1179, false, "Both pending charges are expected:\n- **$12.40** Spotify, renews on the 3rd\n- **$38.00** gym, monthly\n\nStatement attached.", 8, { attachments: [RECEIPT] }),
    row(1180, true, "Thanks", 6),
  ];
  if (scenario === "long") {
    rows.push(row(1181, false, `${"A long line of statement detail that wraps across the bubble. ".repeat(60)}\n\n\`\`\`\n${"x".repeat(240)}\n\`\`\``, 3));
  }
  return rows;
}

/** Hath `GET /agents/:id/logs`: a few wakes, newest first. */
export function agentLogs(agentId: string): LogRecord[] {
  const wake = (n: number) => `00000000-0000-4000-9000-${n.toString().padStart(12, "0")}`;
  const row = (n: number, lane: LogRecord["lane"], event: LogRecord["event"], payload: Record<string, unknown>, minutesAgo: number, wakeN: number): LogRecord => ({
    id: `00000000-0000-4000-a000-${n.toString().padStart(12, "0")}`,
    agent_id: agentId,
    lane,
    event,
    payload,
    wake_id: wake(wakeN),
    created_at: ago(minutesAgo * MIN),
  });
  return [
    row(5, "work", "tool_result", { name: "yield", content: "{\"yielded\":true}", is_error: false, tool_use_id: "toolu_05" }, 1, 2),
    row(4, "work", "response", { usage: { input_tokens: 4, output_tokens: 190, cache_read_input_tokens: 41_000, cache_creation_input_tokens: 220 }, content: [{ type: "text", text: "Both charges match the budget, so I'll report that and stop." }, { type: "tool_use", id: "toolu_05", name: "yield", input: {} }] }, 1, 2),
    row(3, "work", "tool_result", { name: "read_file", content: "Spotify 12.40 monthly\nGym 38.00 monthly", is_error: false, tool_use_id: "toolu_04" }, 9, 2),
    row(2, "work", "response", { usage: { input_tokens: 4, output_tokens: 120, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 0 }, content: [{ type: "tool_use", id: "toolu_04", name: "read_file", input: { path: "~/finance/budget.md" } }] }, 9, 2),
    row(1, "process", "message", { seq: 1176, content: "On it. I'll read the October statement and compare against the budget.", direction: "send", message_id: "m-1", attachments: [], to_agent_id: null, from_agent_id: agentId }, 51, 1),
  ];
}

/** Hath `GET /agents/:id/schedules`. */
export function schedules(agentId: string): ScheduledMessage[] {
  return [
    { id: "s0000000-0000-4000-8000-000000000001", from_agent_id: agentId, to_agent_id: agentId, content: "Morning money check: balances and anything pending.", run_at: ago(-14 * HOUR), interval_minutes: 1440, created_at: ago(20 * DAY) },
    { id: "s0000000-0000-4000-8000-000000000002", from_agent_id: agentId, to_agent_id: agentId, content: "Weekly spend summary for Ankur.", run_at: ago(-3 * DAY), interval_minutes: 10_080, created_at: ago(20 * DAY) },
  ];
}

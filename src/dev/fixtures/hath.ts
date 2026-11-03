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

/** The tool calls of the newest wake's work lane: the call, its input and what it answered (`error` marks a failed one). */
const NEWEST_WORK: ReadonlyArray<{ name: string; input: Record<string, unknown>; result: string; error?: true; thought?: string; text?: string }> = [
  { name: "list_files", input: { path: "~/finance" }, result: "statements/\nbudget.md\nreceipts/", thought: "**Find the statement**\nThe October statement should be under ~/finance/statements." },
  { name: "read_file", input: { path: "~/finance/statements/2026-10.csv" }, result: "2026-10-03,Spotify,12.40\n2026-10-06,Gym,38.00\n2026-10-11,Groceries,64.12" },
  { name: "read_file", input: { path: "~/finance/budget.md" }, result: "Spotify 12.40 monthly\nGym 38.00 monthly" },
  { name: "search_files", input: { pattern: "Spotify", path: "~/finance/receipts" }, result: "index unavailable: receipts are not indexed yet", error: true },
  { name: "run_command", input: { cmd: "grep -ril spotify ~/finance/receipts" }, result: "{\"exit\":0,\"stdout\":\"receipts/spotify-oct.pdf\\n\"}", text: "The index is down, so I searched the receipts folder directly." },
  { name: "read_file", input: { path: "~/finance/receipts/spotify-oct.pdf" }, result: "Spotify Premium 12.40 USD, renews 2026-11-03" },
  { name: "recall", input: { query: "gym membership monthly charge" }, result: "Gym: $38.00 monthly, charged on the 6th." },
  { name: "read_file", input: { path: "~/finance/receipts/gym-oct.pdf" }, result: "IM West gym 38.00 USD, paid 2026-10-06" },
  { name: "write_file", input: { path: "~/finance/notes/2026-10-reconcile.md", content: "Both pending charges match the budget." }, result: "{\"written\":true}" },
  { name: "ingest", input: { text: "October charges for Spotify and the gym matched the budget." }, result: "{\"stored\":2}" },
];

/** Hath `GET /agents/:id/logs`: eight wakes, newest first; the newest is long, with a failed tool, a thought and a reply. */
export function agentLogs(agentId: string): LogRecord[] {
  const wake = (n: number) => `00000000-0000-4000-9000-${n.toString().padStart(12, "0")}`;
  const rows: LogRecord[] = [];
  const row = (wakeN: number, minutesAgo: number, lane: LogRecord["lane"], event: LogRecord["event"], payload: Record<string, unknown>) => {
    rows.push({
      id: `00000000-0000-4000-a000-${(rows.length + 1).toString().padStart(12, "0")}`,
      agent_id: agentId,
      lane,
      event,
      payload,
      wake_id: wake(wakeN),
      created_at: ago(minutesAgo * MIN),
    });
  };
  let seq = 1100;
  const usage = { input_tokens: 4, output_tokens: 120, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 0 };
  const receive = (wakeN: number, at: number, from: string | null, content: string, scheduled = false) =>
    row(wakeN, at, "process", "message", { seq: (seq += 1), content, direction: "receive", message_id: `m-${seq}`, attachments: [], to_agent_id: agentId, from_agent_id: from, ...(scheduled ? { schedule_id: "s0000000-0000-4000-8000-000000000001" } : {}) });
  const send = (wakeN: number, at: number, to: string | null, content: string, extra: Record<string, unknown> = {}) =>
    row(wakeN, at, "process", "message", { seq: (seq += 1), content, direction: "send", message_id: `m-${seq}`, attachments: [], to_agent_id: to, from_agent_id: agentId, ...extra });
  const turn = (wakeN: number, at: number, lane: LogRecord["lane"], content: unknown[], stop: "tool_use" | "end_turn") =>
    row(wakeN, at, lane, "response", { usage, stop_reason: stop, content });
  const result = (wakeN: number, at: number, lane: LogRecord["lane"], id: string, name: string, content: string, isError = false) =>
    row(wakeN, at, lane, "tool_result", { name, content, is_error: isError, tool_use_id: id });

  receive(1, 600, null, "Pull the September statement and file it under ~/finance/statements.");
  turn(1, 599, "process", [{ type: "text", text: "Filing it now." }, { type: "tool_use", id: "t1-1", name: "hand_off", input: { task: "file the September statement" } }], "tool_use");
  result(1, 599, "process", "t1-1", "hand_off", "{\"handed_off\":true}");
  turn(1, 596, "work", [{ type: "tool_use", id: "t1-2", name: "read_file", input: { path: "~/downloads/2026-09.csv" } }], "tool_use");
  turn(1, 590, "work", [{ type: "text", text: "Filed." }], "end_turn");
  send(1, 589, null, "Filed the September statement.");

  receive(2, 540, agentId, "Morning money check: balances and anything pending.", true);
  turn(2, 539, "process", [{ type: "text", text: "Nothing pending this morning." }], "end_turn");

  send(3, 480, null, "[runtime] The work lane stopped: the model refused the request.", { kind: "notice" });

  receive(4, 420, "efficiency-specialist", "Can you confirm the gym charge for the weekly review?");
  turn(4, 419, "process", [{ type: "text", text: "Checking the October statement." }], "end_turn");
  send(4, 418, "efficiency-specialist", "Confirmed: **$38.00** monthly, charged on the 6th.");

  receive(5, 300, null, "Thanks.");
  turn(5, 299, "process", [{ type: "text", text: "Any time." }], "end_turn");

  receive(6, 210, agentId, "Weekly spend summary for Ankur.", true);
  turn(6, 209, "process", [{ type: "text", text: "This week's spending is on budget." }], "end_turn");

  receive(7, 120, null, "Is the gym charge right?");
  turn(7, 119, "process", [{ type: "text", text: "Yes, it matches the budget." }], "end_turn");

  receive(8, 54, null, "Reconcile the October statement against the budget.");
  turn(8, 53, "process", [
    { type: "thinking", thinking: "**Hand the reading to the work lane**\nThis needs file reads, so the work lane should do it and I report back." },
    { type: "text", text: "I'll have the work lane read the statement and the budget." },
    { type: "tool_use", id: "t8-0", name: "hand_off", input: { task: "reconcile the October statement against the budget" } },
  ], "tool_use");
  result(8, 53, "process", "t8-0", "hand_off", "{\"handed_off\":true}");
  NEWEST_WORK.forEach((call, i) => {
    const id = `t8-${i + 1}`;
    const blocks: unknown[] = [];
    if (call.thought) blocks.push({ type: "thinking", thinking: call.thought });
    if (call.text) blocks.push({ type: "text", text: call.text });
    blocks.push({ type: "tool_use", id, name: call.name, input: call.input });
    turn(8, 50 - i * 4, "work", blocks, "tool_use");
    result(8, 50 - i * 4, "work", id, call.name, call.result, call.error === true);
  });
  turn(8, 9, "work", [{ type: "text", text: "Both charges match the budget, so I'll report that and stop." }, { type: "tool_use", id: "t8-yield", name: "yield", input: {} }], "tool_use");
  result(8, 9, "work", "t8-yield", "yield", "{\"yielded\":true}");
  send(8, 1, null, "Both pending charges are expected:\n- **$12.40** Spotify, renews on the 3rd\n- **$38.00** gym, monthly");

  return rows.reverse();
}

/** Hath `GET /agents/:id/schedules`: two the agent sent itself, one another agent sent it every three hours, and a one-shot it sent. */
export function schedules(agentId: string): ScheduledMessage[] {
  const id = (n: number) => `s0000000-0000-4000-8000-${([...agentId].reduce((sum, c) => sum + c.charCodeAt(0), 0) * 10 + n).toString().padStart(12, "0")}`;
  return [
    { id: id(1), from_agent_id: agentId, to_agent_id: agentId, content: "Morning money check: balances and anything pending.", run_at: ago(-14 * HOUR), interval_minutes: 1440, created_at: ago(20 * DAY) },
    { id: id(2), from_agent_id: agentId, to_agent_id: agentId, content: "Weekly spend summary for Ankur.", run_at: ago(-3 * DAY), interval_minutes: 10_080, created_at: ago(20 * DAY) },
    { id: id(3), from_agent_id: "efficiency-specialist", to_agent_id: agentId, content: "Check the day's spending against the budget and tell me anything over.", run_at: ago(-2 * HOUR), interval_minutes: 180, created_at: ago(9 * DAY) },
    { id: id(4), from_agent_id: agentId, to_agent_id: "schedule-specialist", content: "Ask whether the gym day moved to Thursday.", run_at: ago(-26 * HOUR), interval_minutes: null, created_at: ago(1 * DAY) },
  ];
}

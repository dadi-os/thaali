import type {
  AgentDetail,
  AgentRecord,
  AgentRunning,
  AttachmentSummary,
  DurableMessage,
  HathHealth,
  JobLedger,
  RoutineList,
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

/** The job ledger of an agent that is on a job, or null. Each one shows a state the sheet and the list draw differently. */
function ledgerFor(scenario: Scenario, id: string): JobLedger | null {
  const tasks = agentTasks(scenario, id).filter((t) => t.status !== "asleep");
  if (id === "finance-specialist") {
    return {
      job: 1175,
      requester: null,
      opened: { seq: 1175, at: ago(4 * MIN), content: "Check whether the two pending Chase charges are expected before Friday." },
      answer_by: ago(-1 * MIN),
      asks: [{ to: "schedule-specialist", seq: 902, answered_seq: 903 }, { to: "health-specialist", seq: 904, answered_seq: null }],
      helpers: tasks.map((t) => t.id),
      stored: ["Chase pending charges, October"],
      told: [],
      reminders: [ago(-20 * MIN)],
      stopped: null,
    };
  }
  if (id === "networking-specialist") {
    return {
      job: 2210,
      requester: "career-manager",
      opened: { seq: 2210, at: ago(26 * MIN), content: "Send this week's batch of LinkedIn connection requests and log each one in the tracker." },
      answer_by: null,
      asks: [],
      helpers: tasks.map((t) => t.id),
      stored: [],
      told: [{ seq: 2211, preview: "Picked up. Signing in to LinkedIn first." }],
      reminders: [ago(-12 * MIN)],
      stopped: null,
    };
  }
  if (id === "coding-manager") {
    return {
      job: 3301,
      requester: null,
      opened: { seq: 3301, at: ago(9 * MIN), content: "Build the fixture transport for thaali and run the type-check." },
      answer_by: ago(4 * MIN),
      asks: [],
      helpers: tasks.map((t) => t.id),
      stored: [],
      told: [],
      reminders: [],
      stopped: null,
    };
  }
  if (id === "efficiency-specialist") {
    return {
      job: 4402,
      requester: null,
      opened: { seq: 4402, at: ago(15 * MIN), content: "Nightly review. Recall today's entries and tell me what was missed." },
      answer_by: ago(10 * MIN),
      asks: [{ to: "health-specialist", seq: 4403, answered_seq: null }],
      helpers: [],
      stored: [],
      told: [],
      reminders: [],
      stopped: { at: ago(6 * MIN), by: "ankur" },
    };
  }
  return null;
}

/** An agent's `running` block: the one loop, what it waits on, and the ledger of its job. */
function runningFor(scenario: Scenario, id: string): AgentRunning {
  const job = ledgerFor(scenario, id);
  const tasks = agentTasks(scenario, id).filter((t) => t.status !== "asleep");
  const asking = tasks.find((t) => t.status === "asking");
  const waits = id === "networking-specialist" || id === "coding-manager";
  return {
    working: id === "finance-specialist",
    waiting_on: waits ? { targets: id === "coding-manager" ? ["task/terminal/c5728f"] : [asking?.id ?? "task/browser/d41e07"], since: ago(id === "coding-manager" ? 30_000 : 3 * MIN), wakes_by: ago(-15 * MIN) } : null,
    job,
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
    row(1176, false, "Picked up. I'll read the October statement and compare against the budget.", 51, { status: null }),
    row(1178, true, "Retry the statement read; the first one timed out.", 30),
    row(1179, false, "Both pending charges are expected:\n- **$12.40** Spotify, renews on the 3rd\n- **$38.00** gym, monthly\n\nStatement attached.", 8, { attachments: [RECEIPT], status: "done" }),
    row(1180, true, "Thanks", 6),
  ];
  if (agentId === "health-specialist") {
    rows.push(row(1181, false, "Your Thursday lecture moved to 4:00 PM, which collides with the gym block. Should I move gym to Friday morning, or keep Thursday and skip the evening study block?", 12, { status: "needs_input" }));
  }
  if (agentId === "cse-300-specialist") {
    rows.push(row(1181, false, "I can't open the CSE 300 course page: MSU's sign-in is asking for a passkey approval on your phone, and no one has approved it for 20 minutes. I'll retry once you do.", 20, { status: "blocked" }));
  }
  if (scenario === "long") {
    rows.push(row(1181, false, `${"A long line of statement detail that wraps across the bubble. ".repeat(60)}\n\n\`\`\`\n${"x".repeat(240)}\n\`\`\``, 3, { status: "done" }));
  }
  return rows;
}

/** The id of the routine every fixture agent's scheduled wakes name. */
export const ROUTINE_MORNING = (agentId: string): string => `r0000000-0000-4000-8000-${agentId.length.toString().padStart(11, "0")}1`;
const ROUTINE_WEEKLY = (agentId: string): string => `r0000000-0000-4000-8000-${agentId.length.toString().padStart(11, "0")}2`;

/** Hath `GET /agents/:id/routines`: the agent's standing duties and its job's check-backs, next run first. */
export function routines(agentId: string): RoutineList {
  const routine = (id: string, title: string, procedure: string, at: string, days: RoutineList["routines"][number]["days"], nextHours: number, lastHours: number | null) => ({
    id,
    agent_id: agentId,
    title,
    procedure,
    at,
    days,
    next_run_at: ago(-nextHours * HOUR),
    last_run_at: lastHours === null ? null : ago(lastHours * HOUR),
    last_job_id: lastHours === null ? null : "4402",
    active: true,
    created_at: ago(20 * DAY),
  });
  if (agentId === "finance-specialist") {
    return {
      routines: [
        routine(ROUTINE_MORNING(agentId), "Morning money check", "Read yesterday's charges and the pending ones, compare them with the budget, and message Ankur only if something is off.", "07:30", null, 14, 10),
        routine(ROUTINE_WEEKLY(agentId), "Weekly spend summary", "Sum the week's spending by category and send Ankur one short message with the total and the biggest line.", "18:00", ["sun"], 70, 98),
      ],
      reminders: [{ id: "q0000000-0000-4000-8000-000000000001", agent_id: agentId, job_id: "1175", note: "Check the Chase charges settled", run_at: ago(-20 * MIN) }],
    };
  }
  if (agentId === "career-manager") {
    return { routines: [routine(ROUTINE_MORNING(agentId), "Application sweep", "Read the recruiter mail the specialists flagged, update the tracker, and list what needs Ankur's yes.", "09:00", ["mon", "tue", "wed", "thu", "fri"], 20, 4)], reminders: [] };
  }
  return { routines: [], reminders: [] };
}

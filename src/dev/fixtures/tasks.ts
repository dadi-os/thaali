import type { NasTask } from "../../shared/api/nas";
import type { AgentTask, TaskStatus } from "../../types/hath";
import type { Scenario } from "../scenario";
import { agoNanos, MIN } from "./time";

/** One helper task as the fixtures describe it; Nas's and Hath's views are both derived from it. */
type TaskSeed = {
  /** Hex suffix of the task address. */
  hex: string;
  kind: "browser" | "terminal";
  owner: string;
  status: TaskStatus;
  /** Real purposes are clipped to 121 characters by Nas and may carry newlines. */
  purpose: string;
  /** What Hath's `sessions.tasks[].current` says. */
  current: string;
  /** What Nas's `state` says; a sleeping task has none. */
  state: string;
  /** Minutes since the task last did anything. */
  idleMin: number;
};

const NORMAL: TaskSeed[] = [
  {
    hex: "3f2a91",
    kind: "browser",
    owner: "finance-specialist",
    status: "working",
    purpose: "Read only. Chase checking and Sapphire card: October statement, then the two pending charges and their merchants.",
    current: "chase.com/accounts/statements/october",
    state: "Reading the October statement, page 2 of 3",
    idleMin: 0.2,
  },
  {
    hex: "b7710c",
    kind: "terminal",
    owner: "networking-specialist",
    status: "idle",
    purpose: "Read-only check of the failing nas CI run, then summarise which job failed and why.",
    current: "~/projects/nas · gh run view 481 --log-failed",
    state: "Waiting for the next steer; the last command exited 0",
    idleMin: 4,
  },
  {
    hex: "8ecaaf",
    kind: "browser",
    owner: "resume-specialist",
    status: "asleep",
    purpose: "Read only. Outlook web: newest message from the recruiter at Northwind, with any attachment.",
    current: "",
    state: "",
    idleMin: 47,
  },
  {
    hex: "c5728f",
    kind: "terminal",
    owner: "coding-manager",
    status: "working",
    purpose: "Build the fixture transport for thaali and run the type-check, then report what failed.",
    current: "~/projects/thaali · npm run build",
    state: "tsc is checking src/dev; 3 files so far",
    idleMin: 0.5,
  },
  {
    hex: "655b8f",
    kind: "terminal",
    owner: "efficiency-specialist",
    status: "asleep",
    purpose: "Read-only. Gmail: find the newest one-time code from the sender noreply@northwind.example and report it.",
    current: "",
    state: "",
    idleMin: 130,
  },
];

const ASKING: TaskSeed = {
  hex: "d41e07",
  kind: "browser",
  owner: "networking-specialist",
  status: "asking",
  purpose: "Sign in to LinkedIn and open the connection requests page; pass the Okta verification with the passkey if listed.",
  current: "linkedin.com/checkpoint/challenge",
  state: "Okta Verify push sent; waiting for Ankur to tap it",
  idleMin: 1,
};

const LONG: TaskSeed[] = [
  {
    hex: "a09c33",
    kind: "browser",
    owner: "application-wells-fargo-technology-summer-internship-software-engineering",
    status: "working",
    purpose:
      "Read only. Fill the Wells Fargo application's work-history section from the resume, then stop before the final\nsubmit and report the confirmation page's text exactly as shown…",
    current:
      "wellsfargo.wd1.myworkdayjobs.com/en-US/WellsFargoJobs/job/Charlotte-NC/Technology-Summer-Internship-Software-Engineering_R-412398/apply/useMyLastApplication",
    state:
      "Filling the work-history section: employer 2 of 3, start date field is rejecting the 08/2025 format and I am trying the picker instead",
    idleMin: 0.1,
  },
  {
    hex: "e5520b",
    kind: "terminal",
    owner: "cse-431-specialist-archive-1011",
    status: "idle",
    purpose: "Read-only check of the failing dadi-os/nas CI run, Fri Oct 31 (6:23 and 6:25 PM ET notices, PR run \"CI - Lane and toolin…",
    current:
      "~/msu/semester-7/cse-431/work/hw3/src/main/java/edu/msu/cse431/distributedsystems/consensus/raft/LogReplicator.java and 14 more files",
    state: "Waiting for the next steer",
    idleMin: 12,
  },
];

/** The helper tasks a scenario holds. */
function seeds(scenario: Scenario): TaskSeed[] {
  switch (scenario) {
    case "empty":
      return [];
    case "asking":
      return [ASKING, ...NORMAL];
    case "long":
      return [...LONG, ...NORMAL];
    case "many":
      return Array.from({ length: 40 }, (_, i): TaskSeed => {
        const base = NORMAL[i % NORMAL.length]!;
        return { ...base, hex: `${base.hex.slice(0, 4)}${i.toString(16).padStart(2, "0")}`, idleMin: base.idleMin + i * 3 };
      });
    default:
      return NORMAL;
  }
}

function address(seed: TaskSeed): string {
  return `task/${seed.kind}/${seed.hex}`;
}

/** Nas `GET /tasks` for a scenario, most recently active first. */
export function nasTasks(scenario: Scenario): NasTask[] {
  return seeds(scenario)
    .map((seed, i): NasTask => ({
      task: address(seed),
      kind: seed.kind,
      id: seed.hex,
      owner: seed.owner,
      steered_by: seed.owner,
      purpose: seed.purpose,
      status: seed.status,
      ...(seed.status === "asleep" ? {} : { resource: seed.kind === "browser" ? String((i % 4) + 1) : `t${i + 1}` }),
      state: seed.state,
      created_at: agoNanos((seed.idleMin + 20) * MIN),
      last_activity: agoNanos(seed.idleMin * MIN),
    }))
    .sort((a, b) => Date.parse(b.last_activity) - Date.parse(a.last_activity));
}

/** The tasks Hath says one agent owns or last steered, most recently active first. */
export function agentTasks(scenario: Scenario, agentId: string): AgentTask[] {
  return seeds(scenario)
    .filter((seed) => seed.owner === agentId)
    .map((seed): AgentTask => ({
      id: address(seed),
      kind: seed.kind,
      status: seed.status,
      purpose: seed.purpose,
      current: seed.current,
      last_activity: agoNanos(seed.idleMin * MIN),
    }))
    .sort((a, b) => Date.parse(b.last_activity) - Date.parse(a.last_activity));
}

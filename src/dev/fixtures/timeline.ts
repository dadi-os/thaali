import type { PlanKind, SessionNote, TimelineItem, TimelineRequest } from "../../types/timeline";
import type { Scenario } from "../scenario";

const TIME_ZONE = "America/New_York";

function at(day: Date, hour: number, minute: number): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function localDate(day: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

type Draft = {
  id: string;
  title: string;
  kind: PlanKind;
  start?: Date;
  end?: Date;
  due?: Date;
  state?: TimelineItem["state"];
  place?: TimelineItem["place"];
  recurrence?: string;
  owner?: string;
  body?: string | null;
  notes?: SessionNote[];
};

function item(day: Date, draft: Draft, today: Date): TimelineItem {
  const past = (draft.end ?? draft.due ?? draft.start ?? day).getTime() < today.getTime();
  const outcome = past && draft.state !== "cancelled" ? (draft.id.length % 4 === 0 ? "missed" : "done") : null;
  return {
    id: draft.id,
    occurrence_date: localDate(day),
    title: draft.title,
    body: draft.body ?? null,
    kind: draft.kind,
    status: "confirmed",
    start_at: draft.start?.toISOString() ?? null,
    end_at: draft.end?.toISOString() ?? null,
    due_at: draft.due?.toISOString() ?? null,
    opens_at: null,
    all_day: false,
    time_zone: TIME_ZONE,
    hide_from_planner: false,
    state: draft.state ?? "scheduled",
    outcome,
    outcome_at: outcome === null ? null : (draft.end ?? draft.start ?? day).toISOString(),
    actual_start: null,
    actual_end: null,
    recurrence: draft.recurrence ?? null,
    series: draft.recurrence ? { completed: 6, total: 15 } : null,
    place: draft.place ?? null,
    owner: draft.owner ?? "schedule-specialist",
    notes: draft.notes ?? [],
  };
}

const ROOM_1345 = { id: "p0000000-0000-4000-8000-000000000001", title: "Engineering Building", address: "428 S Shaw Ln, East Lansing, MI 48824", room: "1345" };
const GYM = { id: "p0000000-0000-4000-8000-000000000002", title: "IM West", address: null, room: null };

function drafts(day: Date, long: boolean, many: boolean): Draft[] {
  const dow = day.getDay();
  const week = dow >= 1 && dow <= 5;
  const out: Draft[] = [
    { id: "shower-am", title: "Shower", kind: "shower", start: at(day, 7, 30), end: at(day, 7, 50), owner: "health-specialist" },
    { id: "lunch", title: "Lunch", kind: "meal", start: at(day, 12, 30), end: at(day, 13, 10), owner: "health-specialist" },
    { id: "study", title: long ? "Study block: CSE 335 homework 3, then reread chapters 5 and 6 before Thursday's quiz" : "Study block", kind: "study", start: at(day, 14, 0), end: at(day, 15, 30) },
  ];
  if (isSameDay(day, new Date())) {
    const now = Date.now();
    out.push({ id: "focus-now", title: "Focus block: reading week 9", kind: "focus", start: new Date(now - 25 * 60_000), end: new Date(now + 35 * 60_000), owner: "schedule-specialist" });
  }
  if (long) {
    out.push({
      id: "overflow",
      title: `Preparation for the ${"Extraordinarilylongunbrokenword".repeat(2)} review with the whole department, then a long debrief about everything that came up`,
      kind: "meeting",
      start: at(day, 8, 0),
      end: at(day, 9, 30),
      place: { id: "p0000000-0000-4000-8000-000000000003", title: "The Wharton Center for the Performing Arts, Cobb Great Hall, second floor mezzanine", address: "750 E Shaw Ln, East Lansing, MI 48824", room: "Mezzanine East 2C" },
      body: "Bring the printed agenda and the signed forms.",
      notes: Array.from({ length: 40 }, (_, i) => ({ id: `note-${i}`, title: `Note ${i + 1}: ${i % 7 === 0 ? "Averyveryverylongunbrokentoken".repeat(4) : "follow up on the open question from the last meeting"}`, body: null })),
      owner: "schedule-specialist",
    });
  }
  if (week) {
    out.push({ id: "cse300", title: "CSE 300 lecture", kind: "class", start: at(day, 10, 20), end: at(day, 11, 40), place: ROOM_1345, recurrence: "Every weekday", owner: "cse-300-specialist" });
  }
  if (dow === 1 || dow === 3 || dow === 5) {
    out.push({ id: "gym", title: "Gym", kind: "gym", start: at(day, 18, 0), end: at(day, 19, 0), place: GYM, owner: "health-specialist" });
  }
  if (dow === 2) {
    out.push({ id: "lab", title: "CSE 335 lab", kind: "lab", start: at(day, 16, 20), end: at(day, 18, 10), place: ROOM_1345, recurrence: "Every Tuesday", owner: "cse-335-specialist" });
  }
  if (dow === 4) {
    out.push({ id: "quiz", title: "CSE 300 quiz 2", kind: "exam", start: at(day, 13, 0), end: at(day, 13, 50), place: ROOM_1345, owner: "cse-300-specialist" });
    out.push({ id: "hw3", title: "Submit CSE 335 homework 3", kind: "task", due: at(day, 23, 59), owner: "cse-335-specialist" });
  }
  if (dow === 6) {
    out.push({ id: "coffee", title: "Coffee with Maya", kind: "social", start: at(day, 11, 0), end: at(day, 12, 0), state: "moved", owner: "schedule-specialist" });
  }
  if (dow === 0) {
    out.push({ id: "call", title: "Call with the Northwind recruiter", kind: "appointment", start: at(day, 16, 0), end: at(day, 16, 30), state: "cancelled", owner: "recruiter-specialist" });
    out.push({ id: "bill", title: "Pay the Spotify renewal", kind: "bill", due: at(day, 23, 59), owner: "finance-specialist" });
  }
  if (many) {
    out.push({ id: "night-owl", title: "Night owl study", kind: "study", start: at(day, 0, 10), end: at(day, 1, 10), owner: "schedule-specialist" });
    const titles = ["Submit CSE 335 homework 3", "Pay the Spotify renewal", "Renew the library books", "Send the Northwind recruiter a reply", "Upload the lab report", "Book the dentist", "Return the textbook"];
    titles.forEach((title, i) => out.push({ id: `due-midnight-${i}`, title, kind: "task", due: at(day, 0, 0), owner: "schedule-specialist" }));
    out.push({ id: "due-near", title: "Reply to the advisor", kind: "task", due: at(day, 0, 10), owner: "schedule-specialist" });
    out.push({ id: "due-far", title: "Water the plants", kind: "task", due: at(day, 9, 0), owner: "schedule-specialist" });
  }
  return out;
}

/** The "someday" ideas: plans with no date. */
function someday(): TimelineItem[] {
  return ["Learn to climb at the campus wall", "Visit the Detroit Institute of Arts", "Plan a weekend trip"].map((title, i): TimelineItem => ({
    id: `idea-${i}`,
    occurrence_date: null,
    title,
    body: null,
    kind: i === 2 ? "trip" : "social",
    status: "idea",
    start_at: null,
    end_at: null,
    due_at: null,
    opens_at: null,
    all_day: false,
    time_zone: null,
    hide_from_planner: false,
    state: "scheduled",
    outcome: null,
    outcome_at: null,
    actual_start: null,
    actual_end: null,
    recurrence: null,
    series: null,
    place: null,
    owner: "ingest",
    notes: [],
  }));
}

/** Yaad `POST /timeline`: the plans a view shows between `from` and `to`. */
export function timeline(scenario: Scenario, request: TimelineRequest): { items: TimelineItem[] } {
  if (scenario === "empty") {
    return { items: [] };
  }
  if (request.view === "someday") {
    return { items: someday() };
  }
  const from = new Date(request.from);
  const to = new Date(request.to);
  const today = new Date();
  const items: TimelineItem[] = [];
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  while (day.getTime() < to.getTime()) {
    for (const draft of drafts(day, scenario === "long", scenario === "many")) {
      const built = item(new Date(day), draft, today);
      const moment = new Date(built.start_at ?? built.due_at ?? day);
      const wantsDue = request.view === "due";
      const inRange = moment.getTime() >= from.getTime() && moment.getTime() < to.getTime();
      if (inRange && (wantsDue ? built.due_at !== null : request.view !== "planner" || built.start_at !== null)) {
        items.push(built);
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return { items };
}

import type {
  AttendedRequest,
  AttendedResponse,
  Plan,
  PlansRequest,
  Task,
  TaskDoneRequest,
  TaskDoneResponse,
  TasksRequest,
} from "../../types/planner";
import { dateKey, startOfDay } from "../../features/planner/dates";
import type { Scenario } from "../scenario";

const TIME_ZONE = "America/New_York";

const done = new Map<string, boolean>();
const attended = new Map<string, boolean | null>();

function at(day: Date, hour: number, minute: number): Date {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

type Draft = {
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay?: boolean;
  rsvp?: Plan["rsvp"];
  attended?: boolean | null;
  place?: Plan["place"];
  hub?: Plan["hub"];
  owner?: string;
  body?: string | null;
  notes?: Plan["notes"];
};

const ROOM_1345 = { id: "p0000000-0000-4000-8000-000000000001", title: "Engineering Building", address: "428 S Shaw Ln, East Lansing, MI 48824", room: "1345" };
const CAFE = { id: "p0000000-0000-4000-8000-000000000003", title: "Strange Matter Coffee", address: "311 E Grand River Ave, East Lansing, MI 48823", room: null };
const ZOOM = { id: "p0000000-0000-4000-8000-000000000004", title: "Zoom", address: "https://msu.zoom.us/j/98765432100?pwd=abc", room: null };
const GYM = { id: "p0000000-0000-4000-8000-000000000002", title: "IM West", address: "394 Chestnut Rd, East Lansing, MI 48824", room: null };
const CSE300 = { id: "h0000000-0000-4000-8000-000000000300", title: "CSE 300 class" };
const CSE335 = { id: "h0000000-0000-4000-8000-000000000335", title: "CSE 335 class" };

function plan(day: Date, draft: Draft, now: Date): Plan {
  const key = dateKey(day);
  const finished = (draft.end ?? draft.start).getTime() < now.getTime();
  const marked = attended.get(`${draft.id}-${key}`);
  const owner = draft.owner ?? "schedule-specialist";
  return {
    id: `${draft.id}-${key}`,
    title: draft.title,
    body: draft.body ?? null,
    rsvp: draft.rsvp ?? "yes",
    start_at: draft.start.toISOString(),
    end_at: draft.end?.toISOString() ?? null,
    all_day: draft.allDay ?? false,
    time_zone: TIME_ZONE,
    attended: marked !== undefined ? marked : finished && draft.rsvp !== "no" ? (draft.attended ?? (draft.id.length % 5 === 0 ? null : true)) : null,
    place: draft.place ?? null,
    hub: draft.hub ?? null,
    owner,
    notes: draft.notes ?? [],
  };
}

function ordinary(day: Date, week: boolean): Draft[] {
  const dow = day.getDay();
  const out: Draft[] = [
    { id: "shower-am", title: "Shower", start: at(day, 7, 30), end: at(day, 7, 50), owner: "health-specialist" },
    { id: "lunch", title: "Lunch", start: at(day, 12, 30), end: at(day, 13, 10), owner: "health-specialist" },
    { id: "study", title: "Study block", start: at(day, 14, 0), end: at(day, 15, 30), body: "CSE 335 homework 3, then reread chapters 5 and 6 before the quiz." },
  ];
  if (dow >= 1 && dow <= 5) {
    out.push({
      id: "cse300",
      title: "CSE 300 lecture",
      start: at(day, 10, 20),
      end: at(day, 11, 40),
      place: ROOM_1345,
      hub: CSE300,
      owner: "cse-300-specialist",
      notes: [{ id: "n1", title: "Covered graph traversal; follow up on the BFS proof", body: null }],
    });
  }
  if (dow === 1 || dow === 3 || dow === 5) {
    out.push({ id: "gym", title: "Gym", start: at(day, 18, 0), end: at(day, 19, 0), place: GYM, owner: "health-specialist" });
  }
  if (dow === 2) {
    out.push({ id: "lab", title: "CSE 335 lab", start: at(day, 16, 20), end: at(day, 18, 10), place: ROOM_1345, hub: CSE335, owner: "cse-335-specialist" });
  }
  if (dow === 3) {
    out.push({ id: "mixer", title: "Department mixer", start: at(day, 16, 0), end: at(day, 17, 0), rsvp: "no", place: ROOM_1345, owner: "schedule-specialist" });
    out.push({ id: "fair", title: "Career fair", start: at(day, 0, 0), end: at(day, 23, 59), allDay: true, owner: "recruiter-specialist" });
  }
  if (dow === 4) {
    out.push({ id: "quiz", title: "CSE 300 quiz 2", start: at(day, 13, 0), end: at(day, 13, 50), place: ROOM_1345, hub: CSE300, owner: "cse-300-specialist" });
  }
  if (dow === 1 || dow === 4) out.push({ id: "advisor", title: "Advisor meeting", start: at(day, 15, 0), end: at(day, 15, 30), place: ZOOM, owner: "schedule-specialist" });
  if (dow === 6) {
    out.push({ id: "coffee", title: "Coffee with Maya", start: at(day, 11, 0), end: at(day, 12, 0), rsvp: "yes", place: CAFE, owner: "schedule-specialist" });
    out.push({ id: "chicago", title: "Weekend in Chicago", start: at(day, 0, 0), end: at(new Date(day.getTime() + 86_400_000), 23, 59), allDay: true, owner: "schedule-specialist" });
  }
  if (week) {
    if (dow === 1) out.push({ id: "planning", title: "Quarterly planning review with the whole department", start: at(day, 9, 0), end: at(day, 10, 0), owner: "schedule-specialist" });
    if (dow === 2) out.push({ id: "standup", title: "Standup", start: at(day, 9, 0), end: at(day, 9, 30), owner: "schedule-specialist" });
    if (dow === 3) out.push({ id: "conf", title: "Midwest Systems Conference", start: at(day, 0, 0), end: at(new Date(day.getTime() + 86_400_000), 23, 59), allDay: true, owner: "schedule-specialist" });
    if (dow === 4) {
      out.push({ id: "visit", title: "Campus visit day", start: at(day, 0, 0), end: at(day, 23, 59), allDay: true, owner: "schedule-specialist" });
      out.push({ id: "hack", title: "Spartahack", start: at(day, 0, 0), end: at(new Date(day.getTime() + 86_400_000), 23, 59), allDay: true, hub: CSE335, owner: "schedule-specialist" });
    }
    if (dow === 5) {
      out.push({ id: "advising", title: "Advising appointment", start: at(day, 10, 0), end: at(day, 11, 30), owner: "schedule-specialist" });
      out.push({ id: "club", title: "Robotics club meeting", start: at(day, 10, 30), end: at(day, 12, 0), owner: "schedule-specialist" });
      out.push({ id: "mom", title: "Call with Mom", start: at(day, 16, 0), end: at(day, 16, 30), owner: "schedule-specialist" });
    }
  }
  if (day.getDate() === 20) {
    out.push({ id: "dentist", title: "Call the dentist about the cleaning", start: at(day, 10, 0), end: null, owner: "health-specialist" });
  }
  if (day.getDate() === 27) {
    out.push({ id: "oil", title: "Book the oil change", start: at(day, 9, 0), end: null, owner: "ingest" });
  }
  return out;
}

const BUSY = ["Standup", "Deep work: resume", "CSE 300 lecture", "Office hours", "Lunch with Priya", "CSE 335 lab", "Study group", "Gym", "Dinner", "Call with Mom", "Plan tomorrow", "Read"];

function busy(day: Date): Draft[] {
  return BUSY.map((title, i): Draft => {
    const start = at(day, 7, 0);
    start.setMinutes(i * 68);
    const end = new Date(start.getTime() + 54 * 60_000);
    return { id: `busy-${i}`, title, start, end, rsvp: i === 4 ? "no" : "yes", hub: i === 2 || i === 5 ? CSE300 : null, owner: "schedule-specialist" };
  });
}

/** Yaad `POST /planner/plans`: every plan touching `[from, to)`, earliest first. */
export function plans(scenario: Scenario, request: PlansRequest): { items: Plan[] } {
  if (scenario === "empty") {
    return { items: [] };
  }
  const from = new Date(request.from);
  const to = new Date(request.to);
  const now = new Date();
  const items: Plan[] = [];
  const crowded = scenario === "long" || scenario === "many" || scenario === "planner-busy";
  const day = startOfDay(new Date(from.getTime() - 86_400_000));
  while (day.getTime() < to.getTime()) {
    const isToday = dateKey(day) === dateKey(now);
    for (const draft of crowded && isToday ? busy(day) : ordinary(day, scenario === "planner-week")) {
      const built = plan(new Date(day), draft, now);
      const start = new Date(built.start_at).getTime();
      const end = built.end_at === null ? start : new Date(built.end_at).getTime();
      const overlaps = start < to.getTime() && end > from.getTime();
      if (overlaps && !items.some((item) => item.id === built.id)) {
        items.push(built);
      }
    }
    day.setDate(day.getDate() + 1);
  }
  return { items: items.sort((a, b) => a.start_at.localeCompare(b.start_at)) };
}

type TaskDraft = { id: string; title: string; hub?: Task["hub"]; owner: string; opens: number | null; closes: [day: number, hour: number, minute: number] | null; body?: string };

const TASKS: TaskDraft[] = [
  { id: "hw3", title: "Submit CSE 335 homework 3", hub: CSE335, owner: "cse-335-specialist", opens: -4, closes: [0, 23, 59] },
  { id: "reading", title: "CSE 300 reading: chapters 5 and 6", hub: CSE300, owner: "cse-300-specialist", opens: -2, closes: [0, 17, 0] },
  { id: "recruiter", title: "Reply to the Northwind recruiter", owner: "recruiter-specialist", opens: -1, closes: [1, 12, 0] },
  { id: "spotify", title: "Pay the Spotify renewal", owner: "finance-specialist", opens: 0, closes: [2, 23, 59] },
  { id: "review", title: "Quiz 2 review sheet, all five problem sets and the long title that must truncate cleanly", hub: CSE300, owner: "cse-300-specialist", opens: 0, closes: [3, 23, 59] },
  { id: "permit", title: "Renew the parking permit", owner: "ingest", opens: -9, closes: [-2, 23, 59] },
  { id: "flights", title: "Book flights for Chicago", owner: "schedule-specialist", opens: -10, closes: [-1, 23, 59] },
  { id: "linkedin", title: "Update the LinkedIn headline", owner: "networking-specialist", opens: -1, closes: null },
  { id: "lab2", title: "Lab 2 write-up", hub: CSE335, owner: "cse-335-specialist", opens: 2, closes: [6, 23, 59] },
];

const SOMEDAY: TaskDraft[] = [
  { id: "garage", title: "Organize the garage", owner: "manual", opens: null, closes: null },
  { id: "climb", title: "Learn to climb at the campus wall", owner: "ingest", opens: null, closes: null },
  { id: "trip", title: "Plan a weekend trip to Detroit", owner: "schedule-specialist", opens: null, closes: null },
  ...Array.from({ length: 12 }, (_, i): TaskDraft => ({ id: `split-${i}`, title: "Gym training split", owner: "health-specialist", opens: null, closes: null })),
  ...Array.from({ length: 4 }, (_, i): TaskDraft => ({ id: `weigh-${i}`, title: `Weekly weigh-in ${i + 1}`, owner: "health-specialist", opens: null, closes: null })),
];

function build(scenario: Scenario, draft: TaskDraft, today: Date, now: Date): Task {
  const opens = draft.opens === null ? null : new Date(today.getFullYear(), today.getMonth(), today.getDate() + draft.opens);
  const closes = draft.closes === null ? null : new Date(today.getFullYear(), today.getMonth(), today.getDate() + draft.closes[0], draft.closes[1], draft.closes[2]);
  const isDone = done.get(draft.id) ?? scenario === "planner-done";
  return {
    id: draft.id,
    title: draft.title,
    body: draft.body ?? null,
    opens_on: opens === null ? null : dateKey(opens),
    closes_at: closes?.toISOString() ?? null,
    done: isDone,
    verified_at: new Date(now.getTime() - (draft.id.length % 5) * 86_400_000).toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    past_due: !isDone && closes !== null && closes.getTime() < now.getTime(),
    hub: draft.hub ?? null,
    owner: draft.owner,
  };
}

/** Yaad `POST /planner/tasks`: a day's open, past due and done tasks, or the tasks with no window. */
export function tasks(scenario: Scenario, request: TasksRequest): { items: Task[] } {
  if (scenario === "empty") {
    return { items: [] };
  }
  const now = new Date();
  const today = startOfDay(now);
  if ("someday" in request) {
    return { items: SOMEDAY.map((draft) => build(scenario, draft, today, now)).filter((task) => !task.done) };
  }
  const key = request.on;
  const items = TASKS.map((draft) => build(scenario, draft, today, now)).filter((task) => {
    const closes = task.closes_at === null ? null : dateKey(new Date(task.closes_at));
    if (task.opens_on !== null && task.opens_on > key) return false;
    return task.past_due || closes === null || closes >= key;
  });
  return {
    items: items.sort((a, b) => (a.closes_at ?? "￿").localeCompare(b.closes_at ?? "￿") || a.title.localeCompare(b.title)),
  };
}

/** Yaad `PUT /planner/tasks/done`. */
export function setTaskDone(request: TaskDoneRequest): TaskDoneResponse {
  done.set(request.task_id, request.done);
  return request;
}

/** Yaad `PUT /planner/plans/attended`. */
export function setAttended(request: AttendedRequest): AttendedResponse {
  attended.set(request.plan_id, request.attended);
  return request;
}

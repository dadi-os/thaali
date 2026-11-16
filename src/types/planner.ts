/** Yaad wire types for the Planner: plans on the timeline and tasks on the checklist. */

/** Which filter `POST /timeline` applies. */
export type PlanViewName = "planner" | "month" | "tile";

/** Ankur's answer to a plan, as Yaad holds it: yes, no, or not yet answered. */
export type Rsvp = "yes" | "no" | null;

/** A memory attached to one plan: what was covered, what to follow up. */
export type PlanNote = { id: string; title: string; body: string | null };

/** Where a plan happens: its place, with the room its edge names. */
export type PlanPlace = { id: string; title: string; address: string | null; room: string | null };

/** The course a plan or task belongs to. */
export type Hub = { id: string; title: string };

/** One plan as a view shows it. A plan called off is closed and never appears. */
export type Plan = {
  id: string;
  title: string;
  body: string | null;
  rsvp: Rsvp;
  start_at: string;
  /** Null for a plan with no end. */
  end_at: string | null;
  all_day: boolean;
  time_zone: string | null;
  /** Whether Ankur was there; null until he says. */
  attended: boolean | null;
  place: PlanPlace | null;
  hub: Hub | null;
  /** The plan's agent id, else its source (`manual`, `ingest`). */
  owner: string;
  notes: PlanNote[];
};

export type PlansRequest = { from: string; to: string; view: PlanViewName };

export type PlansResponse = { items: Plan[] };

/** One task as the checklist shows it. */
export type Task = {
  id: string;
  title: string;
  body: string | null;
  /** Local date (`YYYY-MM-DD`) the task opens; null when it has no window. */
  opens_on: string | null;
  /** When the task closes; a date-only close arrives as 23:59 local. Null when open-ended. */
  closes_at: string | null;
  done: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  /** Its close has passed and it is not done. */
  past_due: boolean;
  hub: Hub | null;
  owner: string;
};

/** `{ on }` asks for a local day's checklist, `{ someday: true }` for the tasks with no window. */
export type TasksRequest = { on: string } | { someday: true };

export type TasksResponse = { items: Task[] };

/** Ankur's hand write on a task: done, or the mark taken back. */
export type TaskDoneRequest = { task_id: string; done: boolean };

export type TaskDoneResponse = { task_id: string; done: boolean };

/** Ankur's hand write on a plan: whether he was there. */
export type AttendedRequest = { plan_id: string; attended: boolean | null };

export type AttendedResponse = { plan_id: string; attended: boolean | null };

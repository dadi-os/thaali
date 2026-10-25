/** Yaad timeline wire types: plans read session by session through one view's filter. */

/** What a plan is; the planner draws commitments solid and routines quiet. */
export type PlanKind =
  | "class"
  | "lab"
  | "exam"
  | "task"
  | "meeting"
  | "appointment"
  | "reservation"
  | "social"
  | "trip"
  | "bill"
  | "meal"
  | "shower"
  | "gym"
  | "study"
  | "focus";

/** Which filter `POST /timeline` applies. */
export type TimelineViewName = "planner" | "due" | "month" | "someday" | "tile";

/** How one session turned out; null while nobody has said. */
export type Outcome = "done" | "missed";

/** A memory attached to one session: what was covered, what to follow up. */
export type SessionNote = { id: string; title: string; body: string | null };

/** Where a plan happens: its place, with the room its edge names. */
export type TimelinePlace = { id: string; title: string; address: string | null; room: string | null };

/** One session of a plan as a view shows it. */
export type TimelineItem = {
  /** The plan's node id, shared by every session of a series. */
  id: string;
  /** Local date the session was first scheduled for; with `id` it names the session. Null for an undated idea. */
  occurrence_date: string | null;
  title: string;
  body: string | null;
  kind: PlanKind | null;
  status: "idea" | "tentative" | "confirmed";
  /** Session times with any move applied; null for a deadline with no time set aside. */
  start_at: string | null;
  end_at: string | null;
  due_at: string | null;
  opens_at: string | null;
  all_day: boolean;
  time_zone: string | null;
  hide_from_planner: boolean;
  state: "scheduled" | "moved" | "cancelled";
  outcome: Outcome | null;
  outcome_at: string | null;
  actual_start: string | null;
  actual_end: string | null;
  /** The plan's rule in words; null for a one-off plan. */
  recurrence: string | null;
  /** Sessions completed and held so far, for a series. */
  series: { completed: number; total: number } | null;
  place: TimelinePlace | null;
  /** The agent that keeps it, or `manual` / `ingest` when no agent does. */
  owner: string;
  notes: SessionNote[];
};

export type TimelineRequest = { from: string; to: string; view: TimelineViewName };

export type TimelineResponse = { items: TimelineItem[] };

/** Ankur's one hand write: a session marked completed, or the mark taken back. */
export type OutcomeRequest = { plan_id: string; occurrence_date: string; outcome: "done" | null };

export type OutcomeResponse = { plan_id: string; occurrence_date: string; outcome: Outcome | null; outcome_at: string | null };

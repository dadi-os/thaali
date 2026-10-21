/** Yaad planner wire types: timed blocks of the day plan, apart from the memory graph. */

/** What a block is; the planner draws each kind differently. */
export type PlannerKind =
  | "wake"
  | "meal"
  | "class"
  | "exam"
  | "study"
  | "gym"
  | "shower"
  | "recruiting"
  | "free"
  | "lights_out"
  | "fixed";

/** The glyphs a block can carry. */
export type PlannerIcon =
  | "sun"
  | "cup"
  | "fork"
  | "book"
  | "pulse"
  | "drop"
  | "brief"
  | "leaf"
  | "moon"
  | "flag"
  | "pencil"
  | "walk"
  | "users"
  | "phone";

/** One timed block of the plan. */
export type PlannerBlock = {
  id: string;
  start_at: string;
  end_at: string;
  title: string;
  note: string | null;
  kind: PlannerKind;
  icon: PlannerIcon;
  /** The block never moves or shrinks to make room; false only for time that can give way. */
  fixed: boolean;
  /** The block may overlap others. */
  overlap_ok: boolean;
  /** When the block was marked done; null while open. */
  done_at: string | null;
  /** The writer: a Hath agent id or "manual". */
  source: string;
};

export type PlannerQueryRequest = { from: string; to: string };

export type PlannerQueryResponse = { blocks: PlannerBlock[] };

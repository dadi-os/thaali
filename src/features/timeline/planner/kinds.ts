import type { PlanKind } from "../../../types/timeline";

/** Words for a kind in the session card. */
export const KIND_LABEL: Record<PlanKind, string> = {
  class: "Class",
  lab: "Lab",
  exam: "Exam",
  task: "Task",
  meeting: "Meeting",
  appointment: "Appointment",
  reservation: "Reservation",
  social: "Social",
  trip: "Trip",
  bill: "Bill",
  gym: "Gym",
  study: "Study",
  focus: "Focus",
  meal: "Meal",
  shower: "Shower",
};

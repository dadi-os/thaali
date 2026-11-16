import { copyText } from "../../shared/desktop/clipboard";
import type { ActionList } from "../../shared/interaction/actions";
import { openAgent } from "../../contexts/chat";
import type { AgentRecord, Reminder, Routine } from "../../types/hath";

/** What a routine or reminder's actions need from its row. */
export type RoutineActionDeps = {
  /** Open the row already asking to cancel. */
  onCancel: () => void;
};

/** The actions on a routine or reminder row, declared once for its right-click menu: copy what it says, cancel it. */
export function routineActions(item: { kind: "routine"; routine: Routine } | { kind: "reminder"; reminder: Reminder }, deps: RoutineActionDeps): ActionList {
  const routine = item.kind === "routine";
  return [
    { id: "routine.copy-title", label: routine ? "Copy title" : "Copy note", icon: "copy", run: () => copyText(routine ? item.routine.title : item.reminder.note) },
    ...(routine ? [{ id: "routine.copy-procedure", label: "Copy procedure", icon: "copy" as const, run: () => copyText(item.routine.procedure) }] : []),
    "separator",
    { id: "routine.cancel", label: routine ? "Cancel routine" : "Cancel reminder", icon: "trash", destructive: true, run: deps.onCancel },
  ];
}

/** What an agent's actions need from the surface that shows it. */
export type AgentActionDeps = {
  /** Show the agent's details popover beside what was clicked. */
  onShowDetails?: () => void;
};

/** The actions on an agent, declared once for its right-click menu on a graph node and a list row: open its thread, show its details, copy its name or id. */
export function agentActions(agent: AgentRecord, deps: AgentActionDeps): ActionList {
  return [
    { id: "agent.thread", label: "Open thread", icon: "chevron", run: () => openAgent(agent.id) },
    { id: "agent.details", label: "Show details", icon: "info", disabledReason: deps.onShowDetails === undefined ? "This view has no details to show" : undefined, run: () => deps.onShowDetails?.() },
    "separator",
    { id: "agent.copy-name", label: "Copy name", icon: "copy", run: () => copyText(agent.name) },
    { id: "agent.copy-id", label: "Copy id", icon: "copy", run: () => copyText(agent.id) },
  ];
}

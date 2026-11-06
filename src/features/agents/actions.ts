import { copyText } from "../../shared/desktop/clipboard";
import type { ActionList } from "../../shared/interaction/actions";
import { openAgent } from "../../contexts/chat";
import type { AgentRecord, ScheduledMessage } from "../../types/hath";

/** What a schedule's actions need from its row. */
export type ScheduleActionDeps = {
  /** The agent at the other end of the schedule. */
  other: string;
  /** Open the row's editor. */
  onEdit: () => void;
  /** Open the editor already asking to cancel. */
  onCancel: () => void;
};

/** The actions on a schedule row, declared once for its right-click menu: edit it, copy its message or its other end, cancel it. */
export function scheduleActions(schedule: ScheduledMessage, deps: ScheduleActionDeps): ActionList {
  return [
    { id: "schedule.edit", label: "Edit schedule", icon: "pencil", run: deps.onEdit },
    { id: "schedule.copy-message", label: "Copy message", icon: "copy", run: () => copyText(schedule.content) },
    { id: "schedule.copy-agent", label: "Copy agent name", icon: "copy", run: () => copyText(deps.other) },
    "separator",
    { id: "schedule.cancel", label: "Cancel schedule", icon: "trash", destructive: true, run: deps.onCancel },
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

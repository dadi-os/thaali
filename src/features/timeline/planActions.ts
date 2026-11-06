import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { timeline } from "../../shared/api";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import type { Action, ActionList } from "../../shared/interaction/actions";
import { openAgent } from "../../contexts/chat";
import { requestDock } from "../../contexts/dock";
import { failureTarget, pushToast } from "../../contexts/toasts";
import type { AgentRecord } from "../../types/hath";
import type { TimelineItem } from "../../types/timeline";
import { keeperOf } from "./plans";

/** What {@link planActions} needs from the app to run a session's actions. */
export type PlanActionDeps = {
  /** The agent that keeps the session, or `null` when none still runs (Dadi then takes the message). */
  keeper: AgentRecord | null;
  /** Mark the session's occurrence done, or take the mark back. */
  setDone: (item: TimelineItem, done: boolean) => Promise<void>;
  /** Open the conversation with an agent. */
  message: (agentId: string) => void;
  /** Open the dock to talk to Dadi. */
  tellDadi: () => void;
  /** Show the session's node in Yaad. */
  showInYaad: (id: string) => void;
  /** Open the session card; absent where there is no card to open. */
  details?: () => void;
};

/**
 * What a person can do with a session: mark it Completed or take the mark back, message the agent that keeps it
 * (Dadi when none still runs), show it in Yaad, and open its details. One list, drawn by the right-click menu and
 * by the click menu alike; nothing here edits the plan.
 */
export function planActions(item: TimelineItem, { keeper, setDone, message, tellDadi, showInYaad, details }: PlanActionDeps): ActionList {
  const completed = item.outcome === "done";
  const markable = item.occurrence_date !== null && item.state !== "cancelled";
  const list: Array<Action | "separator"> = [];
  if (markable) {
    list.push({ id: "mark-done", label: completed ? "Take back done" : "Mark done", icon: completed ? "retry" : "check", run: () => setDone(item, !completed) });
  }
  list.push(
    keeper === null ? { id: "message", label: "Tell Dadi", icon: "send", run: tellDadi } : { id: "message", label: `Message ${keeper.name}`, icon: "send", run: () => message(keeper.id) },
    { id: "show-in-yaad", label: "Show in Yaad", icon: "graph", run: () => showInYaad(item.id) },
  );
  if (details !== undefined) {
    list.push({ id: "details", label: "Session details", icon: "info", run: details });
  }
  return list;
}

/**
 * The session actions of the running app: a function that gives the {@link planActions} for a session, reading the
 * keeper from Hath's cached agents at the moment a menu opens. `details` opens the session card, given the session.
 */
export function usePlanActions(details?: (item: TimelineItem) => void): (item: TimelineItem) => ActionList {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (item) =>
    planActions(item, {
      keeper: keeperOf(item, queryClient.getQueryData<AgentRecord[]>(AGENTS_QUERY_KEY)),
      setDone: async (target, done) => {
        try {
          await timeline.setOutcome({ plan_id: target.id, occurrence_date: target.occurrence_date!, outcome: done ? "done" : null });
          await queryClient.invalidateQueries({ queryKey: ["yaad", "timeline"] });
        } catch (error) {
          pushToast({ key: "timeline:outcome", tone: "error", title: "Yaad", body: error instanceof Error ? error.message : String(error), target: failureTarget(error) });
        }
      },
      message: openAgent,
      tellDadi: () => requestDock(`I want to talk about "${item.title}"`),
      showInYaad: (id) => navigate(`/yaad?focus=${id}`),
      details: details === undefined ? undefined : () => details(item),
    });
}

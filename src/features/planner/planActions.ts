import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { planner } from "../../shared/api";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import type { Action, ActionList } from "../../shared/interaction/actions";
import { openAgent } from "../../contexts/chat";
import { requestCompose } from "../../contexts/reply";
import { failureTarget, pushToast } from "../../contexts/toasts";
import type { AgentRecord } from "../../types/hath";
import type { Plan } from "../../types/planner";
import { hasEnded } from "./layout";
import { ownerAgent } from "./plans";

/** What {@link planActions} needs from the app to run a plan's actions. */
export type PlanActionDeps = {
  /** The agent that keeps the plan; null for a source (`manual`, `ingest`) or an agent that no longer runs. */
  agent: AgentRecord | null;
  /** Whether the plan has ended, so Ankur can say whether he was there. */
  ended: boolean;
  /** Write whether Ankur was at the plan, or clear the answer. */
  setAttended: (plan: Plan, attended: boolean | null) => Promise<void>;
  /** Open the conversation with an agent. */
  message: (agentId: string) => void;
  /** Show the plan's node in Yaad. */
  showInYaad: (id: string) => void;
  /** Open the plan card; absent where there is no card to open. */
  details?: () => void;
};

/**
 * What a person can do with a plan: say whether they attended once it has ended, message the agent that keeps it (when
 * one still runs), show it in Yaad, and open its details. One list, drawn by the right-click menu and the card alike;
 * RSVP and everything else about the plan change by messaging its agent, never by editing here.
 */
export function planActions(plan: Plan, { agent, ended, setAttended, message, showInYaad, details }: PlanActionDeps): ActionList {
  const list: Array<Action | "separator"> = [];
  if (ended && plan.rsvp !== "no" && !plan.all_day) {
    list.push(
      { id: "attended-yes", label: "Attended", icon: "check", selected: plan.attended === true, run: () => setAttended(plan, plan.attended === true ? null : true) },
      { id: "attended-no", label: "Didn’t attend", icon: "close", selected: plan.attended === false, run: () => setAttended(plan, plan.attended === false ? null : false) },
    );
  }
  if (agent !== null) {
    list.push({ id: "message", label: "Message agent", detail: `Message ${agent.name}`, icon: "send", run: () => message(agent.id) });
  }
  list.push({ id: "show-in-yaad", label: "Show in Yaad", icon: "graph", run: () => showInYaad(plan.id) });
  if (details !== undefined) {
    list.push({ id: "details", label: "Plan details", icon: "info", run: details });
  }
  return list;
}

/**
 * The plan actions of the running app: a function that gives the {@link planActions} for a plan, reading the agent from
 * Hath's cached agents at the moment a menu opens. `details` opens the plan card, given the plan.
 */
export function usePlanActions(details?: (plan: Plan) => void): (plan: Plan) => ActionList {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (plan) =>
    planActions(plan, {
      agent: ownerAgent(plan.owner, queryClient.getQueryData<AgentRecord[]>(AGENTS_QUERY_KEY)),
      ended: hasEnded(plan, new Date()),
      setAttended: async (target, attended) => {
        try {
          await planner.setAttended({ plan_id: target.id, attended });
          await queryClient.invalidateQueries({ queryKey: ["yaad", "planner", "plans"] });
        } catch (error) {
          pushToast({ key: "planner:attended", tone: "error", title: "Couldn’t save attendance", body: error instanceof Error ? error.message : String(error), target: failureTarget(error) });
        }
      },
      message: (agentId) => {
        openAgent(agentId);
        requestCompose(`I want to talk about "${plan.title}"`);
      },
      showInYaad: (id) => navigate(`/yaad?focus=${id}`),
      details: details === undefined ? undefined : () => details(plan),
    });
}

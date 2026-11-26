import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import type { Action, ActionList } from "../../shared/interaction/actions";
import { openAgent } from "../../contexts/chat";
import { pushToast } from "../../contexts/toasts";
import { copyText } from "../../shared/desktop/clipboard";
import { openExternal } from "../../shared/desktop/open";
import { requestCompose } from "../../contexts/reply";
import type { AgentRecord } from "../../types/hath";
import type { Plan } from "../../types/planner";
import { hasStarted, useSetAttended } from "./attended";
import { meetingLink } from "./meeting";
import { canTell, rsvpChoice, rsvpMessage } from "./rsvp";
import { ownerAgent } from "./plans";

/** What {@link planActions} needs from the app to run a plan's actions. */
export type PlanActionDeps = {
  /** The agent that keeps the plan; null for a source (`manual`, `ingest`) or an agent that no longer runs. */
  agent: AgentRecord | null;
  /** Whether the plan has begun, so Ankur can say whether he was there. */
  started: boolean;
  /** The instant the menu opens at: Going / Not going are offered until the plan ends. */
  now: Date;
  /** Write whether Ankur was at the plan, or clear the answer. */
  setAttended: (plan: Plan, attended: boolean | null) => void;
  /** Open the conversation with an agent. */
  message: (agentId: string) => void;
  /** Open the agent's conversation with `text` already in the composer. */
  tell: (agentId: string, text: string) => void;
  /** Open a video call's link in the browser. */
  join: (url: string) => void;
  /** Copy a video call's link to the clipboard. */
  copyLink: (url: string) => void;
  /** Show the plan's node in Yaad. */
  showInYaad: (id: string) => void;
  /** Open the plan card; absent where there is no card to open. */
  details?: () => void;
};

/**
 * What a person can do with a plan: say whether they attended once it has begun, join or copy the link of its video call, message the agent that keeps it (when
 * one still runs), show it in Yaad, and open its details. One list, drawn by the right-click menu and the card alike;
 * Going and Not going say it to the agent that keeps the plan, who records it; nothing here edits the plan.
 */
export function planActions(plan: Plan, { agent, started, now, setAttended, message, tell, join, copyLink, showInYaad, details }: PlanActionDeps): ActionList {
  const list: Array<Action | "separator"> = [];
  if (started && plan.rsvp !== "no" && !plan.all_day) {
    list.push(
      { id: "attended-yes", label: "Attended", icon: "check", selected: plan.attended === true, run: () => setAttended(plan, plan.attended === true ? null : true) },
      { id: "attended-no", label: "Didn’t attend", icon: "close", selected: plan.attended === false, run: () => setAttended(plan, plan.attended === false ? null : false) },
    );
  }
  const call = meetingLink(plan);
  if (call !== null) {
    list.push(
      { id: "join-call", label: "Join call", detail: `${call.service} · ${call.host}`, icon: "video", run: () => join(call.url) },
      { id: "copy-link", label: "Copy link", icon: "copy", run: () => copyLink(call.url) },
    );
  }
  if (agent !== null && canTell(plan, true, now)) {
    const choice = rsvpChoice(plan);
    list.push(
      { id: "rsvp-yes", label: "Going", detail: `Tell ${agent.name} you are going`, icon: "check", selected: choice === "yes", run: () => tell(agent.id, rsvpMessage(plan, "yes")) },
      { id: "rsvp-no", label: "Not going", detail: `Tell ${agent.name} you are not going`, icon: "close", selected: choice === "no", run: () => tell(agent.id, rsvpMessage(plan, "no")) },
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
  const setAttended = useSetAttended();
  return (plan) =>
    planActions(plan, {
      agent: ownerAgent(plan.owner, queryClient.getQueryData<AgentRecord[]>(AGENTS_QUERY_KEY)),
      started: hasStarted(plan, new Date()),
      now: new Date(),
      setAttended: (target, attended) => setAttended(target, attended),
      message: (agentId) => {
        openAgent(agentId);
        requestCompose(`I want to talk about "${plan.title}"`);
      },
      tell: (agentId, text) => {
        openAgent(agentId);
        requestCompose(text);
      },
      join: (url) => void openExternal(url).catch((error: unknown) => pushToast({ key: "planner:join", tone: "error", title: "Couldn’t open the call", body: error instanceof Error ? error.message : String(error) })),
      copyLink: (url) => void copyText(url).then(() => pushToast({ key: "planner:copy-link", tone: "info", title: "Link copied" }), (error: unknown) => pushToast({ key: "planner:copy-link", tone: "error", title: "Couldn’t copy the link", body: error instanceof Error ? error.message : String(error) })),
      showInYaad: (id) => navigate(`/yaad?focus=${id}`),
      details: details === undefined ? undefined : () => details(plan),
    });
}

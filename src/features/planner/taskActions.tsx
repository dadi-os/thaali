import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, IconButton } from "../../shared/ui/Button";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import type { Action, ActionList } from "../../shared/interaction/actions";
import { openAgent } from "../../contexts/chat";
import { requestCompose } from "../../contexts/reply";
import type { AgentRecord } from "../../types/hath";
import type { Task } from "../../types/planner";

/** What a message is about and who keeps it: a task, or a plan. */
export type Keepable = Pick<Task, "owner" | "title">;
import { ownerAgent } from "./plans";

/** What {@link taskActions} needs from the app. */
export type TaskActionDeps = {
  /** The agent that keeps the task; null for a source (`manual`, `ingest`) or an agent that no longer runs. */
  agent: AgentRecord | null;
  /** Tick the task or take the tick back. */
  tick: (task: Task, done: boolean) => void;
  /** Open the conversation with an agent, with the words Ankur means to say already in the composer. */
  message: (agentId: string, about: string) => void;
};

/** What a person can do with a task: tick it or take the tick back, and message the agent that keeps it. Nothing edits the task. */
export function taskActions(task: Task, { agent, tick, message }: TaskActionDeps): ActionList {
  const list: Array<Action | "separator"> = [{ id: "tick", label: task.done ? "Take back done" : "Mark done", icon: task.done ? "retry" : "check", run: () => tick(task, !task.done) }];
  if (agent !== null) {
    list.push({ id: "message", label: "Message agent", detail: `Message ${agent.name}`, icon: "send", run: () => message(agent.id, task.title) });
  }
  return list;
}

/** The task actions of the running app, reading the agent from Hath's cached agents when a menu opens. */
export function useTaskActions(tick: TaskActionDeps["tick"]): (task: Task) => ActionList {
  const queryClient = useQueryClient();
  return (task) =>
    taskActions(task, {
      agent: ownerAgent(task.owner, queryClient.getQueryData<AgentRecord[]>(AGENTS_QUERY_KEY)),
      tick,
      message: (agentId, about) => {
        openAgent(agentId);
        requestCompose(`I want to talk about "${about}"`);
      },
    });
}

export type MessageAgentProps = {
  /** The task or plan, whose title the message is about. */
  task: Keepable;
  /** Draw the button as the send icon alone, for a row with little room. */
  iconOnly?: boolean;
};

/** A quiet "Message agent" button for a task row; nothing renders when no agent keeps the task. */
export function MessageAgent({ task, iconOnly = false }: MessageAgentProps) {
  const agents = useQuery<AgentRecord[]>({ queryKey: AGENTS_QUERY_KEY, queryFn: skipToken });
  const agent = ownerAgent(task.owner, agents.data);
  if (agent === null) {
    return null;
  }
  const message = () => {
    openAgent(agent.id);
    requestCompose(`I want to talk about "${task.title}"`);
  };
  return iconOnly ? (
    <IconButton icon="send" label={`Message ${agent.name}`} size={28} iconSize={14} onClick={message} />
  ) : (
    <Button tone="quiet" size="sm" icon="send" title={`Message ${agent.name}`} onClick={message}>
      Message agent
    </Button>
  );
}

/** The active agent that keeps something, read from Hath's cached agents; null for a source or an agent that no longer runs. */
export function useOwnerAgent(owner: string): AgentRecord | null {
  const agents = useQuery<AgentRecord[]>({ queryKey: AGENTS_QUERY_KEY, queryFn: skipToken });
  return ownerAgent(owner, agents.data);
}

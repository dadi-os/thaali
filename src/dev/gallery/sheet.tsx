import * as hath from "../fixtures/hath";
import { nasTasks } from "../fixtures/tasks";
import { AgentSheetPanel, type StopState } from "../../features/agents/sheet/Panel";
import { standingOf } from "../../features/agents/sheet/brief";
import type { Scenario } from "../scenario";
import { CASES } from "./cases";

/** The agent sheet's cases: the popover's content for an agent of the fixtures; its wakes are read from the fixture transport. */

const noop = () => undefined;
const resolved = () => Promise.resolve();
const idle = { pending: false, result: null, error: null };

type SheetCase = {
  scenario: Scenario;
  agentId: string;
  /** How the Stop control stands. */
  stop?: StopState;
};

/** The sheet of one fixture agent, as tall as the popover grows. */
function sheet({ scenario, agentId, stop = idle }: SheetCase) {
  const agent = hath.agents(scenario).find((candidate) => candidate.id === agentId);
  if (agent === undefined) {
    throw new Error(`no fixture agent ${agentId}`);
  }
  const nas = nasTasks(scenario);
  const tasks = agent.sessions.tasks.map((task) => {
    const live = nas.find((candidate) => candidate.task === task.id);
    if (live === undefined) {
      throw new Error(`no Nas task ${task.id}`);
    }
    return { task: { ...task, status: live.status }, question: live.state };
  });
  return (
    <div style={{ display: "flex", width: 440, height: 620 }}>
      <AgentSheetPanel
        agent={agent}
        tasks={tasks}
        onHaltTask={resolved}
        standing={standingOf(hath.messages(scenario, agentId), [])}
        live={agent.running.working ? { wakeId: "live", counts: { tool_calls: 7, messages_sent: 0, messages_received: 1 } } : undefined}
        stop={stop}
        onStop={noop}
        routines={{ kind: "ready", items: hath.routines(agentId) }}
        onCancelRoutine={resolved}
        onCancelReminder={resolved}
        parent={hath.agents(scenario).find((candidate) => candidate.id === agent.parent_agent_id && candidate.active) ?? null}
        onSelectAgent={noop}
        nameOf={(id) => id ?? "Ankur"}
        connected
        onOpenThread={noop}
        now={Date.now()}
      />
    </div>
  );
}

CASES["agent.sheet.working"] = () => sheet({ scenario: "normal", agentId: "finance-specialist" });
CASES["agent.sheet.waiting"] = () => sheet({ scenario: "asking", agentId: "networking-specialist" });
CASES["agent.sheet.overdue"] = () => sheet({ scenario: "normal", agentId: "coding-manager" });
CASES["agent.sheet.stopped"] = () => sheet({ scenario: "normal", agentId: "efficiency-specialist" });
CASES["agent.sheet.needs-input"] = () => sheet({ scenario: "normal", agentId: "health-specialist" });
CASES["agent.sheet.blocked"] = () => sheet({ scenario: "normal", agentId: "cse-300-specialist" });
CASES["agent.sheet.idle"] = () => sheet({ scenario: "normal", agentId: "career-manager" });

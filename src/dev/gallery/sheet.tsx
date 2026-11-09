import * as hath from "../fixtures/hath";
import { nasTasks } from "../fixtures/tasks";
import { AgentSheetPanel } from "../../features/agents/sheet/Panel";
import type { Scenario } from "../scenario";
import { CASES } from "./cases";

/** The agent sheet's cases: the popover's content for an agent of the fixtures; its wakes are read from the fixture transport. */

const noop = () => undefined;
const resolved = () => Promise.resolve();

type SheetCase = {
  scenario: Scenario;
  agentId: string;
};

/** The sheet of one fixture agent, as tall as the popover grows. */
function sheet({ scenario, agentId }: SheetCase) {
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
        unread={2}
        tasks={tasks}
        onHaltTask={resolved}
        schedules={{ kind: "ready", items: hath.schedules(agentId) }}
        onSaveSchedule={resolved}
        onCancelSchedule={resolved}
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
CASES["agent.sheet.idle"] = () => sheet({ scenario: "normal", agentId: "career-manager" });

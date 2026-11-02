import * as hath from "../fixtures/hath";
import { nasTasks } from "../fixtures/tasks";
import { AgentSheetPanel, type SheetSection } from "../../features/agents/sheet/Panel";
import { autoLiveTaskId } from "../../features/agents/sessions";
import { sheetWakes } from "../../features/agents/sheet/wakes";
import type { Scenario } from "../scenario";
import { CASES, previewOf } from "./cases";

/** The agent sheet's cases: the docked card for an agent of the fixtures in the states of the design's Hath boards. */

const noop = () => undefined;

type SheetCase = {
  scenario: Scenario;
  agentId: string;
  /** The sections drawn open. */
  open?: SheetSection[];
};

/** The sheet of one fixture agent, as tall as the page's content area at 1440 x 900 so the card stretches the way it does there. */
function sheet({ scenario, agentId, open = [] }: SheetCase) {
  const agent = hath.agents(scenario).find((candidate) => candidate.id === agentId);
  if (agent === undefined) {
    throw new Error(`no fixture agent ${agentId}`);
  }
  const nas = nasTasks(scenario);
  const autoId = autoLiveTaskId(agent.sessions.tasks);
  const tasks = agent.sessions.tasks.map((task) => {
    const live = nas.find((candidate) => candidate.task === task.id);
    if (live === undefined) {
      throw new Error(`no Nas task ${task.id}`);
    }
    return { task: { ...task, status: live.status }, question: live.state, preview: previewOf(live, task, { paused: live.status === "paused" }) };
  });
  return (
    <div style={{ display: "flex", width: 400, height: 822 }}>
      <AgentSheetPanel
        agent={agent}
        tasks={tasks}
        schedules={{ kind: "ready", items: hath.schedules(agentId) }}
        wakes={{ kind: "ready", items: sheetWakes(hath.agentLogs(agentId)) }}
        isOpen={(section) => open.includes(section)}
        onToggle={noop}
        isTaskOpen={(id) => id === autoId}
        onToggleTask={noop}
        onOpenThread={noop}
        now={Date.now()}
      />
    </div>
  );
}

CASES["agent.sheet.working"] = () => sheet({ scenario: "normal", agentId: "finance-specialist" });
CASES["agent.sheet.open"] = () => sheet({ scenario: "normal", agentId: "finance-specialist", open: ["calls", "charter", "activity"] });
CASES["agent.sheet.waiting"] = () => sheet({ scenario: "asking", agentId: "networking-specialist" });
CASES["agent.sheet.toggle"] = CASES["agent.sheet.working"];
CASES["agent.sheet.idle"] = () => sheet({ scenario: "normal", agentId: "career-manager" });

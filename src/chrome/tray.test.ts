import { describe, expect, it } from "vitest";
import { agentsStatusText, workingAgents, type TrayAgent, type TraySnapshot } from "./tray";

const agent = (id: string, work: boolean, process: boolean): TrayAgent => ({ id, name: id, active: true, running: { work, process } });
const snapshot = (agents: TraySnapshot["agents"], meshConnected = true): TraySnapshot => ({ meshConnected, updateInstalling: false, unread: false, agents });

describe("the Agents menu", () => {
  it("lists the agents with a lane running and no others", () => {
    const all = [agent("a", true, false), agent("b", false, false), agent("c", false, true), agent("d", true, true)];
    expect(workingAgents(all).map((a) => a.id)).toEqual(["a", "c", "d"]);
  });

  it("says how many are working, or that none are", () => {
    expect(agentsStatusText(snapshot({ status: "ready", items: [agent("a", true, false), agent("b", false, false)] }))).toBe("1 working");
    expect(agentsStatusText(snapshot({ status: "ready", items: [agent("b", false, false)] }))).toBe("Nothing working");
  });

  it("says why it cannot list agents while the mesh is out of reach or the list failed", () => {
    expect(agentsStatusText(snapshot({ status: "pending" }, false))).toBe("Connect to list agents");
    expect(agentsStatusText(snapshot({ status: "error" }))).toBe("Agents unavailable");
  });
});

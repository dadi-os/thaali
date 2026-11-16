import { describe, expect, it } from "vitest";
import { agentsStatusText, workingAgents, type TrayAgent, type TraySnapshot } from "./tray";

const agent = (id: string, working: boolean): TrayAgent => ({ id, name: id, active: true, running: { working } });
const snapshot = (agents: TraySnapshot["agents"], meshConnected = true): TraySnapshot => ({ meshConnected, updateInstalling: false, unread: false, agents });

describe("the Agents menu", () => {
  it("lists the agents whose loop is running and no others", () => {
    const all = [agent("a", true), agent("b", false), agent("c", true)];
    expect(workingAgents(all).map((a) => a.id)).toEqual(["a", "c"]);
  });

  it("says how many are working, or that none are", () => {
    expect(agentsStatusText(snapshot({ status: "ready", items: [agent("a", true), agent("b", false)] }))).toBe("1 working");
    expect(agentsStatusText(snapshot({ status: "ready", items: [agent("b", false)] }))).toBe("Nothing working");
  });

  it("says why it cannot list agents while the mesh is out of reach or the list failed", () => {
    expect(agentsStatusText(snapshot({ status: "pending" }, false))).toBe("Connect to list agents");
    expect(agentsStatusText(snapshot({ status: "error" }))).toBe("Agents unavailable");
  });
});

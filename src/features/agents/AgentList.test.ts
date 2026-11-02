import { describe, expect, it } from "vitest";
import { agents } from "../../dev/fixtures/hath";
import type { AgentRecord } from "../../types/hath";
import { agentRows } from "./AgentList";

const record = (id: string, parent: string | null): AgentRecord => ({ ...agents("normal")[0]!, id, name: id, parent_agent_id: parent });

describe("agentRows", () => {
  it("lists each agent under its parent, with its depth, in the order the list gave them", () => {
    const rows = agentRows([record("career-manager", null), record("project-manager", null), record("resume-specialist", "career-manager"), record("chello-manager", "project-manager"), record("cover-worker", "resume-specialist")]);
    expect(rows.map(({ agent, depth }) => [agent.id, depth])).toEqual([
      ["career-manager", 0],
      ["resume-specialist", 1],
      ["cover-worker", 2],
      ["project-manager", 0],
      ["chello-manager", 1],
    ]);
  });

  it("makes an agent whose parent is not in the list a root", () => {
    const rows = agentRows([record("orphan-specialist", "retired-manager")]);
    expect(rows).toEqual([{ agent: expect.objectContaining({ id: "orphan-specialist" }), depth: 0 }]);
  });

  it("lists every agent once", () => {
    const all = agents("many").filter((agent) => agent.active);
    expect(new Set(agentRows(all).map(({ agent }) => agent.id)).size).toBe(all.length);
  });
});

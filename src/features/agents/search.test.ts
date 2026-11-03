import { describe, expect, it } from "vitest";
import type { AgentRecord } from "../../types/hath";
import { agentsMatching, pickedMatch } from "./search";

const agent = (id: string) => ({ id, name: id }) as AgentRecord;
const agents = ["career-manager", "networking-specialist", "career-specialist", "finance-specialist"].map(agent);

describe("agentsMatching", () => {
  it("narrows nothing for an empty query and matches by part of the name, ignoring case", () => {
    expect(agentsMatching(agents, "  ")).toBeNull();
    expect(agentsMatching(agents, "CAREER")?.map((a) => a.id)).toEqual(["career-manager", "career-specialist"]);
    expect(agentsMatching(agents, "zzz")).toEqual([]);
  });
});

describe("pickedMatch", () => {
  it("picks the lone match or the exact name, and leaves several open", () => {
    expect(pickedMatch(agentsMatching(agents, "finance"), "finance")?.id).toBe("finance-specialist");
    expect(pickedMatch(agentsMatching(agents, "career-manager"), "career-manager")?.id).toBe("career-manager");
    expect(pickedMatch(agentsMatching(agents, "career"), "career")).toBeNull();
    expect(pickedMatch(null, "")).toBeNull();
  });
});

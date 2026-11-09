import { describe, expect, it } from "vitest";
import { agentLogs } from "../../../dev/fixtures/hath";
import { buildActivity, thoughtGist } from "./activity";

describe("buildActivity over the fixture logs", () => {
  const wakes = buildActivity(agentLogs("finance-specialist"));

  it("groups rows by wake, newest first", () => {
    expect(wakes).toHaveLength(8);
    expect(Date.parse(wakes[0]!.startedAt)).toBeGreaterThan(Date.parse(wakes[1]!.startedAt));
  });

  it("pairs tool calls with their results, counts failures and hides yield", () => {
    const newest = wakes[0]!;
    expect(newest.errorCount).toBe(1);
    expect(newest.toolCount).toBe(11);
    const tools = newest.steps.flatMap((step) => (step.kind === "turn" ? step.parts.flatMap((part) => (part.kind === "tool" ? [part.tool] : [])) : []));
    expect(tools.find((tool) => tool.name === "search_files")?.result?.isError).toBe(true);
    expect(tools.some((tool) => tool.name === "yield")).toBe(false);
  });

  it("marks the runtime's report as a stopped wake and a delivered message as scheduled", () => {
    const messages = wakes.flatMap((wake) => wake.steps.flatMap((step) => (step.kind === "message" ? [step] : [])));
    expect(messages.some((step) => step.wakeStopped)).toBe(true);
    expect(messages.some((step) => step.scheduled && step.direction === "receive")).toBe(true);
  });
});

describe("thoughtGist", () => {
  it("takes the bold heading, else the first line", () => {
    expect(thoughtGist("**Find it**\nbody")).toBe("Find it");
    expect(thoughtGist("First line\nsecond")).toBe("First line");
  });
});

// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { FixtureTransport } from "../../dev/fixtureTransport";
import { createHathClient } from "../../shared/api/hath";
import { ASK_TTL_MS, cleanTitle, createAskGuard, scheduleMessage, sendScheduleAsk } from "./somedayAsk";

const FRI = new Date(2026, 10, 27);

describe("scheduleMessage", () => {
  it("quotes the title and names the day in the app's words", () => {
    expect(scheduleMessage("Organize the garage", FRI)).toBe('Please schedule "Organize the garage" for Fri, Nov 27.');
  });
  it("keeps a title to one plain line with no nested double quotes", () => {
    expect(cleanTitle('Fix the "front" door\nand the  gate')).toBe("Fix the 'front' door and the gate");
  });
  it("cuts a very long title", () => {
    const cut = cleanTitle("word ".repeat(100));
    expect(cut.length).toBeLessThanOrEqual(160);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("createAskGuard", () => {
  it("lets one drop send once and refuses the same task and day while it waits", () => {
    const guard = createAskGuard();
    expect(guard.begin("t1", "2026-11-27", 0)).toBe(true);
    expect(guard.begin("t1", "2026-11-27", 10)).toBe(false);
    expect(guard.pendingDay("t1", 10)).toBe("2026-11-27");
  });
  it("lets another day, or another task, through", () => {
    const guard = createAskGuard();
    guard.begin("t1", "2026-11-27", 0);
    expect(guard.begin("t1", "2026-11-28", 1)).toBe(true);
    expect(guard.begin("t2", "2026-11-27", 1)).toBe(true);
  });
  it("lets a failed ask try again, and a stale one too", () => {
    const guard = createAskGuard();
    guard.begin("t1", "2026-11-27", 0);
    guard.release("t1", "2026-11-27");
    expect(guard.begin("t1", "2026-11-27", 1)).toBe(true);
    expect(guard.pendingDay("t1", ASK_TTL_MS + 2)).toBeNull();
    expect(guard.begin("t1", "2026-11-27", ASK_TTL_MS + 2)).toBe(true);
  });
});

describe("sendScheduleAsk", () => {
  it("posts one message to the owner agent through the fixture transport", async () => {
    const transport = new FixtureTransport("normal");
    await transport.connect();
    const posted: unknown[] = [];
    const request = transport.request.bind(transport);
    transport.request = (async (opts: Parameters<typeof request>[0]) => {
      if (opts.method === "POST" && opts.path === "/messages") posted.push(opts.body);
      return request(opts);
    }) as typeof transport.request;
    const { content, stored } = await sendScheduleAsk(createHathClient(transport, "http://hath.dadi"), "schedule-specialist", "Plan a weekend trip to Detroit", FRI);
    expect(posted).toEqual([{ to_agent_id: "schedule-specialist", content: 'Please schedule "Plan a weekend trip to Detroit" for Fri, Nov 27.' }]);
    expect(stored.content).toBe(content);
  });
});

import { describe, expect, it } from "vitest";
import { liveAllowed } from "./liveAllow";

describe("live mode never writes", () => {
  it("allows every GET and Yaad's read-only POSTs", () => {
    expect(liveAllowed("hath", "GET", "/agents")).toBe(true);
    expect(liveAllowed("yaad", "GET", "/counts")).toBe(true);
    for (const path of ["/planner/plans", "/planner/tasks", "/query", "/graph", "/recall", "/history/search"]) {
      expect(liveAllowed("yaad", "POST", path)).toBe(true);
    }
  });

  it("refuses every write: PUT, PATCH, DELETE and any other POST, on either service", () => {
    expect(liveAllowed("yaad", "PUT", "/planner/tasks/done")).toBe(false);
    expect(liveAllowed("yaad", "PUT", "/planner/plans/attended")).toBe(false);
    expect(liveAllowed("yaad", "PATCH", "/nodes/x")).toBe(false);
    expect(liveAllowed("yaad", "DELETE", "/nodes/x")).toBe(false);
    expect(liveAllowed("yaad", "POST", "/ingest")).toBe(false);
    expect(liveAllowed("hath", "POST", "/agents/a/read")).toBe(false);
    expect(liveAllowed("hath", "POST", "/messages")).toBe(false);
    expect(liveAllowed("hath", "POST", "/planner/plans")).toBe(false);
  });
});

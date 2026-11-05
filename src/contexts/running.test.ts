import { describe, expect, it } from "vitest";
import {
  clearRouterRuns,
  endRouterRun,
  hasLocalSend,
  isRouting,
  seedRouterRuns,
  setLocalSend,
  startRouterRun,
} from "./running";

describe("router runs", () => {
  it("stays routing until every overlapping run has ended", () => {
    clearRouterRuns();
    startRouterRun("a");
    startRouterRun("b");
    endRouterRun("a");
    expect(isRouting()).toBe(true);
    endRouterRun("b");
    expect(isRouting()).toBe(false);
  });

  it("ignores the end of a run it never heard start", () => {
    clearRouterRuns();
    endRouterRun("unknown");
    expect(isRouting()).toBe(false);
  });

  it("takes Hath's list as the runs in flight when a device connects mid-run", () => {
    clearRouterRuns();
    seedRouterRuns(["a", "b"]);
    expect(isRouting()).toBe(true);
    seedRouterRuns([]);
    expect(isRouting()).toBe(false);
  });

  it("counts this device's own send as routing until it answers", () => {
    clearRouterRuns();
    setLocalSend(true);
    expect(isRouting()).toBe(true);
    expect(hasLocalSend()).toBe(true);
    setLocalSend(false);
    expect(isRouting()).toBe(false);
    expect(hasLocalSend()).toBe(false);
  });

  it("forgets every run when the mesh goes away", () => {
    startRouterRun("a");
    clearRouterRuns();
    expect(isRouting()).toBe(false);
  });
});

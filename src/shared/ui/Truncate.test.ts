import { describe, expect, it } from "vitest";
import { splitRole } from "./Truncate";

describe("splitRole", () => {
  it("keeps the role and any trailing id together", () => {
    expect(splitRole("networking-specialist")).toEqual({ head: "networking", tail: "-specialist" });
    expect(splitRole("browser-worker-ibio-150-quiz-2")).toEqual({ head: "browser", tail: "-worker-ibio-150-quiz-2" });
    expect(splitRole("application-manager-archive-1010")).toEqual({ head: "application", tail: "-manager-archive-1010" });
  });

  it("keeps the last six characters of a name with no role", () => {
    expect(splitRole("dadi-orchestrator")).toEqual({ head: "dadi-orches", tail: "trator" });
  });

  it("never cuts a short name", () => {
    expect(splitRole("dadi")).toEqual({ head: "", tail: "dadi" });
  });
});

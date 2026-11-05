import { describe, expect, it } from "vitest";
import { failureMessage, onboardingStage, type OnboardingInputs } from "./stage";

const base: OnboardingInputs = {
  boot: { status: "ready" },
  needsProvisioning: false,
  connection: "disconnected",
  setupView: "intro",
  joining: false,
  connecting: false,
  failure: null,
};

describe("onboardingStage", () => {
  it("breathes while launch reads the setup code and fails loudly when it cannot", () => {
    expect(onboardingStage({ ...base, boot: { status: "pending" }, needsProvisioning: true })).toBe("starting");
    const broken = { ...base, boot: { status: "failed" as const, error: "parse credentials: bad json" } };
    expect(onboardingStage(broken)).toBe("failed");
    expect(failureMessage(broken)).toBe("parse credentials: bad json");
  });

  it("walks first run from the intro to the card and into connecting while a new code joins", () => {
    const first = { ...base, needsProvisioning: true };
    expect(onboardingStage(first)).toBe("intro");
    expect(onboardingStage({ ...first, setupView: "paste" })).toBe("paste");
    expect(onboardingStage({ ...first, setupView: "scan", joining: true, connection: "connecting" })).toBe("connecting");
  });

  it("keeps a failed first-run join on the card rather than Can't reach dadi", () => {
    expect(onboardingStage({ ...base, needsProvisioning: true, setupView: "paste", failure: "stale" })).toBe("paste");
  });

  it("offers one tap when provisioned, connecting while it joins, and the failure after", () => {
    expect(onboardingStage(base)).toBe("ready");
    expect(onboardingStage({ ...base, connecting: true })).toBe("connecting");
    expect(onboardingStage({ ...base, connection: "connecting" })).toBe("connecting");
    const failed = { ...base, failure: "dadi did not accept this setup code (You are logged out)." };
    expect(onboardingStage(failed)).toBe("failed");
    expect(failureMessage(failed)).toMatch(/did not accept/);
  });
});

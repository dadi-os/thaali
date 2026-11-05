import type { ConnectionState } from "../../shared/api/transport";

/** Launch's read of the saved setup code: still reading, done, or failed with its reason. */
export type BootState = { status: "pending" } | { status: "ready" } | { status: "failed"; error: string };

/** Where first run and the way back to dadi are. */
export type OnboardingStage =
  /** Reading the saved setup code at launch: the wordmark breathes. */
  | "starting"
  /** No setup code yet: the wordmark resolves alone before the paste card. */
  | "intro"
  | "paste"
  | "scan"
  /** Joining, with a new setup code or the saved one: the wordmark breathes. */
  | "connecting"
  /** Provisioned and off dadi: one tap joins. */
  | "ready"
  /** The saved code could not be read or the join failed: Can't reach dadi. */
  | "failed";

/** What decides the stage. */
export type OnboardingInputs = {
  boot: BootState;
  needsProvisioning: boolean;
  connection: ConnectionState;
  /** Which first-run view is up while no setup code is saved. */
  setupView: "intro" | "paste" | "scan";
  /** A join with a new setup code is in flight. */
  joining: boolean;
  /** A join with the saved code was asked for and has not settled. */
  connecting: boolean;
  /** Why the last join with the saved code failed, or null. */
  failure: string | null;
};

/**
 * onboardingStage picks the screen: launch first, then first run (where a failed join goes
 * back to the paste card, since only a new code helps), then the saved code's join.
 */
export function onboardingStage(input: OnboardingInputs): OnboardingStage {
  if (input.boot.status === "pending") {
    return "starting";
  }
  if (input.boot.status === "failed") {
    return "failed";
  }
  if (input.needsProvisioning) {
    return input.joining ? "connecting" : input.setupView;
  }
  if (input.connecting || input.connection === "connecting") {
    return "connecting";
  }
  return input.failure ? "failed" : "ready";
}

/** Why the Can't reach dadi card is up: the boot's error first, then the join's. */
export function failureMessage(input: Pick<OnboardingInputs, "boot" | "failure">): string | null {
  return input.boot.status === "failed" ? input.boot.error : input.failure;
}

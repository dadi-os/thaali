import { describe, expect, it } from "vitest";
import { cameraFailureMessage } from "./QrScanner";

describe("cameraFailureMessage", () => {
  it("distinguishes permission, missing camera, and in-use failures", () => {
    expect(cameraFailureMessage(new DOMException("denied", "NotAllowedError"))).toMatch(
      /permission denied/i,
    );
    expect(
      cameraFailureMessage(new DOMException("overconstrained", "OverconstrainedError")),
    ).toMatch(/No camera matched/);
    expect(
      cameraFailureMessage(new DOMException("busy", "NotReadableError")),
    ).toMatch(/in use/);
  });
});

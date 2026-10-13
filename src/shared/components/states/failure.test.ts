import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/errors";
import { failureFacts } from "./failure";

describe("failureFacts", () => {
  it("names the service, status and request a service failure came from", () => {
    const err = new ApiError("HTTP 502 GET http://hath.dadi/agents: bad gateway", "http://hath.dadi", "3f2a9c1e-77aa-4b1c-9d0e-123456789abc", 502);
    expect(failureFacts(err)).toEqual({
      message: "HTTP 502 GET http://hath.dadi/agents: bad gateway",
      origin: "hath · HTTP 502 · request 3f2a9c1e",
    });
  });

  it("keeps a plain error's own message and no origin", () => {
    expect(failureFacts(new TypeError("Load failed"))).toEqual({ message: "Load failed", origin: null });
  });

  it("shows a thrown non-Error value as itself", () => {
    expect(failureFacts("vault locked")).toEqual({ message: "vault locked", origin: null });
  });
});

import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/errors";
import { failureFacts } from "./failure";

const REQUEST = "3f2a9c1e-77aa-4b1c-9d0e-123456789abc";

describe("failureFacts", () => {
  it("names the service, status and request a service failure came from", () => {
    const err = new ApiError("HTTP 502 GET http://hath.dadi/agents: bad gateway", "http://hath.dadi", REQUEST, 502);
    expect(failureFacts(err)).toEqual({
      message: "HTTP 502 GET http://hath.dadi/agents: bad gateway",
      raw: "HTTP 502 GET http://hath.dadi/agents: bad gateway",
      origin: "hath · HTTP 502 · request 3f2a9c1e",
    });
  });

  it("leads with the service's own message from its error body", () => {
    const raw = 'HTTP 409 POST http://ghar.dadi/devices/a/command: {"error":{"type":"device_offline","message":"Lamp \\"desk\\" is offline"}}';
    const facts = failureFacts(new ApiError(raw, "http://ghar.dadi", REQUEST, 409));
    expect(facts.message).toBe('Lamp "desk" is offline');
    expect(facts.raw).toBe(raw);
    expect(facts.origin).toBe("ghar · HTTP 409 · request 3f2a9c1e");
  });

  it("keeps a plain error's own message and no origin", () => {
    expect(failureFacts(new TypeError("Load failed"))).toEqual({ message: "Load failed", raw: "Load failed", origin: null });
  });

  it("shows a thrown non-Error value as itself", () => {
    expect(failureFacts("vault locked").message).toBe("vault locked");
  });
});

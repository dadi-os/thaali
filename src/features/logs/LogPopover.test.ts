import { describe, expect, it } from "vitest";
import { logDetail } from "./LogPopover";

describe("logDetail", () => {
  it("flattens nested fields and skips keys the row already shows", () => {
    const raw = JSON.stringify({
      time: "2026-09-29T12:00:00Z",
      level: "info",
      msg: "turn done",
      service: "hath",
      v: 1,
      agentId: "a1",
      req: { method: "POST", url: "/dadi", headers: { host: "nas" } },
      tags: ["x", "y"],
    });
    const { fields, stack, pretty } = logDetail(raw);
    expect(fields).toEqual([
      { key: "agentId", value: "a1" },
      { key: "req.method", value: "POST" },
      { key: "req.url", value: "/dadi" },
      { key: "req.headers.host", value: "nas" },
      { key: "tags", value: '["x","y"]' },
    ]);
    expect(stack).toBeNull();
    expect(pretty).toContain('"agentId": "a1"');
  });

  it("pulls the error stack out of the fields", () => {
    const raw = JSON.stringify({
      msg: "lane failed",
      err: { type: "Error", message: "boom", stack: "Error: boom\n    at run (x.ts:1)" },
    });
    const { fields, stack } = logDetail(raw);
    expect(stack).toBe("Error: boom\n    at run (x.ts:1)");
    expect(fields).toEqual([
      { key: "err.type", value: "Error" },
      { key: "err.message", value: "boom" },
    ]);
  });

  it("keeps non-JSON raw text as-is", () => {
    expect(logDetail("plain text line")).toEqual({ fields: [], stack: null, pretty: "plain text line" });
    expect(logDetail(undefined)).toEqual({ fields: [], stack: null, pretty: null });
  });
});

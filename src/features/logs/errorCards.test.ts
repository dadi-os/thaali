import { describe, expect, it } from "vitest";
import type { NasLogEntry } from "../../shared/api/nas";
import { errorCard, errorFocus, humanizeProviderBlob } from "./errorCards";

function line(msg: string, raw: object | string | undefined): NasLogEntry {
  return { time: "2026-10-28T14:38:40.000Z", service: "dwar", level: "error", msg, raw: typeof raw === "object" ? JSON.stringify(raw) : raw };
}

describe("humanizeProviderBlob", () => {
  it("takes the innermost message and the status code from a provider dump", () => {
    const blob = "Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'Your credit balance is too low'}}";
    expect(humanizeProviderBlob(blob)).toEqual({ message: "Your credit balance is too low", code: 400 });
  });

  it("strips the code prefix when the blob holds no message field", () => {
    expect(humanizeProviderBlob("Error code: 529 - overloaded")).toEqual({ message: "overloaded", code: 529 });
  });

  it("returns the text and no code for a plain sentence", () => {
    expect(humanizeProviderBlob("connection refused")).toEqual({ message: "connection refused", code: null });
  });
});

describe("errorCard", () => {
  it("shows the provider's cause as the title and the line's message as its context", () => {
    const card = errorCard(line("lane_failed: dwar returned 529", { err: { message: "Error code: 529 - {'error': {'message': 'Overloaded'}}" }, request_id: "req-1", method: "POST", path: "/wake", status: 529, duration_ms: 4210 }));
    expect(card).toMatchObject({ title: "Overloaded", context: "lane_failed: dwar returned 529", code: 529, request: "POST /wake · 529 · 4210 ms", q: "req-1" });
  });

  it("uses the message as the title, with no context, when the line carries no cause", () => {
    const card = errorCard(line("helper task closed", { request_id: "req-2" }));
    expect(card).toMatchObject({ title: "helper task closed", context: null, code: null, request: null });
  });

  it("uses the message as the title when the cause only repeats it", () => {
    const card = errorCard(line("disk full", { error: "disk full" }));
    expect(card).toMatchObject({ title: "disk full", context: null });
  });

  it("reads a line whose raw text is not JSON, searching by its message", () => {
    const card = errorCard(line("panic: boom", "panic: boom at main.go:12"));
    expect(card).toMatchObject({ title: "panic: boom", request: null, q: "panic: boom" });
  });

  it("omits the duration when the request logged none", () => {
    expect(errorCard(line("x", { method: "GET", path: "/a", status: 500 })).request).toBe("GET /a · 500");
  });
});

describe("errorFocus", () => {
  it("points the logs at the card's service, text and time", () => {
    const card = errorCard(line("lane_failed", { request_id: "req-1" }));
    expect(errorFocus(card, "k1")).toEqual({ service: "dwar", q: "req-1", at: "2026-10-28T14:38:40.000Z", key: "k1" });
  });
});

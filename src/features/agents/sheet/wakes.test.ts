import { describe, expect, it } from "vitest";
import type { LogRecord } from "../../../types/hath";
import { sheetWakes } from "./wakes";

/** A log row; `content` is what a model response carries. */
function row(id: string, wake: string | null | undefined, at: string, event: LogRecord["event"], content: unknown[] = []): LogRecord {
  return { id, agent_id: "finance-specialist", lane: "work", event, payload: { content }, wake_id: wake, created_at: at };
}

describe("sheetWakes", () => {
  it("groups rows by wake, counts tool calls, keeps the first text, and lists the newest wake first", () => {
    const logs = [
      row("3", "b", "2026-10-28T14:00:00Z", "response", [{ type: "text", text: "Checking the charges." }, { type: "tool_use" }]),
      row("1", "a", "2026-10-28T09:00:00Z", "response", [{ type: "tool_use" }, { type: "tool_use" }, { type: "text", text: "Done." }]),
      row("2", "a", "2026-10-28T09:01:00Z", "tool_result"),
      row("4", "b", "2026-10-28T14:01:00Z", "response", [{ type: "text", text: "Second thought." }, { type: "tool_use" }]),
    ];
    expect(sheetWakes(logs)).toEqual([
      { at: "2026-10-28T14:00:00Z", tools: 2, text: "Checking the charges." },
      { at: "2026-10-28T09:00:00Z", tools: 2, text: "Done." },
    ]);
  });

  it("leaves out rows that no wake wrote", () => {
    expect(sheetWakes([row("1", null, "2026-10-28T09:00:00Z", "response", [{ type: "tool_use" }]), row("2", undefined, "2026-10-28T09:00:00Z", "response")])).toEqual([]);
  });
});

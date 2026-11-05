import { describe, expect, it } from "vitest";
import type { NasLogEntry } from "../../shared/api/nas";
import { isNoiseLog, keyEntries, nearestLog, prettyRaw, rangeFor, requestIdOf } from "./logLines";

const entry = (time: string, msg: string, raw?: string): NasLogEntry => ({ time, service: "hath", level: "info", msg, ...(raw === undefined ? {} : { raw }) });

describe("log lines", () => {
  it("leaves out access chatter and health probes but keeps real lines", () => {
    expect(isNoiseLog(entry("2026-10-28T10:00:00Z", "request completed"))).toBe(true);
    expect(isNoiseLog(entry("2026-10-28T10:00:00Z", "GET /health 200"))).toBe(true);
    expect(isNoiseLog(entry("2026-10-28T10:00:00Z", "probe", '{"method":"GET","path":"/health"}'))).toBe(true);
    expect(isNoiseLog(entry("2026-10-28T10:00:00Z", "wake finished"))).toBe(false);
  });

  it("keys repeats of one line apart", () => {
    const keys = keyEntries([entry("t", "x"), entry("t", "x"), entry("u", "x")]).map((line) => line.key);
    expect(new Set(keys).size).toBe(3);
  });

  it("finds the line nearest a moment", () => {
    const lines = keyEntries([entry("2026-10-28T10:00:00Z", "a"), entry("2026-10-28T10:10:00Z", "b"), entry("2026-10-28T10:20:00Z", "c")]);
    expect(nearestLog(lines, "2026-10-28T10:08:00Z")?.entry.msg).toBe("b");
    expect(nearestLog([], "2026-10-28T10:08:00Z")).toBeNull();
  });

  it("picks the smallest window that reaches a line", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    expect(rangeFor("2026-10-28T11:30:00Z", now)).toBe("1h");
    expect(rangeFor("2026-10-28T08:00:00Z", now)).toBe("6h");
    expect(rangeFor("2026-10-27T20:00:00Z", now)).toBe("24h");
  });

  it("reads a line's request id from its raw record and nowhere else", () => {
    expect(requestIdOf(entry("t", "x", '{"request_id":"req-9"}'))).toBe("req-9");
    expect(requestIdOf(entry("t", "x", '{"other":1}'))).toBeNull();
    expect(requestIdOf(entry("t", "x", "plain text"))).toBeNull();
    expect(requestIdOf(entry("t", "x"))).toBeNull();
  });

  it("lays JSON out one field to a line and leaves other text alone", () => {
    expect(prettyRaw('{"a":1}')).toBe('{\n "a": 1\n}');
    expect(prettyRaw("plain text line")).toBe("plain text line");
  });
});

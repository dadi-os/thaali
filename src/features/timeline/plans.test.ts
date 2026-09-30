import { describe, expect, it } from "vitest";
import type { NodeRecord, PlanDetail } from "../../shared/api/types";
import { formatUntil } from "./dates";
import { asPlan, memoriesOn, plansOn, spanOf } from "./plans";

function node(over: Partial<NodeRecord>): NodeRecord {
  return {
    id: "n",
    kind: "plan",
    title: "t",
    body: null,
    occurred_at: null,
    expires_at: null,
    access_count: 0,
    last_accessed_at: null,
    source: "ingest",
    agent_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function plan(id: string, start: Date, end: Date | null) {
  const detail: PlanDetail = {
    end_at: end ? end.toISOString() : null,
    status: "confirmed",
    recurrence: null,
    series_id: null,
  };
  return asPlan({ ...node({ id, occurred_at: start.toISOString() }), detail })!;
}

describe("asPlan", () => {
  it("passes other kinds through as null", () => {
    expect(asPlan({ ...node({ kind: "memory" }), detail: null })).toBeNull();
  });

  it("throws when a plan has no plan detail", () => {
    expect(() => asPlan({ ...node({ id: "p1" }), detail: null })).toThrow("p1");
  });
});

describe("plansOn", () => {
  it("lists a multi-day plan on every day it spans, earliest first", () => {
    const trip = plan("trip", new Date(2026, 9, 2, 18), new Date(2026, 9, 4, 12));
    const lunch = plan("lunch", new Date(2026, 9, 3, 13), null);
    const days = [2, 3, 4, 5].map((d) => plansOn([lunch, trip], new Date(2026, 9, d)).map((p) => p.id));
    expect(days).toEqual([["trip"], ["trip", "lunch"], ["trip"], []]);
  });

  it("treats a plan without an end as a moment at its start", () => {
    const at = new Date(2026, 9, 3, 13);
    expect(spanOf(plan("p", at, null))).toEqual({ start: at, end: at });
  });
});

describe("memoriesOn", () => {
  it("keeps only memories that happened on the day, skipping undated facts", () => {
    const lake = node({ id: "lake", kind: "memory", occurred_at: new Date(2026, 9, 3, 16).toISOString() });
    const fact = node({ id: "fact", kind: "memory", occurred_at: null });
    expect(memoriesOn([fact, lake], new Date(2026, 9, 3)).map((m) => m.id)).toEqual(["lake"]);
  });
});

describe("formatUntil", () => {
  const now = new Date(2026, 9, 3, 9, 0);

  it("counts minutes, then hours and minutes, within a day", () => {
    expect(formatUntil(now, new Date(2026, 9, 3, 9, 12))).toBe("in 12m");
    expect(formatUntil(now, new Date(2026, 9, 3, 11, 10))).toBe("in 2h 10m");
    expect(formatUntil(now, new Date(2026, 9, 3, 12, 0))).toBe("in 3h");
  });

  it("switches to calendar days a day or more out", () => {
    expect(formatUntil(now, new Date(2026, 9, 6, 8, 0))).toMatch(/3 days/);
  });
});

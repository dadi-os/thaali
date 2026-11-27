import { describe, expect, it } from "vitest";
import { dayDropKey, matchesQuery, neighbor, parseDayDrop, somedayDays, tileLabel, type Box } from "./somedayBoard";

const NOW = new Date(2026, 10, 27, 11, 0);

describe("somedayDays", () => {
  it("offers seven local days from today", () => {
    const days = somedayDays(NOW);
    expect(days).toHaveLength(7);
    expect(days[0]!.getDate()).toBe(27);
    expect(days[6]!.getDate()).toBe(3);
  });
});

describe("day drop keys", () => {
  it("round-trips a day and rejects other keys", () => {
    expect(parseDayDrop(dayDropKey(new Date(2026, 10, 28)))).toBe("2026-11-28");
    expect(parseDayDrop("folder:1")).toBeNull();
    expect(parseDayDrop("day:soon")).toBeNull();
  });
});

describe("tileLabel", () => {
  it("names today and tomorrow, then the weekday", () => {
    expect(tileLabel(new Date(2026, 10, 27), NOW).name).toBe("Today");
    expect(tileLabel(new Date(2026, 10, 28), NOW).name).toBe("Tomorrow");
    expect(tileLabel(new Date(2026, 10, 30), NOW).name).not.toBe("Tomorrow");
  });
});

describe("matchesQuery", () => {
  const task = { title: "Plan a weekend trip to Detroit", owner: "schedule-specialist" };
  it("matches every word in the title or keeper, ignoring case", () => {
    expect(matchesQuery(task, "")).toBe(true);
    expect(matchesQuery(task, "DETROIT trip")).toBe(true);
    expect(matchesQuery(task, "trip schedule")).toBe(true);
    expect(matchesQuery(task, "garage")).toBe(false);
  });
});

describe("neighbor", () => {
  const grid: Box[] = [0, 1, 2, 3, 4].map((i) => ({ left: (i % 3) * 100, top: Math.floor(i / 3) * 100, width: 80, height: 80 }));
  it("moves along the row and down the column", () => {
    expect(neighbor(grid, 0, "right")).toBe(1);
    expect(neighbor(grid, 0, "down")).toBe(3);
    expect(neighbor(grid, 4, "up")).toBe(1);
    expect(neighbor(grid, 4, "left")).toBe(3);
  });
  it("stops at an edge", () => {
    expect(neighbor(grid, 0, "left")).toBeNull();
    expect(neighbor(grid, 0, "up")).toBeNull();
    expect(neighbor(grid, 4, "right")).toBeNull();
  });
});

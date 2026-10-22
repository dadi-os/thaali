import { describe, expect, it } from "vitest";
import type { PlannerBlock } from "../../../types/planner";
import { axisRange, formatClockCompact, formatRange, formatSpan, gapsBetween, isSettled, nowAndNext, segmentsOn } from "./blocks";

const day = new Date(2026, 9, 21);
const at = (hour: number, minute = 0, dayOffset = 0) => new Date(2026, 9, 21 + dayOffset, hour, minute).toISOString();

function block(title: string, start: string, end: string, extra: Partial<PlannerBlock> = {}): PlannerBlock {
  return {
    id: title,
    start_at: start,
    end_at: end,
    title,
    note: null,
    kind: "study",
    icon: "pencil",
    fixed: true,
    overlap_ok: false,
    done_at: null,
    source: "schedule-specialist",
    ...extra,
  };
}

describe("planner segments", () => {
  it("clips a block that runs past midnight to the day and leaves blocks of other days out", () => {
    const blocks = [block("Late", at(23), at(1, 0, 1)), block("Tomorrow", at(9, 0, 1), at(10, 0, 1)), block("Early", at(6), at(7))];
    expect(segmentsOn(blocks, day).map((s) => [s.block.title, s.startMin, s.endMin])).toEqual([
      ["Early", 360, 420],
      ["Late", 1380, 1440],
    ]);
  });

  it("puts overlapping blocks in side-by-side lanes and lets later ones take the full width", () => {
    const blocks = [
      block("A", at(9), at(11), { overlap_ok: true }),
      block("B", at(10), at(12), { overlap_ok: true }),
      block("C", at(13), at(14)),
    ];
    expect(segmentsOn(blocks, day).map((s) => [s.block.title, s.lane, s.lanes])).toEqual([
      ["A", 0, 2],
      ["B", 1, 2],
      ["C", 0, 1],
    ]);
  });

  it("finds gaps of ten minutes or more and ignores shorter ones", () => {
    const segments = segmentsOn(
      [block("A", at(8), at(8, 30)), block("B", at(8, 35), at(9)), block("C", at(9, 30), at(10))],
      day,
    );
    expect(gapsBetween(segments)).toEqual([{ startMin: 540, endMin: 570 }]);
  });

  it("spans the axis around the blocks, with a default window when empty", () => {
    const segments = segmentsOn([block("A", at(6, 30), at(7)), block("B", at(21), at(22, 5))], day);
    expect(axisRange([segments])).toEqual({ from: 6, to: 23 });
    expect(axisRange([[]])).toEqual({ from: 7, to: 22 });
  });

  it("names the current and next block, and a gap has no current block", () => {
    const segments = segmentsOn([block("A", at(9), at(10)), block("B", at(10, 30), at(11))], day);
    expect(nowAndNext(segments, 570)?.current?.block.title).toBe("A");
    expect(nowAndNext(segments, 570)?.next?.block.title).toBe("B");
    const between = nowAndNext(segments, 615);
    expect(between.current).toBeNull();
    expect(between.next?.block.title).toBe("B");
    expect(nowAndNext(segments, 700)).toEqual({ current: null, next: null });
  });

  it("settles a block when it is marked done or has ended", () => {
    const now = new Date(2026, 9, 21, 12);
    expect(isSettled(block("Past", at(9), at(10)), now)).toBe(true);
    expect(isSettled(block("Ahead", at(13), at(14)), now)).toBe(false);
    expect(isSettled(block("Marked", at(13), at(14), { done_at: at(11) }), now)).toBe(true);
  });

  it("writes a range with the period once when both ends share it, and a compact clock", () => {
    expect(formatRange(14 * 60 + 30, 15 * 60 + 50)).toMatch(/^2:30 – 3:50.PM$/);
    expect(formatRange(11 * 60 + 30, 12 * 60 + 20)).toMatch(/^11:30.AM – 12:20.PM$/);
    expect(formatClockCompact(14 * 60 + 41)).toBe("2:41PM");
  });

  it("writes a span in hours and minutes", () => {
    expect([formatSpan(45), formatSpan(80), formatSpan(120)]).toEqual(["45 min", "1 h 20 min", "2 h"]);
  });
});

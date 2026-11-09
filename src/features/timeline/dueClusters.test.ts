import { describe, expect, it } from "vitest";
import { clusterDues, DUE_CLUSTER_GAP, sessionsNeedingRoom } from "./dueClusters";

/** Positions named by letter, in the order given. */
function at(...entries: Array<[string, number]>) {
  return entries.map(([item, y]) => ({ item, y }));
}

describe("clusterDues", () => {
  it("answers nothing for nothing", () => {
    expect(clusterDues([])).toEqual([]);
  });

  it("keeps a lone item as its own cluster at its position", () => {
    expect(clusterDues(at(["a", 40]))).toEqual([{ y: 40, items: ["a"] }]);
  });

  it("clusters items at the same minute, in input order", () => {
    expect(clusterDues(at(["a", 0], ["b", 0], ["c", 0]))).toEqual([{ y: 0, items: ["a", "b", "c"] }]);
  });

  it("clusters items nearer than the gap and splits items at or beyond it", () => {
    expect(clusterDues(at(["a", 0], ["b", DUE_CLUSTER_GAP - 1]))).toHaveLength(1);
    expect(clusterDues(at(["a", 0], ["b", DUE_CLUSTER_GAP]))).toHaveLength(2);
  });

  it("keeps far items apart", () => {
    expect(clusterDues(at(["a", 0], ["b", 300]))).toEqual([
      { y: 0, items: ["a"] },
      { y: 300, items: ["b"] },
    ]);
  });

  it("measures from the cluster's first member so a chain cannot grow without end", () => {
    const clusters = clusterDues(at(["a", 0], ["b", 15], ["c", 30], ["d", 45]));
    expect(clusters.map((c) => c.items)).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("orders clusters and members by position whatever the input order", () => {
    const clusters = clusterDues(at(["late", 500], ["b", 12], ["a", 10], ["mid", 200]));
    expect(clusters).toEqual([
      { y: 10, items: ["a", "b"] },
      { y: 200, items: ["mid"] },
      { y: 500, items: ["late"] },
    ]);
  });

  it("clusters many items at one minute into one cluster", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ item: i, y: 0 }));
    const clusters = clusterDues(many);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toEqual(many.map((m) => m.item));
  });
});

describe("sessionsNeedingRoom", () => {
  const tag = { top: -12, bottom: 12 };
  const hour = (h: number, length = 56) => ({ top: h * 56, bottom: h * 56 + length });

  it("insets nothing when no due tag is drawn", () => {
    expect(sessionsNeedingRoom([hour(0), hour(5)], [])).toEqual([false, false]);
  });

  it("insets only the sessions near a tag at 12 AM", () => {
    expect(sessionsNeedingRoom([hour(0), hour(2), hour(6)], [tag])).toEqual([true, false, false]);
  });

  it("counts the margin around a tag but not beyond it", () => {
    expect(sessionsNeedingRoom([{ top: 15, bottom: 60 }], [tag])).toEqual([true]);
    expect(sessionsNeedingRoom([{ top: 16, bottom: 60 }], [tag])).toEqual([false]);
  });

  it("counts a tall cluster pill's whole extent", () => {
    const pill = { top: 100, bottom: 148 };
    expect(sessionsNeedingRoom([{ top: 140, bottom: 200 }, { top: 300, bottom: 360 }], [pill])).toEqual([true, false]);
  });

  it("insets a whole overlapping group when one member touches a tag, and not the next group", () => {
    const sessions = [
      { top: 0, bottom: 56 },
      { top: 40, bottom: 200 },
      { top: 300, bottom: 360 },
    ];
    expect(sessionsNeedingRoom(sessions, [{ top: 0, bottom: 24 }])).toEqual([true, true, false]);
  });
});

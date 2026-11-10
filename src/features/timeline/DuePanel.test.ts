import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../types/timeline";
import { dueInOrder, dueUrgency } from "./DuePanel";

const now = new Date("2026-11-09T12:00:00Z");

describe("Due panel", () => {
  it("marks a past due time overdue, one within three hours soon, and the rest later", () => {
    expect(dueUrgency("2026-11-09T11:59:00Z", now)).toBe("overdue");
    expect(dueUrgency("2026-11-09T14:59:00Z", now)).toBe("soon");
    expect(dueUrgency("2026-11-09T15:01:00Z", now)).toBe("later");
  });

  it("lists every due item earliest first without dropping any", () => {
    const at = (id: string, due: string) => ({ id, due_at: due }) as TimelineItem;
    const items = [at("c", "2026-11-09T23:59:00Z"), at("a", "2026-11-09T00:00:00Z"), at("b", "2026-11-09T09:00:00Z"), at("d", "2026-11-09T00:00:00Z")];
    expect(dueInOrder(items).map((item) => item.id)).toEqual(["a", "d", "b", "c"]);
  });
});

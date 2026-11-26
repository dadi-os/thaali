import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "../../types/planner";
import { closeHint, courseLabel, groupByTitle, isSomeday, isUrgent, dayBadge, dayTasksKey, groupTasks, monthBadge, progressOf, SOMEDAY_KEY, tickTask } from "./tasks";

const day = new Date(2026, 10, 18);
const now = new Date(2026, 10, 18, 14, 0);
const at = (d: number, h = 23, m = 59) => new Date(2026, 10, d, h, m).toISOString();

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    body: null,
    opens_on: "2026-11-16",
    closes_at: at(18),
    done: false,
    verified_at: null,
    created_at: at(1),
    updated_at: at(1),
    past_due: false,
    hub: null,
    owner: "cse-300-specialist",
    ...over,
  };
}

describe("checklist groups", () => {
  it("puts past due on top, open sorted by close then title, and done last", () => {
    const groups = groupTasks(
      [
        task("b-late", { closes_at: at(18) }),
        task("a-late", { closes_at: at(18) }),
        task("early", { closes_at: at(18, 15, 0) }),
        task("open-ended", { closes_at: null }),
        task("stale", { closes_at: at(15), past_due: true }),
        task("finished", { done: true }),
      ],
      day,
    );
    expect(groups.pastDue.map((t) => t.id)).toEqual(["stale"]);
    expect(groups.open.map((t) => t.id)).toEqual(["early", "a-late", "b-late"]);
    expect(groups.done.map((t) => t.id)).toEqual(["finished"]);
    expect(progressOf(groups)).toEqual({ done: 1, total: 5 });
  });

  it("treats a task with no close date as Someday, with or without an opening day, in the list, the progress and the badge", () => {
    const loose = task("headline", { opens_on: "2026-11-16", closes_at: null });
    const groups = groupTasks([loose, task("real")], day);
    expect(isSomeday(loose)).toBe(true);
    expect(groups.open.map((t) => t.id)).toEqual(["real"]);
    expect(progressOf(groups)).toEqual({ done: 0, total: 1 });
    expect(dayBadge([loose, task("real")], day, new Date(2026, 10, 18, 9)).open).toBe(1);
    expect(groupTasks([task("done-loose", { closes_at: null, done: true })], day).done).toEqual([]);
  });

  it("leaves windowless tasks to Someday and tasks that open later off the list", () => {
    const groups = groupTasks([task("someday", { opens_on: null, closes_at: null }), task("later", { opens_on: "2026-11-19" })], day);
    expect(groupTasks([], day)).toEqual({ pastDue: [], open: [], done: [] });
    expect([...groups.pastDue, ...groups.open, ...groups.done]).toEqual([]);
  });

  it("calls an undone task closed before the viewed day past due even without the server flag", () => {
    expect(groupTasks([task("old", { closes_at: at(17) })], day).pastDue.map((t) => t.id)).toEqual(["old"]);
  });
});

describe("close hints", () => {
  it("counts down within six hours, otherwise names the day and time", () => {
    expect(closeHint(task("a", { closes_at: at(18, 17, 0) }), now)).toBe("in 3h");
    expect(closeHint(task("a", { closes_at: at(18) }), now)).toMatch(/^Today 11:59.PM$/);
    expect(closeHint(task("a", { closes_at: at(20) }), now)).toMatch(/^Fri 11:59.PM$/);
    expect(closeHint(task("a", { closes_at: at(17, 9, 0) }), now)).toMatch(/^Was due Yesterday|^Was due Nov 17/);
    expect(closeHint(task("a", { closes_at: null }), now)).toBeNull();
    expect(closeHint(task("a", { done: true }), now)).toBeNull();
  });
});

describe("urgency", () => {
  it("marks a task closing within six hours or already closed, and nothing else", () => {
    expect(isUrgent(task("a", { closes_at: at(18, 17, 0) }), now)).toBe(true);
    expect(isUrgent(task("a", { closes_at: at(17) }), now)).toBe(true);
    expect(isUrgent(task("a", { closes_at: at(18) }), now)).toBe(false);
    expect(isUrgent(task("a", { closes_at: at(17), done: true }), now)).toBe(false);
    expect(isUrgent(task("a", { closes_at: null }), now)).toBe(false);
  });
});

describe("week and month badges", () => {
  it("counts open tasks in the window, clay when one closes that day or is past due", () => {
    const tasks = [task("due-today"), task("later", { closes_at: at(22) }), task("done", { done: true })];
    expect(dayBadge(tasks, day, now)).toEqual({ open: 2, urgent: true, allDone: false });
    expect(dayBadge([task("later", { closes_at: at(22) })], day, now)).toEqual({ open: 1, urgent: false, allDone: false });
  });

  it("carries past due tasks onto today only, and marks a day of finished tasks", () => {
    const stale = task("stale", { closes_at: at(15), past_due: true });
    expect(dayBadge([stale], day, now).open).toBe(1);
    expect(dayBadge([stale], new Date(2026, 10, 19), now).open).toBe(0);
    expect(dayBadge([task("done", { done: true })], day, now)).toEqual({ open: 0, urgent: false, allDone: true });
  });

  it("counts the tasks closing on a month tile, with a clay flag for past due and a check when all are done", () => {
    expect(monthBadge([task("a"), task("b", { closes_at: at(22) })], day)).toEqual({ closing: 1, pastDue: false, allDone: false });
    expect(monthBadge([task("a", { past_due: true })], day).pastDue).toBe(true);
    expect(monthBadge([task("a", { done: true })], day)).toEqual({ closing: 1, pastDue: false, allDone: true });
    expect(monthBadge([], day)).toEqual({ closing: 0, pastDue: false, allDone: false });
  });
});

describe("ticking a task", () => {
  const seeded = () => {
    const client = new QueryClient();
    client.setQueryData(dayTasksKey(day), [task("a"), task("b")]);
    client.setQueryData(SOMEDAY_KEY, [task("a", { opens_on: null, closes_at: null })]);
    return client;
  };
  const done = (client: QueryClient, key: readonly unknown[]) => client.getQueryData<Task[]>(key)!.map((t) => t.done);

  it("shows the tick in every cached list before the write answers", async () => {
    const client = seeded();
    let release!: () => void;
    const write = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const pending = tickTask(client, write, "a", true);
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("a", true));
    expect(done(client, dayTasksKey(day))).toEqual([true, false]);
    expect(done(client, SOMEDAY_KEY)).toEqual([true]);
    release();
    await pending;
  });

  it("puts every list back and rethrows when the write fails", async () => {
    const client = seeded();
    await expect(tickTask(client, () => Promise.reject(new Error("422")), "a", true)).rejects.toThrow("422");
    expect(done(client, dayTasksKey(day))).toEqual([false, false]);
    expect(done(client, SOMEDAY_KEY)).toEqual([false]);
  });
});

describe("grouping repeated titles", () => {
  it("folds repeated titles into one group, drops a trailing number from its label, and keeps singles apart", () => {
    const some = (id: string, title: string) => task(id, { title, opens_on: null, closes_at: null });
    const groups = groupByTitle([some("1", "Gym training split"), some("2", "Weigh-in 3"), some("3", "gym training split"), some("4", "Weigh-in 12"), some("5", "Organize the garage")]);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([["Gym training split", 2], ["Organize the garage", 1], ["Weigh-in", 2]]);
  });

  it("groups anything with a title, plans included", () => {
    const plans = [{ title: "Call the dentist about the cleaning" }, { title: "Book the oil change" }, { title: "Call the dentist about the cleaning" }];
    expect(groupByTitle(plans).map((g) => [g.label, g.items.length])).toEqual([["Book the oil change", 1], ["Call the dentist about the cleaning", 2]]);
  });
});

describe("courseLabel", () => {
  const hub = (title: string) => ({ id: "h", title }) as never;
  it("hides the course when the title starts with its code", () => {
    expect(courseLabel({ title: "IBIO 150 — Codon survey", hub: hub("IBIO 150 class") })).toBeNull();
  });
  it("names the course otherwise, and nothing without a hub", () => {
    expect(courseLabel({ title: "Chapter 11 reading", hub: hub("IAH 241A class") })).toBe("IAH 241A class");
    expect(courseLabel({ title: "Chapter 11 reading", hub: null })).toBeNull();
  });
});

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { Plan } from "../../types/planner";
import { answerAfter, hasStarted, PLANS_KEY, setAttendedOptimistic } from "./attended";

const plan = (id: string, attended: boolean | null = null): Plan => ({ id, title: id, body: null, rsvp: null, start_at: "2026-11-16T15:00:00.000Z", end_at: "2026-11-16T16:00:00.000Z", all_day: false, time_zone: null, attended, place: null, hub: null, owner: "manual", notes: [] });

describe("attended answers", () => {
  it("writes the tapped answer, and the same answer again clears it", () => {
    expect(answerAfter(null, true)).toBe(true);
    expect(answerAfter(true, true)).toBeNull();
    expect(answerAfter(true, false)).toBe(false);
    expect(answerAfter(false, false)).toBeNull();
  });

  it("asks only once the plan has begun", () => {
    expect(hasStarted(plan("a"), new Date("2026-11-16T14:59:00.000Z"))).toBe(false);
    expect(hasStarted(plan("a"), new Date("2026-11-16T15:00:00.000Z"))).toBe(true);
  });
});

describe("saving attendance", () => {
  const seeded = () => {
    const client = new QueryClient();
    client.setQueryData([...PLANS_KEY, "Day"], [plan("a"), plan("b")]);
    client.setQueryData([...PLANS_KEY, "tile"], [plan("a")]);
    return client;
  };
  const answers = (client: QueryClient, key: string) => client.getQueryData<Plan[]>([...PLANS_KEY, key])!.map((p) => p.attended);

  it("shows the answer in every cached list before the write answers", async () => {
    const client = seeded();
    let release!: () => void;
    const write = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const pending = setAttendedOptimistic(client, write, "a", true);
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("a", true));
    expect(answers(client, "Day")).toEqual([true, null]);
    expect(answers(client, "tile")).toEqual([true]);
    release();
    await pending;
  });

  it("puts every list back and rethrows when the write fails, and clears with null", async () => {
    const client = seeded();
    await expect(setAttendedOptimistic(client, () => Promise.reject(new Error("422")), "a", false)).rejects.toThrow("422");
    expect(answers(client, "Day")).toEqual([null, null]);
    await setAttendedOptimistic(client, () => Promise.resolve(), "a", null);
    expect(answers(client, "Day")).toEqual([null, null]);
  });
});

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { planner } from "../../shared/api";
import { failureTarget, pushToast } from "../../contexts/toasts";
import type { Plan } from "../../types/planner";

/** Query key prefix of every cached plan list, so one write reaches the day, week, month and widget lists. */
export const PLANS_KEY = ["yaad", "planner", "plans"] as const;

/** What Ankur's tap on one of the two answers writes: the same answer again clears it. */
export function answerAfter(current: boolean | null, tapped: boolean): boolean | null {
  return current === tapped ? null : tapped;
}

/** `plans` with one plan's attended answer set. */
export function withAttended(plans: Plan[], id: string, attended: boolean | null): Plan[] {
  return plans.map((plan) => (plan.id === id ? { ...plan, attended } : plan));
}

/**
 * Sets a plan's attended answer in every cached plan list at once, then writes it. A failed write puts every list back as
 * it was and rethrows, so the caller can say so. Lists refetch afterwards either way.
 */
export async function setAttendedOptimistic(client: QueryClient, write: (planId: string, attended: boolean | null) => Promise<unknown>, planId: string, attended: boolean | null): Promise<void> {
  await client.cancelQueries({ queryKey: PLANS_KEY });
  const before = client.getQueriesData<Plan[]>({ queryKey: PLANS_KEY });
  client.setQueriesData<Plan[]>({ queryKey: PLANS_KEY }, (plans) => (Array.isArray(plans) ? withAttended(plans, planId, attended) : plans));
  try {
    await write(planId, attended);
  } catch (error) {
    for (const [key, plans] of before) client.setQueryData(key, plans);
    throw error;
  } finally {
    void client.invalidateQueries({ queryKey: PLANS_KEY });
  }
}

/** Says whether Ankur was at a plan, or clears the answer: shown at once everywhere, put back with a toast when the write fails. */
export function useSetAttended(): (plan: Pick<Plan, "id">, attended: boolean | null) => void {
  const client = useQueryClient();
  return (plan, attended) => {
    setAttendedOptimistic(client, (id, value) => planner.setAttended({ plan_id: id, attended: value }), plan.id, attended).catch((error: unknown) =>
      pushToast({ key: "planner:attended", tone: "error", title: "Couldn’t save attendance", body: error instanceof Error ? error.message : String(error), target: failureTarget(error) }),
    );
  };
}

/** The freshest copy of `plan` any cached plan list holds, so a card left open shows an answer written from its own buttons or a menu. */
export function useLivePlan(plan: Plan): Plan {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  return useSyncExternalStore(
    (notify) => cache.subscribe(notify),
    () => {
      for (const [, plans] of client.getQueriesData<Plan[]>({ queryKey: PLANS_KEY })) {
        const found = Array.isArray(plans) ? plans.find((candidate) => candidate.id === plan.id) : undefined;
        if (found !== undefined) return found;
      }
      return plan;
    },
  );
}

/** Whether the plan has begun, so there is something to say about being there. */
export function hasStarted(plan: Plan, now: Date): boolean {
  return Date.parse(plan.start_at) <= now.getTime();
}

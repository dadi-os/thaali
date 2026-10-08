import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ghar, yaad } from "../shared/api";
import { GHAR_DEVICES_KEY } from "../shared/api/ghar";
import { useConnection } from "../shared/hooks/useConnection";
import { POLL_MS } from "../shared/lib/ux/poll";
import { failureTarget, pushToast } from "../store/toasts";
import { formatTime, toIsoBounds } from "../features/timeline/dates";
import { asPlan, isMultiDay, spanOf, type PlanNode } from "../features/timeline/plans";

/** How often the upcoming-plans query refreshes and the plan clock ticks. */
const PLAN_POLL_MS = 60_000;
/** How long before a plan starts its heads-up toast shows. */
const PLAN_SOON_MS = 10 * 60_000;
/** How long after a plan starts it still counts as just starting (launching mid-plan stays quiet). */
const PLAN_STARTING_MS = 2 * 60_000;

/**
 * Toast what happens around the house while the app is open: a Ghar device turning on or
 * off (any source: an agent, a wall switch, the house page; picked up by the shared
 * GET /devices poll), and a timed plan ten minutes before it starts and again as it
 * starts. A failed poll toasts its real error, linked to the service's log line for it.
 */
export function useActivityToasts(): void {
  const { state: connection } = useConnection();
  const connected = connection === "connected";

  const devicesQuery = useQuery({
    queryKey: GHAR_DEVICES_KEY,
    queryFn: () => ghar.listDevices(),
    enabled: connected,
    refetchInterval: connected ? POLL_MS : false,
  });
  const lastOn = useRef<Map<string, boolean> | null>(null);

  useEffect(() => {
    if (!devicesQuery.data) {
      return;
    }
    const { devices } = devicesQuery.data;
    const next = new Map<string, boolean>();
    for (const device of devices) {
      if (device.state.on) {
        next.set(device.id, device.state.on.value === true);
      }
    }
    const prev = lastOn.current;
    lastOn.current = next;
    if (!prev) {
      return;
    }
    for (const device of devices) {
      const on = next.get(device.id);
      const was = prev.get(device.id);
      if (on === undefined || was === undefined || on === was) {
        continue;
      }
      pushToast({
        key: `ghar:${device.id}`,
        tone: "info",
        title: `${device.name} turned ${on ? "on" : "off"}`,
        body: device.room.name,
        target: { kind: "ghar", deviceId: device.id },
      });
    }
  }, [devicesQuery.data]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), PLAN_POLL_MS / 2);
    return () => window.clearInterval(timer);
  }, []);

  const plansQuery = useQuery({
    queryKey: ["yaad", "plans", "soon"],
    queryFn: async () => {
      const from = new Date(Date.now() - PLAN_STARTING_MS);
      const { nodes } = await yaad.query({
        kind: "plan",
        ...toIsoBounds(from, new Date(from.getTime() + PLAN_SOON_MS + 2 * PLAN_POLL_MS)),
        limit: 50,
      });
      return nodes
        .map(asPlan)
        .filter((n): n is PlanNode => n !== null)
        .filter((n) => n.detail.status !== "idea" && !n.detail.all_day && !isMultiDay(n));
    },
    enabled: connected,
    refetchInterval: connected ? PLAN_POLL_MS : false,
  });
  const announced = useRef(new Set<string>());

  useEffect(() => {
    for (const plan of plansQuery.data ?? []) {
      const span = spanOf(plan);
      if (!span) {
        continue;
      }
      const lead = span.start.getTime() - now;
      const phase =
        lead > 0 && lead <= PLAN_SOON_MS ? "soon" : lead <= 0 && -lead < PLAN_STARTING_MS ? "now" : null;
      const mark = `${plan.id}:${span.start.toISOString()}:${phase}`;
      if (phase === null || announced.current.has(mark)) {
        continue;
      }
      announced.current.add(mark);
      pushToast({
        key: `plan:${plan.id}:${phase}`,
        tone: "info",
        title: plan.title,
        body:
          phase === "soon"
            ? `In ${Math.ceil(lead / 60_000)} min · ${formatTime(span.start.toISOString())}`
            : `Starting now · until ${formatTime(span.end.toISOString())}`,
        target: { kind: "timeline" },
      });
    }
  }, [plansQuery.data, now]);

  useEffect(() => {
    if (devicesQuery.error) {
      pushToast({
        key: "ghar_devices_failed",
        tone: "error",
        title: "Ghar devices failed to load",
        body: devicesQuery.error.message,
        target: failureTarget(devicesQuery.error),
      });
    }
  }, [devicesQuery.error, devicesQuery.errorUpdatedAt]);

  useEffect(() => {
    if (plansQuery.error) {
      pushToast({
        key: "plans_soon_failed",
        tone: "error",
        title: "Upcoming plans failed to load",
        body: plansQuery.error.message,
        target: failureTarget(plansQuery.error),
      });
    }
  }, [plansQuery.error, plansQuery.errorUpdatedAt]);
}

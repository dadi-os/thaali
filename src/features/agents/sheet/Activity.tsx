import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FADE } from "../../../shared/motion";
import { InsetCard, KeyValue } from "../../../shared/components/Module";
import { formatRelative } from "../../../shared/lib/ux/time";
import { Button } from "../../../shared/ui/Button";
import { StaleBanner, StateView } from "../../../shared/states/ModuleState";
import { WakeRow } from "./WakeRow";
import { useWake, useWakeList } from "./useWakes";
import { nowLine, type ScheduleNames } from "./wakes";

/** Props of {@link Activity}. */
export type ActivityProps = {
  agentId: string;
  /** Whether Hath can be reached; nothing is read while it cannot. */
  connected: boolean;
  /** An agent's display name by id; null is Ankur. */
  nameOf: (id: string | null) => string;
  /** The routines and reminders that wake the agent, to name a scheduled wake. */
  schedules: ScheduleNames;
  /** Selects the agent a wake's reason names. */
  onSelectAgent: (agentId: string) => void;
  /** The time the section's relative words are measured from. */
  now: number;
};

/**
 * What the agent has done: the current call (the latest call while a wake runs) over the wake timeline,
 * newest first, a page at a time. The running or latest wake is open until another is chosen; one wake is open at a time.
 */
export function Activity({ agentId, connected, nameOf, schedules, onSelectAgent, now }: ActivityProps) {
  const list = useWakeList(agentId, connected);
  const wakes = useMemo(() => list.data?.pages.flatMap((page) => page.wakes), [list.data]);
  const latest = wakes?.[0];
  const running = latest?.outcome === "running" ? latest : undefined;
  const live = useWake(agentId, running?.id ?? null, connected);
  const current = live.data === undefined ? null : nowLine(live.data.entries);
  const [chosen, setChosen] = useState<{ id: string | null } | null>(null);
  const openId = chosen === null ? (latest?.id ?? null) : chosen.id;

  return (
    <InsetCard title="Wakes">
      <AnimatePresence initial={false}>
        {current === null ? null : (
          <motion.div key="current" {...FADE} className="flex flex-col">
            <KeyValue label="Current call" hint={current.running ? `running ${formatRelative(current.at, now)}` : formatRelative(current.at, now)}>
              {current.target === "" ? current.name : `${current.name} ${current.target}`}
            </KeyValue>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col gap-1.5">
        {list.error !== null && wakes !== undefined ? <StaleBanner text="Could not refresh the wakes." onRetry={() => void list.refetch()} /> : null}
        {wakes === undefined ? (
          list.error === null ? (
            <div className="flex flex-col gap-2 py-1" aria-label="Loading wakes">
              <span className="sk h-10 w-full" />
              <span className="sk h-10 w-full" />
              <span className="sk h-10 w-full" />
            </div>
          ) : (
            <StateView kind="error" compact title="Could not read the wakes" detail={list.error.message} onRetry={() => void list.refetch()} />
          )
        ) : wakes.length === 0 ? (
          <StateView kind="empty" compact title="No wakes yet" />
        ) : (
          <motion.div {...FADE} className="flex flex-col gap-1">
            {wakes.map((wake) => (
              <WakeRow
                key={wake.id}
                wake={wake}
                open={openId === wake.id}
                onToggle={() => setChosen({ id: openId === wake.id ? null : wake.id })}
                nameOf={nameOf}
                schedules={schedules}
                onSelectAgent={onSelectAgent}
                now={now}
              />
            ))}
            {list.hasNextPage ? (
              <Button tone="quiet" size="md" className="self-center" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                {list.isFetchingNextPage ? "Loading…" : "Load earlier"}
              </Button>
            ) : null}
          </motion.div>
        )}
      </div>
    </InsetCard>
  );
}

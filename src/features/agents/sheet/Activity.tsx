import { useMemo, useState } from "react";
import { SectionHeader } from "../../../shared/components/Module";
import { formatRelative } from "../../../shared/lib/ux/time";
import { Button } from "../../../shared/ui/Button";
import { Truncate } from "../../../shared/ui/Truncate";
import { StaleBanner, StateView } from "../../../shared/states/ModuleState";
import { WakeRow } from "./WakeRow";
import { useWake, useWakeList } from "./useWakes";
import { nowLine } from "./wakes";

/** Props of {@link Activity}. */
export type ActivityProps = {
  agentId: string;
  /** Whether Hath can be reached; nothing is read while it cannot. */
  connected: boolean;
  /** An agent's display name by id; null is Ankur. */
  nameOf: (id: string | null) => string;
  /** Selects the agent a wake's reason names. */
  onSelectAgent: (agentId: string) => void;
  /** The time the section's relative words are measured from. */
  now: number;
};

/**
 * What the agent is doing and has done: the Now line (the work lane's latest call while a wake runs) over the wake timeline,
 * newest first, a page at a time. The running or latest wake is open until another is chosen; one wake is open at a time.
 */
export function Activity({ agentId, connected, nameOf, onSelectAgent, now }: ActivityProps) {
  const list = useWakeList(agentId, connected);
  const wakes = useMemo(() => list.data?.pages.flatMap((page) => page.wakes), [list.data]);
  const latest = wakes?.[0];
  const running = latest?.outcome === "running" ? latest : undefined;
  const live = useWake(agentId, running?.id ?? null, connected);
  const current = live.data === undefined ? null : nowLine(live.data.entries);
  const [chosen, setChosen] = useState<{ id: string | null } | null>(null);
  const openId = chosen === null ? (latest?.id ?? null) : chosen.id;

  return (
    <>
      {current === null ? null : (
        <div className="flex flex-col gap-0.5 rounded-[14px] bg-sage-fill px-4 py-2.5">
          <SectionHeader title="Now" />
          <div className="flex min-w-0 items-baseline gap-2">
            <span data-selectable className="flex-none font-numeric text-[13px] font-semibold">{current.name}</span>
            <Truncate text={current.target} className="ui-mono min-w-0 flex-1" />
            <span className="flex-none text-[12px] text-ink-muted">{current.running ? `running ${formatRelative(current.at, now)}` : formatRelative(current.at, now)}</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <SectionHeader title="Wakes" />
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
          <div className="flex flex-col gap-1">
            {wakes.map((wake) => (
              <WakeRow
                key={wake.id}
                wake={wake}
                open={openId === wake.id}
                onToggle={() => setChosen({ id: openId === wake.id ? null : wake.id })}
                nameOf={nameOf}
                onSelectAgent={onSelectAgent}
                now={now}
              />
            ))}
            {list.hasNextPage ? (
              <Button tone="quiet" size="md" className="self-center" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                {list.isFetchingNextPage ? "Loading…" : "Load earlier"}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

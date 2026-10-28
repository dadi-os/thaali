import { useQueries } from "@tanstack/react-query";
import { motion } from "motion/react";
import { isMeshOnline, yaad } from "../../shared/api";
import type { NodeKind } from "../../types/yaad";
import { StateView } from "../../shared/components/states";
import { Ticker } from "../../shared/components/Ticker";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { countNoun } from "../../shared/lib/ux/plural";

const KINDS: Array<{ kind: NodeKind; singular: string; plural: string }> = [
  { kind: "person", singular: "Person", plural: "People" },
  { kind: "memory", singular: "Memory", plural: "Memories" },
  { kind: "place", singular: "Place", plural: "Places" },
  { kind: "plan", singular: "Plan", plural: "Plans" },
];

const PAGE = 200;

/** How many of a kind Yaad holds, and how many of them arrived since this week's Monday. */
export type KindCount = { total: number; thisWeek: number };

/** Query key of one kind's count; the home grid reads the cached counts for its "+N this week". */
export const kindCountKey = (kind: NodeKind) => ["yaad", "memory-kind-count", kind] as const;

/** The kinds the counters show, for callers that read their cached counts. */
export const COUNTED_KINDS = KINDS.map(({ kind }) => kind);

/** Midnight of this week's Monday, local time. */
function weekStart(): number {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday.getTime();
}

async function countKind(kind: NodeKind): Promise<KindCount> {
  const since = weekStart();
  let offset = 0;
  let total = 0;
  let thisWeek = 0;
  for (;;) {
    const { nodes } = await yaad.query({ kind, limit: PAGE, offset });
    total += nodes.length;
    thisWeek += nodes.filter((n) => new Date(n.created_at).getTime() >= since).length;
    if (nodes.length < PAGE) {
      return { total, thisWeek };
    }
    offset += PAGE;
  }
}

export type MemoryCountersProps = {
  className?: string;
};

/**
 * Home memory preview — kind counts as a quiet ledger with labeled icons. Each kind is
 * counted on its own, so its ticker spins until its count lands and then rolls to it.
 */
export function MemoryCounters({ className }: MemoryCountersProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);

  const countQueries = useQueries({
    queries: KINDS.map(({ kind }) => ({
      queryKey: kindCountKey(kind),
      queryFn: () => countKind(kind),
      enabled: connected,
    })),
  });
  const failed = countQueries.find((query) => query.isError && !query.data);

  if (!connected && countQueries.some((query) => !query.data)) {
    return <StateView tone="offline" label="Yaad is offline" detail="Counts come back when dadi reconnects" compact className={className} />;
  }

  if (failed) {
    return <StateView tone="error" label="Could not count Yaad" error={failed.error} onRetry={() => void failed.refetch()} compact className={className} />;
  }

  return (
    <div
      className={`flex h-full min-h-0 items-stretch px-2 pb-2.5 pt-0.5 ${className ?? ""}`}
    >
      {KINDS.map(({ kind, singular, plural }, i) => {
        const count = countQueries[i]?.data?.total;
        return (
          <motion.div
            key={kind}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.04 }}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-2 ${
              i > 0 ? "border-l border-rule" : ""
            }`}
          >
            <Ticker
              value={count ?? null}
              delay={i * 0.06}
              className="text-[30px] font-semibold tracking-[-0.02em] text-ink"
            />
            <span className="text-[12px] font-medium text-ink-ghost">
              {count === undefined ? plural : countNoun(count, singular, plural)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

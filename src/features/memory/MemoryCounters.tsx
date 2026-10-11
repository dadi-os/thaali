import { useQueries } from "@tanstack/react-query";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { isMeshOnline, yaad } from "../../shared/api";
import type { NodeKind } from "../../types/yaad";
import { Ticker } from "../../shared/components/Ticker";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { countNoun } from "../../shared/lib/ux/plural";

const KINDS: Array<{
  kind: NodeKind;
  singular: string;
  plural: string;
  icon: ReactNode;
}> = [
  { kind: "person", singular: "PERSON", plural: "PEOPLE", icon: <IconPerson /> },
  { kind: "memory", singular: "MEMORY", plural: "MEMORIES", icon: <IconMemory /> },
  { kind: "place", singular: "PLACE", plural: "PLACES", icon: <IconPlace /> },
  { kind: "plan", singular: "PLAN", plural: "PLANS", icon: <IconPlan /> },
];

const PAGE = 200;

async function countKind(kind: NodeKind): Promise<number> {
  let offset = 0;
  let total = 0;
  for (;;) {
    const { nodes } = await yaad.query({ kind, limit: PAGE, offset });
    total += nodes.length;
    if (nodes.length < PAGE) {
      return total;
    }
    offset += PAGE;
  }
}

function IconPerson() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden className="size-3">
      <circle
        cx="9"
        cy="6"
        r="2.4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.5 14.2c.7-2.4 2.2-3.6 4.5-3.6s3.8 1.2 4.5 3.6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMemory() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden className="size-3">
      <path
        d="M5.2 3.5h7.6v11L9 12.2 5.2 14.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlace() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden className="size-3">
      <path
        d="M9 15.2s4.6-3.4 4.6-7a4.6 4.6 0 1 0-9.2 0c0 3.6 4.6 7 4.6 7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="9"
        cy="8.1"
        r="1.55"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function IconPlan() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden className="size-3">
      <rect
        x="3.5"
        y="4.5"
        width="11"
        height="10"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.2 3.2v2.6M11.8 3.2v2.6M3.5 8h11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
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
      queryKey: ["yaad", "memory-kind-count", kind],
      queryFn: () => countKind(kind),
      enabled: connected,
      refetchInterval: POLL_MS,
    })),
  });
  const failed = countQueries.find((query) => query.isError);

  if (!connected) {
    return (
      <div
        className={`flex h-full items-center justify-center ${className ?? ""}`}
      >
        <p className="text-[13px] text-ink-ghost">Connect to load memory</p>
      </div>
    );
  }

  if (failed?.error) {
    return (
      <div
        className={`flex h-full items-center justify-center px-3 ${className ?? ""}`}
      >
        <p className="text-center text-[13px] text-ink-muted">{failed.error.message}</p>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full min-h-0 items-stretch px-2 pb-2.5 pt-0.5 ${className ?? ""}`}
    >
      {KINDS.map(({ kind, singular, plural, icon }, i) => {
        const count = countQueries[i]?.data;
        return (
          <motion.div
            key={kind}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.04 }}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-2 ${
              i > 0 ? "border-l border-dashed border-sage-line/70" : ""
            }`}
          >
            <Ticker
              value={count ?? null}
              delay={i * 0.06}
              className="text-[28px] font-medium tracking-tight text-ink"
            />
            <span className="inline-flex items-center gap-1 text-sage-deep">
              {icon}
              <span className="text-[10px] font-medium tracking-[2px]">
                {count === undefined ? plural : countNoun(count, singular, plural)}
              </span>
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

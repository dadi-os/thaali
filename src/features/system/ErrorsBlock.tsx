import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { FADE, RISE } from "../../shared/motion";
import { isMeshOnline, nas } from "../../shared/api";
import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import { StateView } from "../../shared/states/ModuleState";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Clamp, Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { failureProps } from "../../shared/lib/ux/moduleState";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { formatClock } from "../../shared/lib/ux/time";
import { errorCard, type ErrorCard } from "../logs/errorCards";
import { rangeBounds } from "../logs/logLines";
import { capitalize } from "./format";
import { SectionLabel } from "./SectionLabel";

/** Cards asked of Nas, newest first. */
const LIMIT = 6;

export type ErrorsBlockProps = {
  /** Brings a card's line up in the logs. */
  onOpen: (card: ErrorCard) => void;
};

/** One error line as a card: its service and status, when it happened, the human cause, the line's own message, the request it came from, and a way into the logs. */
function ErrorItem({ card, onOpen }: { card: ErrorCard; onOpen: () => void }) {
  return (
    <motion.button
      {...RISE}
      type="button"
      className="ui-trans ui-hover-card flex min-w-0 flex-col items-stretch gap-1.5 rounded-2xl border border-error-line bg-glass-veil px-4 py-3.5 text-left shadow-widget"
      title={`Show this line in ${capitalize(card.service)}’s logs`}
      onClick={onOpen}
    >
      <span className="flex items-center gap-2">
        <span className="size-2 flex-none rounded-full bg-error" />
        <Truncate text={capitalize(card.service)} className="flex-[0_1_auto] text-[14px] font-semibold" />
        {card.code === null ? null : <span className="ui-mono flex-none rounded-full bg-error-fill px-2 text-[12px] leading-5 text-error">{card.code}</span>}
        <span className="ml-auto flex-none text-[12px] whitespace-nowrap text-ink-muted tabular-nums">{formatClock(card.time)}</span>
      </span>
      <Clamp text={card.title} lines={3} style={{ fontSize: 14, lineHeight: "20px", fontWeight: 500, color: "var(--ink)" }} />
      {card.context === null ? null : <Truncate text={card.context} className="text-[13px] text-ink-muted" />}
      {card.request === null ? null : <Truncate text={card.request} className="ui-mono text-[12px]" />}
      <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-sage-text">
        Open in logs
        <Icon name="chevron" size={13} />
      </span>
    </motion.button>
  );
}

/** The last hour's error lines from Nas as cards, six at most, each opening its line in the logs. */
export function ErrorsBlock({ onOpen }: ErrorsBlockProps) {
  const { state: connection } = useConnection();
  const query = useQuery({
    queryKey: ["nas", "logs", "errors"],
    queryFn: () => {
      const { from, to } = rangeBounds("1h");
      return nas.getLogs({ level: "error", from, to, limit: LIMIT });
    },
    enabled: isMeshOnline(connection),
    refetchInterval: POLL_MS,
  });
  const state = useModuleState(query, (answer) => answer.entries.length === 0);
  const cards = state.kind === "ready" ? state.data.entries.map(errorCard) : [];
  const grid = "grid grid-cols-2 gap-2.5";
  let body;
  switch (state.kind) {
    case "loading":
      body = (
        <div className={grid}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-glass-border bg-glass-veil px-4 py-3.5 shadow-widget">
              <div className="flex items-center gap-2">
                <Skeleton width={8} height={8} radius={4} />
                <Skeleton width={70} height={14} />
                <Skeleton width={40} height={12} style={{ marginLeft: "auto" }} />
              </div>
              <Skeleton width="90%" height={14} />
              <Skeleton width="60%" height={12} />
            </div>
          ))}
        </div>
      );
      break;
    case "offline":
      body = (
        <Card style={{ borderRadius: 16 }}>
          <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />
        </Card>
      );
      break;
    case "module-offline":
    case "error":
      body = (
        <Card style={{ borderRadius: 16 }}>
          <StateView kind="error" title="Couldn’t load the errors" {...failureProps(state.error)} detail="GET /logs failed; the rest of this page is current." onRetry={() => void query.refetch()} />
        </Card>
      );
      break;
    case "empty":
      body = (
        <Card style={{ borderRadius: 16 }}>
          <div className="px-4 py-5 text-[14px] text-ink-muted">No errors in the last hour.</div>
        </Card>
      );
      break;
    case "ready":
      body = (
        <div className={grid}>
          {cards.map((card) => (
            <ErrorItem key={card.key} card={card} onOpen={() => onOpen(card)} />
          ))}
        </div>
      );
      break;
  }
  return (
    <>
      <SectionLabel right={state.kind === "ready" ? <span className="text-[13px] text-ink-muted">{`${cards.length} · last hour`}</span> : null}>Errors</SectionLabel>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={state.kind} {...FADE}>
          {body}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

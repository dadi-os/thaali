import { useQuery } from "@tanstack/react-query";
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
    <button
      type="button"
      className="ui-trans ui-hover-card"
      title={`Show this line in ${capitalize(card.service)}’s logs`}
      onClick={onOpen}
      style={{ display: "flex", flexDirection: "column", alignItems: "stretch", textAlign: "left", gap: 6, padding: "14px 16px", borderRadius: 16, background: "var(--glass-veil)", border: "1px solid var(--error-line)", boxShadow: "var(--shadow)", minWidth: 0 }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--error)", flex: "none" }} />
        <Truncate text={capitalize(card.service)} style={{ fontSize: 13.5, fontWeight: 600, flex: "0 1 auto" }} />
        {card.code === null ? null : <span className="ui-mono" style={{ fontSize: 11.5, color: "var(--error)", background: "var(--error-fill)", borderRadius: 999, padding: "0 8px", lineHeight: "20px", flex: "none" }}>{card.code}</span>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flex: "none" }}>{formatClock(card.time)}</span>
      </span>
      <Clamp text={card.title} lines={3} style={{ fontSize: 14, lineHeight: "20px", fontWeight: 500, color: "var(--ink)" }} />
      {card.context === null ? null : <Truncate text={card.context} style={{ fontSize: 12.5, color: "var(--ink-muted)" }} />}
      {card.request === null ? null : <Truncate text={card.request} className="ui-mono" style={{ fontSize: 11.5 }} />}
      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--sage-text)", marginTop: 2 }}>
        Open in logs
        <Icon name="chevron" size={13} />
      </span>
    </button>
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
  const grid = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 } as const;
  let body;
  switch (state.kind) {
    case "loading":
      body = (
        <div style={grid}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderRadius: 16, background: "var(--glass-veil)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow)", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
          <div style={{ padding: "20px 16px", fontSize: 13.5, color: "var(--ink-muted)" }}>No errors in the last hour.</div>
        </Card>
      );
      break;
    case "ready":
      body = (
        <div style={grid}>
          {cards.map((card) => (
            <ErrorItem key={card.key} card={card} onOpen={() => onOpen(card)} />
          ))}
        </div>
      );
      break;
  }
  return (
    <>
      <SectionLabel right={state.kind === "ready" ? <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{`${cards.length} · last hour`}</span> : null}>Errors</SectionLabel>
      {body}
    </>
  );
}

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { isMeshOnline, nas } from "../../shared/api";
import { StateView } from "../../shared/components/states";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { resourceRows, serviceHealth } from "./SystemMap";

/** Meters the tile shows at most: CPU, memory and the first two disks. */
const METERS = 4;

/**
 * Home System tile, as on the canvas: a dot per module (sage when it answers, a dashed ghost
 * when it is offline), a hairline, a meter per CPU, memory and disk that turns clay past two
 * thirds and error past 85%, and this computer's device line at the bottom. One layout at
 * every size: the meters share whatever height is left.
 */
export function SystemWidget() {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const statusQuery = useQuery({ queryKey: ["nas", "status"], queryFn: () => nas.getStatus(), enabled: connected, refetchInterval: POLL_MS });
  const clientsQuery = useQuery({ queryKey: ["nas", "clients"], queryFn: () => nas.listClients(), enabled: connected, refetchInterval: POLL_MS });

  if (!statusQuery.data) {
    if (statusQuery.isError) {
      return <StateView tone="error" label="Could not reach nas" error={statusQuery.error} onRetry={() => void statusQuery.refetch()} compact />;
    }
    if (!connected) {
      return <StateView tone="offline" label="dadi is offline" detail="Health comes back when the mesh reconnects" compact />;
    }
    return (
      <div role="status" aria-label="Reading health" className="flex h-full flex-col gap-3 px-[18px] pt-[14px] pb-4">
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="skeleton h-3 w-3/4" />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="skeleton mt-2 h-2 w-full" />
        ))}
      </div>
    );
  }

  const services = serviceHealth(statusQuery.data);
  const meters = resourceRows(statusQuery.data).slice(0, METERS);
  const devices = clientsQuery.data?.clients ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul className="grid shrink-0 grid-cols-2 gap-x-2.5 gap-y-1.5 px-[18px] pt-[14px] pb-2.5">
        {services.map((s) => (
          <li key={s.name} className="flex min-w-0 items-center gap-[7px] text-[13px]" title={s.ok ? "reachable" : "offline"}>
            <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${s.ok ? "bg-sage" : "border border-dashed border-ink-faint"}`} />
            <span className={`truncate ${s.ok ? "text-ink" : "text-ink-ghost"}`}>{s.name}</span>
          </li>
        ))}
      </ul>
      <div className="mx-[18px] h-px shrink-0 bg-[color-mix(in_srgb,var(--sage-line)_45%,transparent)]" />
      <div className="flex min-h-0 flex-1 flex-col justify-start gap-[11px] overflow-hidden px-[18px] pt-3 pb-1">
        {meters.map((row, i) => (
          <div key={row.key} className="flex shrink-0 flex-col gap-[5px]">
            <span className="flex justify-between text-[12px]">
              <span className="text-ink-muted">{row.kind}</span>
              <span className="font-semibold tabular-nums text-ink">{row.pct == null ? "—" : `${Math.round(row.pct)}%`}</span>
            </span>
            <span className="h-1 overflow-hidden rounded-[2px] bg-rule">
              {row.pct != null ? (
                <motion.span
                  className={`block h-full rounded-[2px] ${row.pct > 85 ? "bg-error" : row.pct > 65 ? "bg-[var(--clay)]" : "bg-sage"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                  transition={{ duration: SLOW_S * 2.5, ease: EASE, delay: 0.15 + i * 0.05 }}
                />
              ) : null}
            </span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 px-[18px] pt-1 pb-4 text-[12px] text-ink-muted">
        {devices === null ? (
          <span className="skeleton h-2.5 w-24" />
        ) : (
          devices.map((c) => (
            <span key={c.node_name} className="flex items-center gap-[7px]">
              <span aria-hidden className={`size-1.5 rounded-full ${c.online ? "bg-sage" : "border border-dashed border-ink-faint"}`} />
              <span className={c.online ? "" : "text-ink-ghost"}>{c.node_name}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

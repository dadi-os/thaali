import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { isMeshOnline, nas } from "../shared/api";
import type { NasStatus } from "../shared/api/nas";
import { Badge } from "../shared/ui/Badge";
import { Page } from "../shared/layout/Page";
import { FADE, RISE } from "../shared/motion";
import { Card } from "../shared/ui/Card";
import { StateView, StaleBanner } from "../shared/states/ModuleState";
import { Skeleton } from "../shared/ui/Skeleton";
import { Truncate } from "../shared/ui/Truncate";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { failureProps } from "../shared/lib/ux/moduleState";
import { POLL_MS } from "../shared/lib/ux/poll";
import { formatAge, formatRelative } from "../shared/lib/ux/time";
import { LogsCard } from "../features/logs/LogsCard";
import { errorFocus } from "../features/logs/errorCards";
import type { LogFocus } from "../features/logs/logLines";
import { capitalize, formatGb, formatUptime, loadTone } from "../features/system/format";
import { ErrorsBlock } from "../features/system/ErrorsBlock";
import { diskName, HealthCard } from "../features/system/HealthCard";
import { SectionLabel } from "../features/system/SectionLabel";
import { TasksBlock } from "../features/system/TasksBlock";

/** The logs column's widest width, and the share of the page it takes before that. */
const LOGS_MAX = 460;
const LOGS_SHARE = 0.36;
/** Below this page width the logs go under the cards instead of beside them. */
const STACK_BELOW = 880;

type ServicesProps = {
  status: NasStatus | null;
  /** Narrows the logs to a service. */
  onPick: (service: string) => void;
};

/** A chip per module with whether it answers; one is a way to the module's own log lines. */
function Services({ status, onPick }: ServicesProps) {
  return (
    <>
      <SectionLabel>Services</SectionLabel>
      <div className="grid grid-cols-3 gap-2.5">
        {status === null
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex h-12 items-center gap-2.5 rounded-2xl border border-glass-border bg-glass-veil px-4">
                <Skeleton width={10} height={10} radius={5} />
                <Skeleton width={80} height={14} />
                <Skeleton width={52} height={12} style={{ marginLeft: "auto" }} />
              </div>
            ))
          : status.services.map((service) => (
              <button
                key={service.name}
                type="button"
                className={`ui-trans ui-hover-card flex h-12 min-w-0 items-center gap-2.5 rounded-2xl border bg-glass-veil px-4 shadow-widget ${service.healthy ? "border-glass-border" : "border-error-line"}`}
                title={`Show ${service.name}’s log lines`}
                onClick={() => onPick(service.name)}
              >
                <span className={`size-[9px] flex-none rounded-full ${service.healthy ? "bg-sage" : "bg-error"}`} />
                <Truncate text={capitalize(service.name)} className="min-w-0 flex-1 text-[15px] font-semibold" />
                <span className={`text-[12.5px] whitespace-nowrap ${service.healthy ? "text-ink-muted" : "text-error"}`}>{service.healthy ? "Healthy" : "Offline"}</span>
              </button>
            ))}
      </div>
    </>
  );
}

/** A card per physical disk: its name, how much is free, a bar for how full it is and the device behind it. */
function Drives({ status }: { status: NasStatus | null }) {
  const disks = status === null ? null : (status.disks ?? []);
  return (
    <>
      <SectionLabel>Drives</SectionLabel>
      <div className="grid grid-cols-2 gap-2.5">
        {disks === null
          ? Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-glass-border bg-glass-veil px-4 py-3.5 shadow-widget">
                <div className="flex items-center gap-2">
                  <Skeleton width={90} height={14} />
                  <Skeleton width={120} height={12} style={{ marginLeft: "auto" }} />
                </div>
                <Skeleton width="100%" height={6} radius={3} />
                <Skeleton width="60%" height={11} />
              </div>
            ))
          : disks.map((disk) => (
              <motion.div key={disk.mount} {...RISE} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-glass-border bg-glass-veil px-4 py-3.5 shadow-widget">
                <div className="flex items-center gap-2">
                  <span className="text-[14.5px] font-semibold">{diskName(disk.mount)}</span>
                  <div className="flex-1" />
                  <Truncate text={`${formatGb(disk.free_bytes)} free of ${formatGb(disk.total_bytes)}`} className="max-w-[62%] text-[12.5px] text-ink-muted" />
                </div>
                <span className="block h-1.5 overflow-hidden rounded-[3px] bg-rule">
                  <span className="block h-full rounded-[3px]" style={{ width: `${disk.used_percent}%`, background: loadTone(disk.used_percent) }} />
                </span>
                <span data-selectable className="min-w-0">
                  <Truncate text={[disk.model, disk.transport, disk.mount].filter((part) => part !== undefined).join(" · ")} className="ui-mono text-[11.5px]" />
                </span>
              </motion.div>
            ))}
      </div>
    </>
  );
}

/** The devices on dadi, one row each with its address and whether it is online, was seen lately or is waiting to join. */
function Devices() {
  const { state: connection } = useConnection();
  const query = useQuery({ queryKey: ["nas", "clients"], queryFn: () => nas.listClients(), enabled: isMeshOnline(connection), refetchInterval: POLL_MS });
  const state = useModuleState(query, (answer) => answer.clients.length === 0);
  const clients = state.kind === "ready" ? state.data.clients : [];
  let body: ReactNode;
  if (state.kind === "loading") {
    body = [0, 1, 2].map((i) => (
      <div key={i} className={`flex min-h-12 items-center gap-3 ${i > 0 ? "border-t border-rule" : ""}`}>
        <Skeleton width={9} height={9} radius={5} />
        <Skeleton width={70} height={14} />
        <Skeleton width="40%" height={12} />
        <Skeleton width={52} height={12} style={{ marginLeft: "auto" }} />
      </div>
    ));
  } else if (state.kind === "ready") {
    body = clients.map((client, i) => (
      <motion.div key={client.node_name} {...RISE} className={`flex min-h-12 items-center gap-3 py-2 ${i > 0 ? "border-t border-rule" : ""}`}>
        <span className={`size-[9px] flex-none rounded-full ${client.online ? "bg-sage" : client.pending ? "bg-clay" : "bg-ink-ghost"}`} />
        <span data-selectable title={client.node_name} className="max-w-[40%] min-w-0 flex-none text-[14.5px] font-semibold [overflow-wrap:anywhere]">
          {client.node_name}
        </span>
        <span data-selectable className="min-w-0 flex-1">
          <Truncate text={client.ip_addresses[0] ?? "no address yet"} className="ui-mono" />
        </span>
        {client.pending ? (
          <Badge status="idle" label="pending" />
        ) : (
          <span className={`text-[12.5px] whitespace-nowrap ${client.online ? "font-semibold text-sage-text" : "text-ink-muted"}`}>
            {client.online ? "Online" : client.last_seen === null ? "Offline" : `Seen ${formatAge(client.last_seen)} ago`}
          </span>
        )}
      </motion.div>
    ));
  } else if (state.kind === "empty") {
    body = <div className="py-3.5 text-[13.5px] text-ink-muted">No devices have joined dadi yet.</div>;
  } else if (state.kind === "offline") {
    body = <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />;
  } else {
    body = <StateView kind="error" title="Nas couldn’t list the devices" {...failureProps(state.error)} detail="GET /clients failed; the rest of this page is current." onRetry={() => void query.refetch()} />;
  }
  return (
    <>
      <SectionLabel right={state.kind === "ready" ? <span className="text-[12.5px] text-ink-muted">{`${clients.filter((client) => client.online).length} online`}</span> : null}>Devices on dadi</SectionLabel>
      <Card style={{ padding: "4px 16px", borderRadius: 16 }}>{body}</Card>
    </>
  );
}

/**
 * Split system view: the health card, services, drives, devices and helper tasks in one column, the log explorer in a
 * card beside it, or under the cards when the page is narrow. `?service=&q=&at=` (from an error toast) focuses the logs
 * on that line, and a service chip focuses them on that service.
 */
export function SystemPage() {
  const { state: connection } = useConnection();
  const [params] = useSearchParams();
  const location = useLocation();
  const [chip, setChip] = useState<LogFocus | null>(null);

  const statusQuery = useQuery({ queryKey: ["nas", "status"], queryFn: () => nas.getStatus(), enabled: isMeshOnline(connection), refetchInterval: POLL_MS });
  const state = useModuleState(statusQuery, () => false);

  const service = params.get("service");
  const at = params.get("at");
  const fromToast: LogFocus | null = service && at ? { service, q: params.get("q") || "", at, key: location.key } : null;
  const focus = chip ?? fromToast;
  const pick = (name: string) => setChip({ service: name, q: "", at: new Date().toISOString(), key: crypto.randomUUID() });

  const status = state.kind === "ready" ? state.data : null;
  const failure = state.kind === "error" || state.kind === "module-offline" ? failureProps(state.error) : null;
  return (
    <Page name="system">
      {(room) => {
        const stack = room.width < STACK_BELOW;
        return (
          <>
            <PageHeader title="System" meta={status === null ? undefined : `Up ${formatUptime(status.uptime_seconds)}`} />
            <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-4">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="scroll min-h-0 min-w-0 flex-1 pr-1" data-vp="1">
                  <div className="flex flex-col gap-3" data-shift="1">
                    <AnimatePresence mode="wait" initial={false}>
                      {state.kind === "loading" || state.kind === "ready" ? (
                        <motion.div key="cards" {...FADE} className="flex flex-col gap-3">
                          {state.kind === "ready" && state.stale !== null && connection === "connected" ? <StaleBanner text={`Showing what Nas reported ${formatRelative(new Date(state.stale.since).toISOString())}`} onRetry={() => void statusQuery.refetch()} /> : null}
                          <HealthCard status={status} />
                          <Services status={status} onPick={pick} />
                          <Drives status={status} />
                          <Devices />
                          <TasksBlock />
                          <ErrorsBlock onOpen={(card) => setChip(errorFocus(card, crypto.randomUUID()))} />
                        </motion.div>
                      ) : (
                        <motion.div key="failed" {...FADE}>
                          <Card style={{ flex: 1 }}>
                            {failure === null ? (
                              <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />
                            ) : (
                              <StateView kind="error" title="Nas failed to answer" {...failure} onRetry={() => void statusQuery.refetch()} />
                            )}
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {stack ? (
                      <div className="flex">
                        <LogsCard focus={focus} flat />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {stack ? null : (
                <div className="flex min-h-0 flex-none flex-col" style={{ width: Math.min(LOGS_MAX, room.width * LOGS_SHARE) }}>
                  <LogsCard focus={focus} />
                </div>
              )}
            </div>
          </>
        );
      }}
    </Page>
  );
}

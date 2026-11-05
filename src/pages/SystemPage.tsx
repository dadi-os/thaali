import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { isMeshOnline, nas } from "../shared/api";
import type { NasStatus } from "../shared/api/nas";
import { Badge } from "../shared/ui/Badge";
import { Card } from "../shared/ui/Card";
import { StateView, StaleBanner } from "../shared/states/ModuleState";
import { Skeleton } from "../shared/ui/Skeleton";
import { Truncate } from "../shared/ui/Truncate";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { useSize } from "../shared/hooks/useSize";
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {status === null
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 16px", borderRadius: 16, border: "1px solid var(--glass-border)", background: "var(--glass-veil)" }}>
                <Skeleton width={10} height={10} radius={5} />
                <Skeleton width={80} height={14} />
                <Skeleton width={52} height={12} style={{ marginLeft: "auto" }} />
              </div>
            ))
          : status.services.map((service) => (
              <button
                key={service.name}
                type="button"
                className="ui-trans ui-hover-card"
                title={`Show ${service.name}’s log lines`}
                onClick={() => onPick(service.name)}
                style={{ display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 16px", borderRadius: 16, background: "var(--glass-veil)", border: `1px solid ${service.healthy ? "var(--glass-border)" : "var(--error-line)"}`, boxShadow: "var(--shadow)", minWidth: 0 }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: service.healthy ? "var(--sage)" : "var(--error)", flex: "none" }} />
                <Truncate text={capitalize(service.name)} style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }} />
                <span style={{ fontSize: 12.5, color: service.healthy ? "var(--ink-muted)" : "var(--error)", whiteSpace: "nowrap" }}>{service.healthy ? "Healthy" : "Offline"}</span>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {disks === null
          ? Array.from({ length: 2 }, (_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderRadius: 16, background: "var(--glass-veil)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow)", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Skeleton width={90} height={14} />
                  <Skeleton width={120} height={12} style={{ marginLeft: "auto" }} />
                </div>
                <Skeleton width="100%" height={6} radius={3} />
                <Skeleton width="60%" height={11} />
              </div>
            ))
          : disks.map((disk) => (
              <div key={disk.mount} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderRadius: 16, background: "var(--glass-veil)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow)", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{diskName(disk.mount)}</span>
                  <div style={{ flex: 1 }} />
                  <Truncate text={`${formatGb(disk.free_bytes)} free of ${formatGb(disk.total_bytes)}`} style={{ fontSize: 12.5, color: "var(--ink-muted)", maxWidth: "62%" }} />
                </div>
                <span style={{ display: "block", height: 6, borderRadius: 3, background: "var(--rule)", overflow: "hidden" }}>
                  <span style={{ display: "block", height: "100%", width: `${disk.used_percent}%`, background: loadTone(disk.used_percent), borderRadius: 3 }} />
                </span>
                <Truncate text={[disk.model, disk.transport, disk.mount].filter((part) => part !== undefined).join(" · ")} className="ui-mono" style={{ fontSize: 11.5 }} />
              </div>
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
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, borderTop: i > 0 ? "1px solid var(--rule)" : "none" }}>
        <Skeleton width={9} height={9} radius={5} />
        <Skeleton width={70} height={14} />
        <Skeleton width="40%" height={12} />
        <Skeleton width={52} height={12} style={{ marginLeft: "auto" }} />
      </div>
    ));
  } else if (state.kind === "ready") {
    body = clients.map((client, i) => (
      <div key={client.node_name} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48, borderTop: i > 0 ? "1px solid var(--rule)" : "none" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: client.online ? "var(--sage)" : client.pending ? "var(--clay)" : "var(--ink-ghost)", flex: "none" }} />
        <Truncate text={client.node_name} style={{ fontSize: 14.5, fontWeight: 600, width: 70, flex: "none" }} />
        <Truncate text={client.ip_addresses[0] ?? "no address yet"} className="ui-mono" style={{ flex: 1, minWidth: 0 }} />
        {client.pending ? (
          <Badge status="idle" label="pending" />
        ) : (
          <span style={{ fontSize: 12.5, color: client.online ? "var(--sage-text)" : "var(--ink-muted)", whiteSpace: "nowrap", fontWeight: client.online ? 600 : 400 }}>
            {client.online ? "Online" : client.last_seen === null ? "Offline" : `Seen ${formatAge(client.last_seen)} ago`}
          </span>
        )}
      </div>
    ));
  } else if (state.kind === "empty") {
    body = <div style={{ padding: "14px 0", fontSize: 13.5, color: "var(--ink-muted)" }}>No devices have joined dadi yet.</div>;
  } else if (state.kind === "offline") {
    body = <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />;
  } else {
    body = <StateView kind="error" title="Nas couldn’t list the devices" {...failureProps(state.error)} detail="GET /clients failed; the rest of this page is current." onRetry={() => void query.refetch()} />;
  }
  return (
    <>
      <SectionLabel right={state.kind === "ready" ? <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{`${clients.filter((client) => client.online).length} online`}</span> : null}>Devices on dadi</SectionLabel>
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
  const [root, { width }] = useSize<HTMLDivElement>();

  const statusQuery = useQuery({ queryKey: ["nas", "status"], queryFn: () => nas.getStatus(), enabled: isMeshOnline(connection), refetchInterval: POLL_MS });
  const state = useModuleState(statusQuery, () => false);

  const service = params.get("service");
  const at = params.get("at");
  const fromToast: LogFocus | null = service && at ? { service, q: params.get("q") || "", at, key: location.key } : null;
  const focus = chip ?? fromToast;
  const pick = (name: string) => setChip({ service: name, q: "", at: new Date().toISOString(), key: crypto.randomUUID() });

  const status = state.kind === "ready" ? state.data : null;
  const stack = width > 0 && width < STACK_BELOW;
  const failure = state.kind === "error" || state.kind === "module-offline" ? failureProps(state.error) : null;
  return (
    <div ref={root} data-page="system" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, padding: "18px 20px 20px", gap: 14, minHeight: 0 }}>
      <PageHeader title="System" meta={status === null ? undefined : `Up ${formatUptime(status.uptime_seconds)}`} />
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, gap: 16, minHeight: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div
            className="scroll"
            data-vp="1"
            style={{ flex: 1, minHeight: 0, minWidth: 0, paddingRight: 4, maskImage: "linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 20px), transparent 100%)", WebkitMaskImage: "linear-gradient(180deg, transparent 0, #000 14px, #000 calc(100% - 20px), transparent 100%)" }}
          >
            <div data-shift="1" style={{ marginTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {state.kind === "loading" || state.kind === "ready" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {state.kind === "ready" && state.stale !== null && connection === "connected" ? <StaleBanner text={`Showing what Nas reported ${formatRelative(new Date(state.stale.since).toISOString())}`} onRetry={() => void statusQuery.refetch()} /> : null}
                  <HealthCard status={status} />
                  <Services status={status} onPick={pick} />
                  <Drives status={status} />
                  <Devices />
                  <TasksBlock />
                  <ErrorsBlock onOpen={(card) => setChip(errorFocus(card, crypto.randomUUID()))} />
                </div>
              ) : (
                <Card style={{ flex: 1 }}>
                  {failure === null ? (
                    <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />
                  ) : (
                    <StateView kind="error" title="Nas failed to answer" {...failure} onRetry={() => void statusQuery.refetch()} />
                  )}
                </Card>
              )}
              {stack ? (
                <div style={{ display: "flex" }}>
                  <LogsCard focus={focus} flat />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {stack ? null : (
          <div style={{ width: Math.min(LOGS_MAX, width * LOGS_SHARE), display: "flex", flexDirection: "column", minHeight: 0, flex: "none" }}>
            <LogsCard focus={focus} />
          </div>
        )}
      </div>
    </div>
  );
}

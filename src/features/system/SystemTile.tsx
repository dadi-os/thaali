import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, nas } from "../../shared/api";
import type { NasStatus, NasTask } from "../../shared/api/nas";
import { Badge } from "../../shared/ui/Badge";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { NameTruncate, Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { diskName } from "./HealthCard";

/** Where a task stands in the tile's list: working first, then what is waiting on its agent, then the rest. */
const TASK_ORDER: Record<NasTask["status"], number> = { working: 0, paused: 0, asking: 1, idle: 2, asleep: 3 };

type Meter = { name: string; percent: number };

/** The meters Nas reported, CPU then memory then GPU then each disk; one it did not report is left out. */
function metersOf(status: NasStatus): Meter[] {
  const meters: Meter[] = [];
  if (status.cpu) {
    meters.push({ name: "CPU", percent: status.cpu.used_percent });
  }
  if (status.memory) {
    meters.push({ name: "Memory", percent: status.memory.used_percent });
  }
  const gpu = status.gpu?.[0];
  if (gpu?.used_percent !== undefined) {
    meters.push({ name: "GPU", percent: gpu.used_percent });
  }
  for (const disk of status.disks ?? []) {
    meters.push({ name: diskName(disk.mount), percent: disk.used_percent });
  }
  return meters;
}

type BodyProps = {
  status: NasStatus;
  tasks: NasTask[];
  clients: Array<{ node_name: string; online: boolean; pending?: boolean }>;
  geometry: TileGeometry;
};

/** A chip per module, as many meters as fit, the helper tasks that fit, and the devices on dadi when the tile is tall. */
function Body({ status, tasks, clients, geometry }: BodyProps) {
  const meters = metersOf(status);
  const columns = geometry.iw >= 300 ? 3 : 2;
  const serviceRows = Math.ceil(status.services.length / columns);
  const servicesHeight = 28 * serviceRows + 8 * (serviceRows - 1);
  const withDevices = geometry.bh >= 300;
  const available = geometry.bh - servicesHeight - 12 - (withDevices ? 24 + 12 : 0);
  const count = Math.max(1, Math.min(meters.length, Math.floor((available + 11) / 40)));
  const left = available - (count * 29 + (count - 1) * 11) - 12 - 24;
  const taskRows = tasks.length > 0 ? Math.max(0, Math.min(3, Math.floor(left / 28))) : 0;
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, justifyContent: "space-between" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gap: 8, flex: "none" }}>
        {status.services.map((service) => (
          <div key={service.name} style={{ display: "flex", alignItems: "center", gap: 7, height: 28, padding: "0 10px", borderRadius: 999, justifyContent: "center", background: service.healthy ? "var(--sage-fill)" : "var(--error-fill)", color: service.healthy ? "var(--sage-text)" : "var(--error)", fontSize: 13, fontWeight: 500, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: service.healthy ? "var(--sage)" : "var(--error)", flex: "none" }} />
            <Truncate text={service.name} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: "none" }}>
        {meters.slice(0, count).map((meter) => (
          <div key={meter.name} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0 }}>{meter.name}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{`${Math.round(meter.percent)}%`}</span>
            </div>
            <span style={{ display: "block", height: 5, borderRadius: 3, background: "var(--rule)", overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.min(100, meter.percent)}%`, background: meter.percent > 75 ? "var(--clay)" : "var(--sage)", borderRadius: 3, transformOrigin: "left", animation: "grow 550ms var(--ease) both" }} />
            </span>
          </div>
        ))}
      </div>
      {taskRows > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: "none", minHeight: 0 }}>
          <span className="ui-label" style={{ fontSize: 11, height: 24 }}>Tasks</span>
          {[...tasks]
            .sort((a, b) => TASK_ORDER[a.status] - TASK_ORDER[b.status])
            .slice(0, taskRows)
            .map((task) => (
              <div key={task.task} style={{ display: "flex", alignItems: "center", gap: 8, height: 28 }}>
                <span style={{ color: "var(--ink-muted)", display: "flex" }}>
                  <Icon name={task.kind === "browser" ? "browser" : "terminal"} size={14} />
                </span>
                <NameTruncate name={task.owner} style={{ flex: 1, minWidth: 0, fontSize: 13.5 }} />
                <Badge status={task.status} />
              </div>
            ))}
        </div>
      ) : null}
      {withDevices ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, height: 24, flex: "none", fontSize: 12.5, color: "var(--ink-muted)", overflow: "hidden" }}>
          {clients.map((client) => (
            <div key={client.node_name} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: client.online ? "var(--sage)" : client.pending ? "var(--clay)" : "var(--ink-ghost)", flex: "none" }} />
              {client.node_name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Home's System tile: which modules answer, how loaded the box is, the helper tasks running on it and the devices on dadi. */
export function SystemTile({ order }: { order: number }) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const statusQuery = useQuery({ queryKey: ["nas", "status"], queryFn: () => nas.getStatus(), enabled: connected, refetchInterval: POLL_MS });
  const clientsQuery = useQuery({ queryKey: ["nas", "clients"], queryFn: () => nas.listClients(), enabled: connected, refetchInterval: POLL_MS });
  const tasksQuery = useQuery({ queryKey: ["nas", "tasks"], queryFn: () => nas.listTasks(), enabled: connected });
  const statusState = useModuleState(statusQuery, () => false);
  const clientsState = useModuleState(clientsQuery, () => false);
  const tasksState = useModuleState(tasksQuery, () => false);
  const reads = [
    { state: statusState, query: statusQuery, request: "GET /status" },
    { state: clientsState, query: clientsQuery, request: "GET /clients" },
    { state: tasksState, query: tasksQuery, request: "GET /tasks" },
  ];
  const failed = reads.find((read) => read.state.kind === "error" || read.state.kind === "module-offline");
  const shown = failed ?? reads[0]!;
  const ready = statusState.kind === "ready" && clientsState.kind === "ready" && tasksState.kind === "ready";
  const down = statusState.kind === "ready" ? statusState.data.services.filter((service) => !service.healthy).length : 0;
  return (
    <Tile
      area="system"
      title="System"
      to="/system"
      order={order}
      summary={ready ? (down === 0 ? "All healthy" : `${down} down`) : undefined}
      loading={failed === undefined && !ready && shown.state.kind === "loading"}
      notice={failed === undefined && !ready && shown.state.kind === "loading" ? null : tileNotice(shown.state, { name: "Nas", request: shown.request, empty: ["Nothing reported", ""] }, () => void shown.query.refetch())}
      skeleton={(g) => (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} width="100%" height={28} radius={999} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: Math.max(3, Math.min(5, Math.floor((g.bh - 130) / 36))) }, (_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton width="100%" height={12} />
                <Skeleton width="100%" height={5} />
              </div>
            ))}
          </div>
        </div>
      )}
    >
      {(g) => (statusState.kind === "ready" && clientsState.kind === "ready" && tasksState.kind === "ready" ? <Body status={statusState.data} tasks={tasksState.data} clients={clientsState.data.clients} geometry={g} /> : null)}
    </Tile>
  );
}

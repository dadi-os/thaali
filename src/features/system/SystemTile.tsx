import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, nas } from "../../shared/api";
import type { NasStatus, NasTask } from "../../shared/api/nas";
import { Badge } from "../../shared/ui/Badge";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { AgentName } from "../../shared/ui/AgentName";
import { Truncate } from "../../shared/ui/Truncate";
import { ChipRow, MeterRow, SectionHeader, StatusChip, TileList, TileRow } from "../../shared/components/Module";
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
  const servicesHeight = 32 * serviceRows + 8 * (serviceRows - 1);
  const withDevices = geometry.bh >= 300;
  const available = geometry.bh - servicesHeight - 12 - (withDevices ? 32 + 12 : 0);
  const count = Math.max(1, Math.min(meters.length, Math.floor((available + 12) / 42)));
  const left = available - (count * 30 + (count - 1) * 12) - 12 - 24;
  const taskRows = tasks.length > 0 ? Math.max(0, Math.min(3, Math.floor(left / 28))) : 0;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-between gap-3">
      <div className="grid flex-none gap-2" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
        {status.services.map((service) => (
          <StatusChip key={service.name} fill tone={service.healthy ? "sage" : "error"} title={service.healthy ? `${service.name} is healthy` : `${service.name} is down`}>
            <Truncate text={service.name} />
          </StatusChip>
        ))}
      </div>
      <div className="flex flex-none flex-col gap-3">
        {meters.slice(0, count).map((meter) => (
          <MeterRow key={meter.name} label={meter.name} value={`${Math.round(meter.percent)}%`} percent={meter.percent} />
        ))}
      </div>
      {taskRows > 0 ? (
        <div className="flex min-h-0 flex-none flex-col">
          <SectionHeader title="Tasks" />
          <TileList>
            {[...tasks]
              .sort((a, b) => TASK_ORDER[a.status] - TASK_ORDER[b.status])
              .slice(0, taskRows)
              .map((task) => (
                <TileRow key={task.task} size="sm" ruled={false} lead={<Icon name={task.kind === "browser" ? "browser" : "terminal"} size={14} />} trail={<Badge status={task.status} />}>
                  <AgentName name={task.owner} selectable={false} className="truncate" />
                </TileRow>
              ))}
          </TileList>
        </div>
      ) : null}
      {withDevices ? (
        <ChipRow wrap>
          {clients.map((client) => (
            <StatusChip key={client.node_name} tone={client.online ? "sage" : client.pending ? "clay" : "quiet"} title={`${client.node_name}: ${client.online ? "online" : client.pending ? "waiting to join" : "offline"}`}>
              {client.node_name}
            </StatusChip>
          ))}
        </ChipRow>
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
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} width="100%" height={32} radius={999} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: Math.max(3, Math.min(5, Math.floor((g.bh - 130) / 36))) }, (_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton width="100%" height={16} />
                <Skeleton width="100%" height={6} />
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

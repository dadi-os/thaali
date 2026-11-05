import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, nas } from "../../shared/api";
import type { NasStatus, NasTask } from "../../shared/api/nas";
import { Badge } from "../../shared/ui/Badge";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { AgentName } from "../../shared/ui/AgentName";
import { MeterRow, SectionHeader, StatusChip, TileList, TileRow } from "../../shared/components/Module";
import { Measured } from "../../shared/layout/Measured";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { diskName } from "./HealthCard";

/** Where a task stands in the tile's list: working first, then what is waiting on its agent, then the rest. */
const TASK_ORDER: Record<NasTask["status"], number> = { working: 0, paused: 0, asking: 1, idle: 2, asleep: 3 };

type Meter = { name: string; percent: number };

/** A task row's height. */
const TASK_ROW = 28;
/** The gap between the tile's blocks. */
const BLOCK_GAP = 16;

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

/** "All healthy", or the names of the modules that are down: "Gmail down", "Gmail, Chaavi down". */
export function healthSummary(status: NasStatus): string {
  const down = status.services.filter((service) => !service.healthy).map((service) => service.name);
  return down.length === 0 ? "All healthy" : `${down.join(", ")} down`;
}

/** As many meters as fit, the helper tasks that fit after them, and the devices on dadi in a footer that scrolls sideways. */
function Body({ status, tasks, clients, geometry }: BodyProps) {
  const meters = metersOf(status).slice(0, Math.max(1, Math.min(4, Math.floor((geometry.bh + 12) / 42))));
  const sorted = [...tasks].sort((a, b) => TASK_ORDER[a.status] - TASK_ORDER[b.status]);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ gap: BLOCK_GAP }}>
      <div className="flex flex-none flex-col gap-3">
        {meters.map((meter) => (
          <MeterRow key={meter.name} label={meter.name} value={`${Math.round(meter.percent)}%`} percent={meter.percent} />
        ))}
      </div>
      {sorted.length > 0 ? (
        <Measured style={{ overflow: "hidden" }}>
          {(size) => (
            <div className="flex flex-col">
              <SectionHeader title="Tasks" count={sorted.length} />
              <TileList>
                {sorted.slice(0, Math.max(0, Math.floor((size.height - 24) / TASK_ROW))).map((task) => (
                  <TileRow key={task.task} size="sm" ruled={false} lead={<Icon name={task.kind === "browser" ? "browser" : "terminal"} size={14} />} trail={<Badge status={task.status} />}>
                    <AgentName name={task.owner} selectable={false} className="truncate" />
                  </TileRow>
                ))}
              </TileList>
            </div>
          )}
        </Measured>
      ) : (
        <div className="flex-1" />
      )}
      <div className="scroll flex flex-none items-center gap-2 overflow-x-auto border-t border-rule pt-3" style={{ height: 32 + 13 }} onClick={(event) => event.preventDefault()}>
        {clients.length === 0 ? <span className="text-[13px] text-ink-muted">No devices on dadi</span> : null}
        {clients.map((client) => (
          <StatusChip rigid key={client.node_name} tone={client.online ? "sage" : client.pending ? "clay" : "quiet"} title={`${client.node_name}: ${client.online ? "online" : client.pending ? "waiting to join" : "offline"}`}>
            {client.node_name}
          </StatusChip>
        ))}
      </div>
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
  return (
    <Tile
      area="system"
      title="System"
      to="/system"
      order={order}
      summary={statusState.kind === "ready" && ready ? healthSummary(statusState.data) : undefined}
      loading={failed === undefined && !ready && shown.state.kind === "loading"}
      notice={failed === undefined && !ready && shown.state.kind === "loading" ? null : tileNotice(shown.state, { name: "Nas", request: shown.request, empty: ["Nothing reported", ""] }, () => void shown.query.refetch())}
      skeleton={(g) => (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-3">
            {Array.from({ length: Math.max(3, Math.min(5, Math.floor((g.bh - 40) / 36))) }, (_, i) => (
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

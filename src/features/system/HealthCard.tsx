import type { NasStatus } from "../../shared/api/nas";
import { Card } from "../../shared/components/Card";
import { Icon } from "../../shared/components/Icon";
import { Skeleton } from "../../shared/components/Skeleton";
import { Truncate } from "../../shared/components/Truncate";
import { formatGb, formatUptime, loadTone } from "./format";

/** The circumference of a gauge's ring, which is drawn at radius 38 in a 96 unit box. */
const RING = 2 * Math.PI * 38;

export type GaugeProps = {
  name: string;
  /** How full the meter is, 0 to 100. */
  percent: number;
  /** What is measured, such as the device's name or how much is free. */
  detail: string;
};

/** One ring meter: the percentage in its middle, the meter's name and a line of detail under it. */
function Gauge({ name, percent, detail }: GaugeProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: 92, height: 92 }}>
        <svg width="92" height="92" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r="38" fill="none" stroke="#e8ece2" strokeWidth="9" />
          <circle
            cx="48"
            cy="48"
            r="38"
            fill="none"
            style={{ stroke: loadTone(percent) }}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={RING.toFixed(1)}
            strokeDashoffset={(RING * (1 - percent / 100)).toFixed(1)}
            transform="rotate(-90 48 48)"
          />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{`${Math.round(percent)}%`}</span>
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{name}</span>
      <Truncate text={detail} style={{ fontSize: 12, color: "var(--ink-muted)", maxWidth: "100%", textAlign: "center" }} />
    </div>
  );
}

/** What a disk is called on the page: the system disk, the home disk, or the path it is mounted at. */
export function diskName(mount: string): string {
  if (mount === "/sysroot") {
    return "System disk";
  }
  return mount === "/var/home" || mount === "/home" ? "Home disk" : mount;
}

/** The meters Nas reported, in the order CPU, memory, GPU, then each disk; one it did not report is left out. */
function gauges(status: NasStatus): GaugeProps[] {
  const out: GaugeProps[] = [];
  if (status.cpu) {
    out.push({ name: "CPU", percent: status.cpu.used_percent, detail: status.cpu.name });
  }
  if (status.memory) {
    out.push({ name: "Memory", percent: status.memory.used_percent, detail: `${formatGb(status.memory.used_bytes)} / ${formatGb(status.memory.total_bytes)}` });
  }
  const gpu = status.gpu?.[0];
  if (gpu?.used_percent !== undefined) {
    out.push({ name: "GPU", percent: gpu.used_percent, detail: gpu.name });
  }
  for (const disk of status.disks ?? []) {
    out.push({ name: diskName(disk.mount), percent: disk.used_percent, detail: `${formatGb(disk.free_bytes)} free of ${formatGb(disk.total_bytes)}` });
  }
  return out;
}

export type HealthCardProps = {
  /** Nas's status, or null while the first answer is on its way. */
  status: NasStatus | null;
};

/** How dadi is: a headline that says healthy or how many services need attention, its uptime, and a ring for each meter Nas reports. */
export function HealthCard({ status }: HealthCardProps) {
  if (status === null) {
    return (
      <Card style={{ padding: 20, gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Skeleton width={40} height={40} radius={20} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton width={210} height={24} />
            <Skeleton width={140} height={12} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Skeleton width={92} height={92} radius={46} />
              <Skeleton width={60} height={12} />
              <Skeleton width={80} height={10} />
            </div>
          ))}
        </div>
      </Card>
    );
  }
  const down = status.services.filter((service) => !service.healthy).length;
  return (
    <Card style={{ padding: 20, gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 40, height: 40, borderRadius: "50%", background: down > 0 ? "var(--error)" : "var(--sage-deep)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bone)", flex: "none" }}>
          <Icon name={down > 0 ? "alert" : "check"} size={20} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 2 }}>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{down > 0 ? `${down} ${down === 1 ? "service needs" : "services need"} attention` : "dadi is healthy"}</span>
          <span style={{ fontSize: 13.5, color: "var(--ink-muted)" }}>{`Up ${formatUptime(status.uptime_seconds)}`}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {gauges(status).map((gauge) => (
          <Gauge key={`${gauge.name}-${gauge.detail}`} {...gauge} />
        ))}
      </div>
    </Card>
  );
}

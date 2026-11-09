import type { NasStatus } from "../../shared/api/nas";
import { Card } from "../../shared/ui/Card";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { formatGb, formatUptime, loadTone } from "./format";

/** The length a gauge's ring is measured in (its `pathLength`), so a dash of `p` units is `p` percent of it whatever the radius. */
const FULL = 100;

export type GaugeProps = {
  name: string;
  /** How full the meter is, 0 to 100. */
  percent: number;
  /** What is measured, such as the device's name or how much is free. */
  detail: string;
};

/** One ring meter: the percentage in its middle, the meter's name and a line of detail under it. */
function Gauge({ name, percent, detail }: GaugeProps) {
  const filled = Math.min(FULL, Math.max(0, percent));
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <div className="relative size-[92px]">
        <svg width="92" height="92" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r="38" fill="none" stroke="var(--sage)" strokeOpacity="0.16" strokeWidth="9" />
          <circle
            cx="48"
            cy="48"
            r="38"
            fill="none"
            pathLength={FULL}
            style={{ stroke: loadTone(percent), opacity: filled > 0 ? 1 : 0, transition: "stroke-dasharray var(--slower) var(--ease), stroke var(--slow) var(--ease), opacity var(--slow) var(--ease)" }}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${FULL}`}
            shapeRendering="geometricPrecision"
            transform="rotate(-90 48 48)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[18px] font-semibold tabular-nums">{`${Math.round(percent)}%`}</span>
      </div>
      <span className="text-[14px] font-medium">{name}</span>
      <span data-selectable className="max-w-full min-w-0">
        <Truncate text={detail} className="text-center text-[12px] text-ink-muted" />
      </span>
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
        <div className="flex items-center gap-3.5">
          <Skeleton width={40} height={40} radius={20} />
          <div className="flex flex-col gap-2">
            <Skeleton width={210} height={24} />
            <Skeleton width={140} height={12} />
          </div>
        </div>
        <div className="flex items-center justify-around">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
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
      <div className="flex items-center gap-3.5">
        <span className={`flex size-10 flex-none items-center justify-center rounded-full text-bone ${down > 0 ? "bg-error" : "bg-sage-deep"}`}>
          <Icon name={down > 0 ? "alert" : "check"} size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[24px] font-semibold tracking-[-0.02em]">{down > 0 ? `${down} ${down === 1 ? "service needs" : "services need"} attention` : "dadi is healthy"}</span>
          <span className="text-[14px] text-ink-muted">{`Up ${formatUptime(status.uptime_seconds)}`}</span>
        </div>
      </div>
      <div className="flex items-start gap-2">
        {gauges(status).map((gauge) => (
          <Gauge key={`${gauge.name}-${gauge.detail}`} {...gauge} />
        ))}
      </div>
    </Card>
  );
}

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { isMeshOnline, nas } from "../../shared/api";
import type { NasStatus } from "../../shared/api/nas";
import { ErrorLogCards } from "../logs/LogExplorer";
import { StateView } from "../../shared/components/states";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";

export type SystemMapProps = {
  className?: string;
};

const SERVICE_ORDER = [
  "dwar",
  "yaad",
  "hath",
  "ghar",
  "chaavi",
  "nas",
  "thaali",
] as const;

function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i += 1;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function diskVolumePct(free: number, total: number, usedPercent?: number): number {
  if (typeof usedPercent === "number" && Number.isFinite(usedPercent)) {
    return Math.min(100, Math.max(0, usedPercent));
  }
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, (1 - free / total) * 100);
}

function diskDisplayName(d: {
  name: string;
  model?: string;
  transport?: string;
  mount: string;
}): string {
  if (d.model && d.model.trim()) {
    return d.model.trim();
  }
  if (d.transport) {
    return `${d.name} (${d.transport})`;
  }
  return d.name;
}

/** Every module with whether it answers, in the house order, Nas first among its peers. */
export function serviceHealth(status: NasStatus): Array<{ name: string; ok: boolean }> {
  const byName = new Map(status.services.map((s) => [s.name, s.healthy]));
  byName.set("nas", true);
  const seen = new Set<string>();
  const rows: Array<{ name: string; ok: boolean }> = [];
  for (const name of SERVICE_ORDER) {
    if (name === "nas" || byName.has(name)) {
      rows.push({ name, ok: byName.get(name) ?? false });
      seen.add(name);
    }
  }
  for (const s of status.services) {
    if (!seen.has(s.name)) {
      rows.push({ name: s.name, ok: s.healthy });
    }
  }
  return rows;
}

/** One load meter: what it measures, its device name, how full it is and a detail line. */
export type ResourceRow = {
  key: string;
  kind: string;
  name: string;
  pct: number | null;
  detail?: string;
};

/** CPU, memory, GPU and disk meters from Nas's status, in that order. */
export function resourceRows(status: NasStatus): ResourceRow[] {
  const rows: ResourceRow[] = [];
  if (status.cpu) {
    rows.push({
      key: "cpu",
      kind: "CPU",
      name: status.cpu.name,
      pct: status.cpu.used_percent,
    });
  }
  if (status.memory && status.memory.total_bytes > 0) {
    rows.push({
      key: "memory",
      kind: "Memory",
      name: status.memory.name || "System memory",
      pct: status.memory.used_percent,
      detail: `${formatBytes(status.memory.used_bytes)} / ${formatBytes(status.memory.total_bytes)}`,
    });
  }
  for (const [i, gpu] of (status.gpu ?? []).entries()) {
    rows.push({
      key: `gpu-${i}`,
      kind: "GPU",
      name: gpu.name,
      pct: gpu.used_percent ?? null,
    });
  }
  const volumes = status.disks?.length
    ? status.disks
    : status.disk.total_bytes > 0
      ? [
          {
            name: "state",
            mount: "/",
            free_bytes: status.disk.free_bytes,
            total_bytes: status.disk.total_bytes,
            used_percent: status.disk.used_percent ?? diskVolumePct(status.disk.free_bytes, status.disk.total_bytes),
          },
        ]
      : [];
  for (const d of volumes) {
    if (d.total_bytes <= 0) {
      continue;
    }
    rows.push({
      key: `disk-${d.name}`,
      kind: volumes.length > 1 ? shortDiskKind(d) : "Disk",
      name: diskDisplayName(d),
      pct: diskVolumePct(d.free_bytes, d.total_bytes, d.used_percent),
      detail: `${formatBytes(d.free_bytes)} free of ${formatBytes(d.total_bytes)} · ${d.mount}`,
    });
  }
  return rows;
}

function shortDiskKind(d: {
  name: string;
  transport?: string;
  mount: string;
}): string {
  if (d.mount === "/var/home" || d.mount === "/home") {
    return "Home";
  }
  if (d.mount === "/var" || d.mount === "/" || d.mount === "/sysroot") {
    return "System disk";
  }
  const t = (d.transport || "").toLowerCase();
  if (t === "nvme" || d.name.startsWith("nvme")) {
    return "NVMe";
  }
  return d.name.slice(0, 8);
}

/**
 * The System page's health column: the health card with its gauges, every module with
 * whether it answers, and the recent errors.
 */
export function SystemMap({ className }: SystemMapProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);

  const statusQuery = useQuery({
    queryKey: ["nas", "status"],
    queryFn: () => nas.getStatus(),
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  if (!connected && !statusQuery.data) {
    return <StateView tone="offline" label="dadi is offline" detail="Health comes back when the mesh reconnects" className={className} />;
  }

  if (statusQuery.isError && !statusQuery.data) {
    return (
      <StateView
        tone="error"
        label="Could not reach nas"
        error={statusQuery.error}
        onRetry={() => void statusQuery.refetch()}
        className={className}
      />
    );
  }

  if (!statusQuery.data) {
    return (
      <div role="status" aria-label="Reading health" className={`flex h-full min-h-0 flex-col gap-3 ${className ?? ""}`}>
        <span className="skeleton h-[170px] rounded-[var(--radius-window)]" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="skeleton h-3.5 w-1/2" />
        ))}
      </div>
    );
  }

  const status = statusQuery.data;
  const services = serviceHealth(status);
  const resources = resourceRows(status);

  return (
    <div className={`flex h-full min-h-0 flex-col gap-4 ${className ?? ""}`}>
      <HealthCard services={services} rows={resources} uptimeSeconds={status.uptime_seconds} />
      <ServiceRows services={services} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ErrorLogCards limit={6} />
      </div>
    </div>
  );
}

function ServiceRows({
  services,
}: {
  services: Array<{ name: string; ok: boolean }>;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {services.map((s, i) => (
        <motion.li
          key={s.name}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.03 }}
          className="flex items-center justify-between gap-3 border-b border-dashed border-rule/80 py-2 last:border-b-0"
        >
          <span className="text-[13px] text-ink">{s.name}</span>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] tracking-wide ${
              s.ok ? "text-sage-deep" : "text-ink-ghost"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                s.ok ? "bg-sage" : "border border-dashed border-ink-ghost"
              }`}
              aria-hidden
            />
            {s.ok ? "reachable" : "offline"}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

/** Ink for a load ring: sage while easy, clay past two thirds, error past 85%. */
function gaugeTone(pct: number): string {
  return pct > 85 ? "var(--error)" : pct > 65 ? "var(--clay)" : "var(--sage-deep)";
}

/** "Up 11 days, 4 hours" from Nas's uptime. */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const parts = [days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : null, `${hours} ${hours === 1 ? "hour" : "hours"}`];
  return `Up ${parts.filter(Boolean).join(", ")}`;
}

type HealthCardProps = {
  services: Array<{ name: string; ok: boolean }>;
  rows: ResourceRow[];
  uptimeSeconds: number;
};

/**
 * Khisso's health card on the desk: whether dadi is healthy (or how many modules are
 * offline) and how long it has been up, over a ring gauge per CPU, memory and disk that
 * fills in as it arrives and turns clay or error as the load climbs.
 */
function HealthCard({ services, rows, uptimeSeconds }: HealthCardProps) {
  const down = services.filter((s) => !s.ok).length;
  const circumference = 2 * Math.PI * 38;
  return (
    <section className="rounded-[var(--radius-window)] border border-[var(--glass-border)] bg-[var(--glass-sheet)] px-5 py-4 shadow-[var(--shadow)]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${down === 0 ? "bg-sage-deep" : "border border-dashed border-ink-ghost"}`}
        >
          {down === 0 ? (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="var(--bone)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[19px] font-semibold tracking-[-0.01em] text-ink">
            {down === 0 ? "dadi is healthy" : `${down} ${down === 1 ? "module is" : "modules are"} offline`}
          </span>
          <span className="text-[12.5px] text-ink-ghost">{formatUptime(uptimeSeconds)}</span>
        </span>
      </div>
      {rows.length > 0 ? (
        <ul className="mt-4 flex justify-around gap-3">
          {rows.map((row, i) => (
            <motion.li
              key={row.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.05 }}
              className="flex min-w-0 flex-col items-center gap-1.5"
              title={[row.name, row.detail].filter(Boolean).join(" · ")}
            >
              <span className="relative size-[84px]">
                <svg viewBox="0 0 96 96" className="size-full -rotate-90" aria-hidden>
                  <circle cx="48" cy="48" r="38" fill="none" stroke="var(--rule)" strokeWidth="9" />
                  {row.pct != null ? (
                    <motion.circle
                      cx="48"
                      cy="48"
                      r="38"
                      fill="none"
                      stroke={gaugeTone(row.pct)}
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference * (1 - Math.min(100, Math.max(0, row.pct)) / 100) }}
                      transition={{ duration: SLOW_S * 3, ease: EASE, delay: 0.1 + i * 0.06 }}
                    />
                  ) : null}
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[16px] font-semibold tabular-nums text-ink">
                  {row.pct == null ? "—" : `${Math.round(row.pct)}%`}
                </span>
              </span>
              <span className="text-[12px] font-medium text-ink-muted">{row.kind}</span>
              {row.detail ? <span className="max-w-[9rem] truncate text-[11px] text-ink-ghost">{row.detail}</span> : null}
            </motion.li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { isMeshOnline, nas } from "../../shared/api";
import type { NasStatus } from "../../shared/api/nas";
import { ErrorLogCards } from "../logs/LogExplorer";
import { StateView } from "../../shared/components/states";
import { useConnection } from "../../shared/hooks/useConnection";
import { useElementSize } from "./useElementSize";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";

export type SystemMapProps = {
  mode: "full" | "preview";
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

/** Density breakpoints for the System widget body. */
type SystemDensity = "pending" | "full" | "cards" | "inline";

function densityFor(size: { width: number; height: number }): SystemDensity {
  if (size.width === 0 || size.height === 0) {
    return "pending";
  }
  if (size.height < 220 || size.width < 160) {
    return "inline";
  }
  if (size.height < 320 || size.width < 220) {
    return "cards";
  }
  return "full";
}

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

type ResourceRow = {
  key: string;
  kind: string;
  name: string;
  pct: number | null;
  detail?: string;
};

function resourceRows(status: NasStatus): ResourceRow[] {
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
 * Dadi health. Preview is modules, mesh clients, and host meters.
 * Full mode is the left health column plus logs.
 */
export function SystemMap({ mode, className }: SystemMapProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const preview = mode === "preview";

  const statusQuery = useQuery({
    queryKey: ["nas", "status"],
    queryFn: () => nas.getStatus(),
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  const clientsQuery = useQuery({
    queryKey: ["nas", "clients"],
    queryFn: () => nas.listClients(),
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  if (!connected && !statusQuery.data) {
    return <StateView tone="offline" label="dadi is offline" detail="Health comes back when the mesh reconnects" compact={preview} className={className} />;
  }

  if (statusQuery.isError && !statusQuery.data) {
    return (
      <StateView
        tone="error"
        label="Could not reach nas"
        error={statusQuery.error}
        onRetry={() => void statusQuery.refetch()}
        compact={preview}
        className={className}
      />
    );
  }

  if (!statusQuery.data) {
    return (
      <div role="status" aria-label="Reading health" className={`flex h-full min-h-0 flex-col gap-3 ${preview ? "px-3.5 pt-2" : ""} ${className ?? ""}`}>
        {preview ? (
          <>
            <span className="skeleton h-2 w-16" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="skeleton h-3 w-3/4" />
              ))}
            </div>
            <span className="skeleton mt-auto mb-3 h-2 w-full" />
          </>
        ) : (
          <>
            <span className="skeleton h-[170px] rounded-[var(--radius-window)]" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="skeleton h-3.5 w-1/2" />
            ))}
          </>
        )}
      </div>
    );
  }

  const status = statusQuery.data;
  const services = serviceHealth(status);
  const resources = resourceRows(status);

  if (preview) {
    if (clientsQuery.isError && !clientsQuery.data) {
      return (
        <StateView
          tone="error"
          label="Could not list clients"
          error={clientsQuery.error}
          onRetry={() => void clientsQuery.refetch()}
          compact
          className={className}
        />
      );
    }
    if (clientsQuery.isLoading || !clientsQuery.data) {
      return (
        <SystemPreview
          className={className}
          services={services}
          resources={resources}
          clients={[]}
          clientsPending
        />
      );
    }
    return (
      <SystemPreview
        className={className}
        services={services}
        resources={resources}
        clients={clientsQuery.data.clients}
      />
    );
  }

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

function clientLabel(c: {
  pending: boolean;
  online: boolean;
}): string {
  if (c.pending) {
    return "waiting";
  }
  return c.online ? "online" : "offline";
}

function SystemPreview({
  className,
  services,
  resources,
  clients,
  clientsPending = false,
}: {
  className?: string;
  services: Array<{ name: string; ok: boolean }>;
  resources: ResourceRow[];
  clients: Array<{
    node_name: string;
    online: boolean;
    pending: boolean;
  }>;
  clientsPending?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(rootRef);
  const density = densityFor(size);
  const meters = resources
    .filter(
      (r) =>
        r.key === "cpu" || r.key === "memory" || r.key.startsWith("disk"),
    )
    .slice(0, 4);
  const mesh = clients.filter((c) => c.node_name && c.node_name !== "os");
  const okCount = services.filter((s) => s.ok).length;

  if (density === "pending") {
    return (
      <div
        ref={rootRef}
        className={`h-full min-h-0 w-full ${className ?? ""}`}
        aria-hidden
      />
    );
  }

  if (density === "inline") {
    return (
      <div
        ref={rootRef}
        className={`flex h-full min-h-0 flex-col justify-between gap-2 overflow-hidden px-3 pb-2.5 pt-1 ${className ?? ""}`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-medium tracking-[1.2px] text-ink-ghost">
            MODULES
          </span>
          <span className="text-[12px] tabular-nums text-ink">
            {okCount}/{services.length}
          </span>
          <span className="text-ink-ghost">·</span>
          {services.map((s) => (
            <span
              key={s.name}
              className={`font-mono text-[11px] ${
                s.ok ? "text-sage-deep" : "text-error"
              }`}
              title={s.ok ? "reachable" : "unreachable"}
            >
              {s.name}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
          {meters.map((row) => (
            <span
              key={row.key}
              className="inline-flex items-baseline gap-1 text-[12px] tabular-nums text-ink"
            >
              <span className="text-[10px] font-medium tracking-[1.2px] text-ink-ghost">
                {row.kind.toLowerCase()}
              </span>
              {row.pct == null ? "—" : `${Math.round(row.pct)}%`}
            </span>
          ))}
        </div>
        {!clientsPending && mesh.length > 0 ? (
          <p className="truncate text-[11px] text-ink-ghost">
            {mesh.filter((c) => c.online).length}/{mesh.length} clients online
          </p>
        ) : null}
      </div>
    );
  }

  if (density === "cards") {
    return (
      <div
        ref={rootRef}
        className={`flex h-full min-h-0 flex-col gap-2.5 overflow-hidden px-3 pb-2.5 pt-1 ${className ?? ""}`}
      >
        <div className="min-w-0 rounded-[var(--radius)] border border-dashed border-rule/80 px-2.5 py-2">
          <p className="mb-1.5 text-[10px] font-medium tracking-[1.2px] text-ink-ghost">
            MODULES · {okCount}/{services.length}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span
                key={s.name}
                className={`rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] ${
                  s.ok
                    ? "bg-sage/15 text-sage-deep"
                    : "bg-error/10 text-error"
                }`}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-[var(--radius)] border border-dashed border-rule/80 px-2.5 py-2">
          <p className="mb-1.5 text-[10px] font-medium tracking-[1.2px] text-ink-ghost">
            CLIENTS
          </p>
          {clientsPending ? (
            <p className="text-[12px] text-ink-ghost">Loading…</p>
          ) : mesh.length === 0 ? (
            <p className="text-[12px] text-ink-ghost">None connected</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {mesh.map((c) => (
                <span
                  key={c.node_name}
                  className="inline-flex items-center gap-1.5 rounded-[3px] bg-rule/60 px-1.5 py-0.5 text-[11px] text-ink"
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      c.pending
                        ? "bg-sage"
                        : c.online
                          ? "bg-ink"
                          : "bg-ink-ghost"
                    }`}
                    aria-hidden
                  />
                  {c.node_name}
                </span>
              ))}
            </div>
          )}
        </div>

        {meters.length > 0 ? (
          <div className="mt-auto flex gap-2">
            {meters.map((row) => (
              <div
                key={row.key}
                className="min-w-0 flex-1 rounded-[var(--radius)] border border-dashed border-rule/80 px-2 py-1.5"
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] font-medium tracking-[1.2px] text-ink-ghost">
                    {row.kind.toLowerCase()}
                  </span>
                  <span className="text-[11px] tabular-nums text-ink">
                    {row.pct == null ? "—" : `${Math.round(row.pct)}%`}
                  </span>
                </div>
                <div className="mt-1.5 h-[4px] overflow-hidden rounded-[2px] bg-rule">
                  {row.pct != null ? (
                    <div
                      className="h-full rounded-[2px] bg-sage"
                      style={{
                        width: `${Math.min(100, Math.max(0, row.pct))}%`,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`flex h-full min-h-0 flex-col overflow-hidden px-4 pb-3 pt-2 ${className ?? ""}`}
    >
      <ul className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-1.5 pb-3">
        {services.map((s) => (
          <li key={s.name} className="flex items-center gap-2" title={s.ok ? "reachable" : "offline"}>
            <span className={`size-1.5 shrink-0 rounded-full ${s.ok ? "bg-sage" : "border border-dashed border-ink-ghost"}`} />
            <span className={`truncate text-[13px] ${s.ok ? "text-ink" : "text-ink-ghost"}`}>{s.name}</span>
          </li>
        ))}
      </ul>

      <div className="h-px shrink-0 bg-rule" />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden pt-3">
        {meters.map((row) => (
          <div key={row.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="text-ink-muted">{row.kind}</span>
              <span className="font-semibold tabular-nums text-ink">{row.pct == null ? "—" : `${Math.round(row.pct)}%`}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-rule">
              {row.pct != null ? (
                <div
                  className={`h-full rounded-full transition-[width] duration-slow ease-dadi ${row.pct > 85 ? "bg-error" : row.pct > 65 ? "bg-[var(--clay)]" : "bg-sage"}`}
                  style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 pt-2 text-[12px] text-ink-muted">
        {clientsPending ? (
          <span className="skeleton h-2.5 w-1/2" />
        ) : mesh.length === 0 ? (
          <span className="text-ink-ghost">No devices connected</span>
        ) : (
          mesh.map((c) => (
            <span key={c.node_name} className="flex items-center gap-1.5" title={clientLabel(c)}>
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${c.online ? "bg-sage" : "border border-dashed border-ink-ghost"}`}
              />
              <span className={c.online ? "" : "text-ink-ghost"}>{c.node_name}</span>
            </span>
          ))
        )}
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

import type { NasStatus } from "../../shared/api/nas";

/** The house order of the modules. */
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

/** Relative time label (e.g. "3 minutes ago"). */
export function formatRelative(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) {
    return rtf.format(diffSec, "second");
  }
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, "minute");
  }
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, "hour");
  }
  return rtf.format(Math.round(diffHour / 24), "day");
}

/** Absolute local date+time for tooltips. */
export function formatAbsolute(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** A duration at the coarsest unit that still says something (e.g. "12s", "3m", "1h 5m"). */
export function formatSpan(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** The clock time of day with its AM or PM mark (e.g. "10:20 AM"), in the device's zone, or in `zone` (an IANA name) when given. */
export function formatClock(iso: string, zone?: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone }).format(new Date(iso));
}

/** The short name of the zone at an instant (e.g. "EDT"), in the device's zone, or in `zone` (an IANA name) when given. */
export function formatZone(iso: string, zone?: string): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZoneName: "short", timeZone: zone })
    .formatToParts(new Date(iso))
    .find((part) => part.type === "timeZoneName");
  if (name === undefined) {
    throw new Error(`no zone name for ${iso} in ${zone ?? "the device's zone"}`);
  }
  return name.value;
}

/** The time since an instant in its shortest form ("42s", "3m", "5h", "2d"), as a task row's age reads. */
export function formatAge(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) {
    return `${seconds}s`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

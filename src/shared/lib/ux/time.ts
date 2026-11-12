/** How long ago an instant was in words ("4 minutes ago", "1 day ago"); seconds under 45, then minutes, hours and days. An instant that has not come yet reads as 0 seconds ago. */
export function formatRelative(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) {
    return `${seconds} ${seconds === 1 ? "second" : "seconds"} ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
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

/** The weekday, month and day of an instant (e.g. "Tue, Oct 27"), in the device's zone, or in `zone` (an IANA name) when given. */
export function formatDay(iso: string, zone?: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: zone }).format(new Date(iso));
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

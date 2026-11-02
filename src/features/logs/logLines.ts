import type { NasLogEntry } from "../../shared/api/nas";

/** The windows of time the logs can look back over, in the order their switch is drawn. */
export const RANGE_PRESETS = ["1h", "6h", "24h"] as const;

/** One of {@link RANGE_PRESETS}. */
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** The severities a line has, in the order their chips are drawn after All. */
export const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;

/** A log line to bring up, from an error toast or a service chip. */
export type LogFocus = {
  service: string;
  /** Text the line contains (a request id, a log message); empty only narrows to the service. */
  q: string;
  /** When it happened (ISO); the matching line nearest this is pinned open. */
  at: string;
  /** New on every arrival, so the same line can be focused again. */
  key: string;
};

/** ISO from/to for a log range preset. Call per fetch so `to` stays current. */
export function rangeBounds(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const hours = preset === "1h" ? 1 : preset === "6h" ? 6 : 24;
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** The smallest preset that reaches back to a moment, so a line from an error toast is in the window. */
export function rangeFor(iso: string, now = Date.now()): RangePreset {
  const age = now - new Date(iso).getTime();
  return age < 60 * 60_000 ? "1h" : age < 6 * 60 * 60_000 ? "6h" : "24h";
}

/** A log line's time of day with seconds, in the device's zone (e.g. "10:41:07 AM"). */
export function logTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date(iso));
}

/** Health probes and HTTP access chatter, which the logs leave out. */
export function isNoiseLog(entry: NasLogEntry): boolean {
  const msg = entry.msg.trim().toLowerCase();
  if (msg === "request completed" || msg === "incoming request") {
    return true;
  }
  if (/get \/health/i.test(entry.msg)) {
    return true;
  }
  return entry.raw !== undefined && /\/health/.test(entry.raw) && /"(GET|get)"/.test(entry.raw);
}

/** A line with a stable identity across polls; repeats of the same line get a suffix. */
export type KeyedLog = { key: string; entry: NasLogEntry };

/** Gives each line an identity from its time, service and message. */
export function keyEntries(entries: NasLogEntry[]): KeyedLog[] {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const base = `${entry.time}|${entry.service}|${entry.msg}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: n === 0 ? base : `${base}#${n}`, entry };
  });
}

/** The line whose time is nearest a moment, or null when there are none. */
export function nearestLog(lines: KeyedLog[], iso: string): KeyedLog | null {
  const at = new Date(iso).getTime();
  return lines.reduce<KeyedLog | null>((best, line) => (best === null || Math.abs(new Date(line.entry.time).getTime() - at) < Math.abs(new Date(best.entry.time).getTime() - at) ? line : best), null);
}

/** A line's raw record laid out one field to a line when it is JSON, else the text as it was logged. */
export function prettyRaw(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 1);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return raw;
    }
    throw error;
  }
}

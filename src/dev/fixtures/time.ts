/** One minute in milliseconds. */
export const MIN = 60_000;
/** One hour in milliseconds. */
export const HOUR = 3_600_000;
/** One day in milliseconds. */
export const DAY = 86_400_000;

/** ISO time `ms` before now (negative `ms` is in the future). */
export function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

/** Nas-style ISO time with nanosecond digits, `ms` before now. */
export function agoNanos(ms: number): string {
  return ago(ms).replace(/\.(\d{3})Z$/, ".$1123456Z");
}

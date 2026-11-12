/** UTC offset in minutes for an instant in an IANA zone; includes fractional-hour offsets. */
export function zoneOffset(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const offset = parts.find((part) => part.type === "timeZoneName")!.value;
  if (offset === "GMT") return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (match === null)
    throw new Error(`Unexpected UTC offset ${offset} in ${zone}`);
  return (
    (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "-" ? -1 : 1)
  );
}

/** A local-clock discontinuity within a day's real bounds. */
export type ClockChange = {
  kind: "spring" | "fall";
  minute: number;
  duration: number;
};

/** Finds the skipped or repeated wall-clock interval, including half-hour clock changes. */
export function clockChange(
  start: Date,
  end: Date,
  zone: string,
): ClockChange | null {
  const first = zoneOffset(start, zone);
  if (first === zoneOffset(new Date(end.getTime() - 1), zone)) return null;
  let at = start.getTime();
  while (at < end.getTime() && zoneOffset(new Date(at), zone) === first)
    at += 15 * 60_000;
  let lo = at - 15 * 60_000;
  while (lo < at && zoneOffset(new Date(lo), zone) === first) lo += 60_000;
  const after = new Date(lo);
  const offset = zoneOffset(after, zone);
  const delta = offset - first;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(after);
  const minute =
    Number(parts.find((p) => p.type === "hour")!.value) * 60 +
    Number(parts.find((p) => p.type === "minute")!.value);
  return {
    kind: delta > 0 ? "spring" : "fall",
    minute: delta > 0 ? minute - delta : minute,
    duration: Math.abs(delta),
  };
}

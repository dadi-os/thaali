const GIB = 2 ** 30;

/** A byte count in the gigabytes the System page reads in: one decimal under 100, none from 100, and no trailing `.0`. */
export function formatGb(bytes: number): string {
  const gb = bytes / GIB;
  return `${gb.toFixed(gb >= 100 ? 0 : 1).replace(/\.0$/, "")} GB`;
}

/**
 * How long the box has been up, as Khisso words it: the two largest of days, hours and minutes that are not zero
 * ("11 days, 4 hours", "1 hour, 57 minutes"), and "0 minutes" under a minute.
 */
export function formatUptime(seconds: number): string {
  const units: Array<[number, string]> = [
    [Math.floor(seconds / 86_400), "day"],
    [Math.floor((seconds % 86_400) / 3600), "hour"],
    [Math.floor((seconds % 3600) / 60), "minute"],
  ];
  const shown = units.filter(([count]) => count > 0).slice(0, 2);
  return shown.length === 0 ? "0 minutes" : shown.map(([count, unit]) => `${count} ${unit}${count === 1 ? "" : "s"}`).join(", ");
}

/** The color a load meter is drawn in: sage, clay past 75% and error past 90%. */
export function loadTone(percent: number): string {
  if (percent > 90) {
    return "var(--error)";
  }
  return percent > 75 ? "var(--clay)" : "var(--sage)";
}

/** A service name with its first letter capitalised, as the service chips show it. */
export function capitalize(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

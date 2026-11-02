const GIB = 2 ** 30;

/** A byte count in the gigabytes the System page reads in: one decimal under 100, none from 100, and no trailing `.0`. */
export function formatGb(bytes: number): string {
  const gb = bytes / GIB;
  return `${gb.toFixed(gb >= 100 ? 0 : 1).replace(/\.0$/, "")} GB`;
}

/** How long the box has been up, in whole days and hours. */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  return `${days} ${days === 1 ? "day" : "days"}, ${hours} ${hours === 1 ? "hour" : "hours"}`;
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

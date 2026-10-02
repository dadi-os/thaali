/** One-line signatures of tool calls for anywhere a call is shown in brief. */

/** One argument value for a signature: short strings quoted, long ones cut, structures elided. */
function prettyArg(value: unknown, max = 22): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (trimmed.length <= max) {
      return JSON.stringify(trimmed);
    }
    return JSON.stringify(`${trimmed.slice(0, max - 1)}…`);
  }
  return "…";
}

/**
 * Compact `name(key: val, …)` signature of a tool call, for the thread tool preview and
 * the agent popover's activity feed.
 */
export function formatToolSignature(
  name: string,
  input: Record<string, unknown>,
  maxLen = 64,
): string {
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return `${name}()`;
  }
  const shown = keys.slice(0, 3).map((key) => `${key}: ${prettyArg(input[key])}`);
  const more = keys.length > 3 ? ", …" : "";
  const raw = `${name}(${shown.join(", ")}${more})`;
  if (raw.length <= maxLen) {
    return raw;
  }
  return `${raw.slice(0, maxLen - 1)}…`;
}

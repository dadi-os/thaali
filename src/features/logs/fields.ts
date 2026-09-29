/** Structured detail pulled out of a log line's raw Loki/pino JSON. */
export type LogDetail = {
  /** Flat `key → value` pairs, nested objects dotted (`req.method`). */
  fields: Array<{ key: string; value: string }>;
  /** Error stack, when the line carries one. */
  stack: string | null;
  /** Pretty-printed raw JSON, or the raw text when it is not JSON. */
  pretty: string | null;
};

/** Top-level keys the row and popover header already show, or that carry no meaning. */
const SHOWN_KEYS = new Set(["time", "timestamp", "ts", "level", "msg", "message", "service", "v"]);

const MAX_DEPTH = 3;

function stringify(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function flatten(
  value: Record<string, unknown>,
  prefix: string,
  depth: number,
  out: LogDetail["fields"],
): void {
  for (const [key, child] of Object.entries(value)) {
    if (!prefix && SHOWN_KEYS.has(key)) {
      continue;
    }
    if (key === "stack" && typeof child === "string") {
      continue;
    }
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child) && depth < MAX_DEPTH) {
      flatten(child as Record<string, unknown>, path, depth + 1, out);
    } else if (child !== undefined && child !== "") {
      out.push({ key: path, value: stringify(child) });
    }
  }
}

/** First `stack` string in the object (err.stack, error.stack, …). */
function findStack(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > MAX_DEPTH) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.stack === "string") {
    return record.stack;
  }
  for (const child of Object.values(record)) {
    const found = findStack(child, depth + 1);
    if (found) {
      return found;
    }
  }
  return null;
}

/** Split a raw log line into fields, stack, and pretty JSON for the detail popover. */
export function logDetail(raw: string | undefined): LogDetail {
  if (!raw) {
    return { fields: [], stack: null, pretty: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { fields: [], stack: null, pretty: raw };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { fields: [], stack: null, pretty: raw };
  }
  const fields: LogDetail["fields"] = [];
  flatten(parsed as Record<string, unknown>, "", 0, fields);
  return {
    fields,
    stack: findStack(parsed),
    pretty: JSON.stringify(parsed, null, 2),
  };
}

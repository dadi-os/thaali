import { useEffect, useMemo, useState } from "react";
import type { NasLogEntry } from "../../shared/api/nas";
import { Popover, type PopoverAnchor } from "../../shared/components/Popover";
import { formatRelative } from "../../shared/lib/ux/time";
import { copyText } from "../chaavi/copy";

/** Structured detail pulled out of a log line's raw Loki/pino JSON. */
export type LogDetail = {
  /** Flat `key → value` pairs, nested objects dotted (`req.method`). */
  fields: Array<{ key: string; value: string }>;
  /** Error stack, when the line carries one. */
  stack: string | null;
  /** Pretty-printed raw JSON, or the raw text as-is when the line is not JSON. */
  pretty: string | null;
};

/** Top-level keys the row and popover header already show, or that carry no meaning. */
const SHOWN_KEYS = new Set(["time", "timestamp", "ts", "level", "msg", "message", "service", "v"]);

/** Nesting depth past which objects are shown as JSON instead of dotted keys. */
const MAX_DEPTH = 3;

/** One field value as display text; objects and arrays as compact JSON. */
function stringify(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Append `value`'s leaves to `out` as dotted keys under `prefix`, skipping keys the
 * header already shows and `stack` strings (shown in their own section).
 */
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

/**
 * Split a raw log line into fields, stack, and pretty JSON. Loki lines are not always
 * JSON (plain stdout), so non-JSON raw is kept verbatim with no fields.
 */
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

/** Colour classes for one log level: row edge bar, dot, and label text. */
export type LevelTone = { bar: string; dot: string; text: string };

/** Level colours: error red, warn clay, info sage, anything else ghost. */
export function levelTone(level: string): LevelTone {
  switch (level.toLowerCase()) {
    case "error":
    case "fatal":
      return { bar: "bg-error", dot: "bg-error", text: "text-error" };
    case "warn":
    case "warning":
      return { bar: "bg-[var(--clay)]", dot: "bg-[var(--clay)]", text: "text-[var(--clay)]" };
    case "info":
      return { bar: "bg-transparent", dot: "bg-sage", text: "text-sage-deep" };
    default:
      return { bar: "bg-transparent", dot: "bg-ink-ghost", text: "text-ink-ghost" };
  }
}

/** Date and 24h time to the millisecond. */
function formatPrecise(iso: string): string {
  const d = new Date(iso);
  const base = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  return `${base}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

const ACTION_CLASS =
  "rounded-[6px] px-2 py-1 text-[11px] tracking-wide text-ink-muted transition-colors duration-slow ease-dadi hover:bg-sage-fill hover:text-sage-deep";

export type LogPopoverProps = {
  open: boolean;
  /** Line shown; kept after close so the panel fades out with its content. */
  entry: NasLogEntry | null;
  /** Identity of the line, so the panel glides and cross-fades between rows. */
  entryKey: string | null;
  /** Viewport point beside the log list, level with the row. */
  anchor: PopoverAnchor | null;
  /** Clean cause for error lines, when it differs from the message. */
  cause: { title: string; code: number | null } | null;
  /** Opened by a row click; stays until Esc or an outside click. */
  pinned: boolean;
  /** Esc or a press outside the panel. */
  onClose: () => void;
  /** Narrow the explorer to this line's service. */
  onFilterService: (service: string) => void;
  /** Pointer entered the panel: cancel a pending hover close. */
  onPointerEnter: () => void;
  /** Pointer left the panel: close after the hover delay unless pinned. */
  onPointerLeave: () => void;
};

/**
 * Full detail for one log line: exact time, whole message, error cause, parsed
 * fields, stack, and raw JSON. Opens on row hover; a click on the row pins it.
 */
export function LogPopover({
  open,
  entry,
  entryKey,
  anchor,
  cause,
  pinned,
  onClose,
  onFilterService,
  onPointerEnter,
  onPointerLeave,
}: LogPopoverProps) {
  const detail = useMemo(() => logDetail(entry?.raw), [entry?.raw]);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState<"raw" | "msg" | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    setShowRaw(false);
    setCopied(null);
    setCopyError(null);
  }, [entryKey]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const t = window.setTimeout(() => setCopied(null), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!entry || !anchor) {
    return null;
  }

  const tone = levelTone(entry.level);

  const pretty = detail.pretty;

  const copy = (what: "raw" | "msg", text: string) => {
    setCopyError(null);
    copyText(text)
      .then(() => setCopied(what))
      .catch((err: unknown) => setCopyError(err instanceof Error ? err.message : String(err)));
  };

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      widthPx={400}
      contentKey={entryKey ?? undefined}
      aria-label="Log line detail"
    >
      <div
        className="flex min-h-0 flex-1 flex-col"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-dashed border-rule px-3.5 pt-3 pb-2.5">
          <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />
          <span className={`text-[10px] font-medium tracking-[1.4px] uppercase ${tone.text}`}>
            {entry.level}
          </span>
          <span className="min-w-0 truncate text-[12px] font-medium tracking-wide text-sage-text">
            {entry.service}
          </span>
          <span className="ml-auto shrink-0 text-[10px] tracking-wide text-ink-ghost">
            {pinned ? "Pinned · Esc" : formatRelative(entry.time)}
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
          <p className="font-mono text-[10.5px] tabular-nums text-ink-ghost">
            {formatPrecise(entry.time)}
            {pinned ? ` · ${formatRelative(entry.time)}` : ""}
          </p>

          <p className="mt-1.5 text-[13px] leading-snug whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
            {entry.msg}
          </p>

          {cause ? (
            <div className="mt-2.5 rounded-[7px] border border-dashed border-error-line bg-error-fill px-2.5 py-2">
              <p className="text-[10px] font-medium tracking-[1.4px] text-error uppercase">
                Cause{cause.code != null ? ` · ${cause.code}` : ""}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-ink [overflow-wrap:anywhere]">
                {cause.title}
              </p>
            </div>
          ) : null}

          {detail.fields.length > 0 ? (
            <section className="mt-3">
              <h3 className="mb-1.5 text-[10px] font-medium tracking-[1.6px] text-sage-deep">
                FIELDS
              </h3>
              <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1">
                {detail.fields.map(({ key, value }) => (
                  <div key={key} className="contents">
                    <dt className="max-w-[140px] truncate font-mono text-[10.5px] text-ink-muted" title={key}>
                      {key}
                    </dt>
                    <dd className="min-w-0 font-mono text-[10.5px] leading-snug text-ink [overflow-wrap:anywhere]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {detail.stack ? (
            <section className="mt-3">
              <h3 className="mb-1.5 text-[10px] font-medium tracking-[1.6px] text-sage-deep">
                STACK
              </h3>
              <pre className="max-h-40 overflow-auto rounded-[6px] bg-ink/[0.04] px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ink-muted">
                {detail.stack}
              </pre>
            </section>
          ) : null}

          {showRaw && pretty ? (
            <pre className="mt-3 max-h-56 overflow-auto rounded-[6px] bg-ink/[0.04] px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ink-muted">
              {pretty}
            </pre>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-1 border-t border-dashed border-rule px-2.5 py-2">
          <button type="button" className={ACTION_CLASS} onClick={() => copy("msg", entry.msg)}>
            {copied === "msg" ? "Copied" : "Copy message"}
          </button>
          {pretty ? (
            <>
              <button type="button" className={ACTION_CLASS} onClick={() => copy("raw", pretty)}>
                {copied === "raw" ? "Copied" : "Copy raw"}
              </button>
              <button type="button" className={ACTION_CLASS} onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "Hide raw" : "Show raw"}
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={`ml-auto ${ACTION_CLASS}`}
            onClick={() => onFilterService(entry.service)}
          >
            Only {entry.service}
          </button>
          {copyError ? (
            <p role="alert" className="w-full px-2 pt-1 text-[11px] text-error">
              Copy failed: {copyError}
            </p>
          ) : null}
        </footer>
      </div>
    </Popover>
  );
}

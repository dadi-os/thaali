import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { isMeshOnline, nas } from "../../shared/api";
import type { NasLogEntry, NasLogLevel } from "../../shared/api/nas";
import { useConnection } from "../../shared/hooks/useConnection";
import { useHoverDetails, type DetailsAnchor } from "../../shared/hooks/useHoverDetails";
import { Glider } from "../../shared/components/Glider";
import { IconDismiss, IconSearch } from "../../shared/components/IconButton";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { LogPopover, levelTone } from "./LogPopover";

export type RangePreset = "1h" | "6h" | "24h";

export type LogExplorerProps = {
  className?: string;
};

/** ISO from/to for a log range preset. Call per fetch so `to` stays current. */
export function rangeBounds(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const hours = preset === "1h" ? 1 : preset === "6h" ? 6 : 24;
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** A log timestamp in the viewer's locale, to the second. */
export function formatLogTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

/** Compact row time: 24h clock with seconds. */
function formatRowTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export type ErrorCardCopy = {
  /** Human-readable cause — shown as the primary line. */
  title: string;
  /** Short operational context (e.g. "reasoning lane failed"). */
  context: string | null;
  /** Provider/HTTP status when parseable. */
  code: number | null;
};

/**
 * Pull the nested human message out of Anthropic/SDK blobs like:
 * `Error code: 400 - {'type': 'error', 'error': {'message': 'Your credit…'}}`
 * Prefers the innermost quoted `message` value, then embedded JSON, then stripped text.
 */
function humanizeProviderBlob(text: string): {
  message: string;
  code: number | null;
} {
  const codeMatch = text.match(/\b(?:Error code|status(?:Code)?):\s*(\d{3})\b/i);
  const code = codeMatch ? Number(codeMatch[1]) : null;

  const messageMatches = [
    ...text.matchAll(/['"]message['"]\s*:\s*['"]([^'"]+)['"]/g),
  ];
  if (messageMatches.length > 0) {
    const innermost = messageMatches[messageMatches.length - 1]?.[1];
    if (innermost) {
      return { message: innermost, code };
    }
  }

  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const asJson = text
        .slice(jsonStart)
        .replace(/'/g, '"')
        .replace(/\bNone\b/g, "null")
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false");
      const parsed = JSON.parse(asJson) as {
        error?: { message?: string };
        message?: string;
      };
      const nested = parsed.error?.message ?? parsed.message;
      if (nested) {
        return { message: nested, code };
      }
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
    }
  }

  const stripped = text.replace(/^Error code:\s*\d+\s*-\s*/i, "").trim();
  return { message: stripped || text, code };
}

/**
 * Prefer a clean human cause over raw SDK / provider dump strings.
 */
export function errorCardCopy(entry: NasLogEntry): ErrorCardCopy {
  const context = entry.msg?.trim() || null;
  let blob: string | null = null;

  if (entry.raw) {
    try {
      const parsed = JSON.parse(entry.raw) as {
        err?: { message?: string; statusCode?: number };
        error?: string;
      };
      blob = parsed.err?.message ?? parsed.error ?? null;
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
    }
  }

  if (blob) {
    const { message, code } = humanizeProviderBlob(blob);
    if (message && message !== context) {
      return { title: message, context, code };
    }
    return { title: context ?? message, context: null, code };
  }

  return { title: context ?? "error", context: null, code: null };
}

function formatCardTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const RANGE_OPTIONS: Array<{ value: RangePreset; label: string }> = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
];

const SEVERITY_OPTIONS: Array<{
  value: NasLogLevel | "";
  label: string;
}> = [
  { value: "", label: "All" },
  { value: "error", label: "Error" },
  { value: "warn", label: "Warn" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" },
];

/** Typing settles for this long before the query refetches. */
const SEARCH_DEBOUNCE_MS = 250;

/** Health probes and HTTP access chatter — not useful in the explorer. */
function isNoiseLog(entry: NasLogEntry): boolean {
  const msg = entry.msg.trim().toLowerCase();
  if (msg === "request completed" || msg === "incoming request") {
    return true;
  }
  if (/get \/health/i.test(entry.msg)) {
    return true;
  }
  if (entry.raw) {
    if (/\/health/.test(entry.raw) && /"(GET|get)"/.test(entry.raw)) {
      return true;
    }
  }
  return false;
}

/** Stable identity per line across polls; repeats of the same line get a suffix. */
function keyEntries(entries: NasLogEntry[]): Array<{ key: string; entry: NasLogEntry }> {
  const seen = new Map<string, number>();
  return entries.map((entry) => {
    const base = `${entry.time}|${entry.service}|${entry.msg}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { key: n === 0 ? base : `${base}#${n}`, entry };
  });
}

type ServicePickerProps = {
  /** Live services from Nas. */
  services: string[];
  /** Services request has not answered yet. */
  loading: boolean;
  /** Nas services request failure, shown in place of the picker. */
  error: string | null;
  /** Services the explorer is narrowed to; empty means all. */
  selected: Set<string>;
  onToggle: (name: string) => void;
  /** Back to all services. */
  onClear: () => void;
};

/** Services filter: one button that opens a checklist, instead of a chip per service. */
function ServicePicker({ services, loading, error, selected, onToggle, onClear }: ServicePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (error) {
    return (
      <p role="alert" title={error} className="max-w-[200px] shrink-0 truncate text-[11px] text-error">
        {error}
      </p>
    );
  }

  const summary =
    loading
      ? "Services…"
      : selected.size === 0
        ? "All services"
        : selected.size === 1
          ? [...selected][0]
          : `${selected.size} services`;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 max-w-[160px] items-center gap-1.5 rounded-[7px] border border-dashed px-2.5 text-[11px] tracking-wide transition-colors duration-slow ease-dadi disabled:opacity-60 ${
          selected.size > 0 || open
            ? "border-sage bg-sage-active text-sage-deep"
            : "border-sage-line text-ink-muted hover:border-sage"
        }`}
      >
        <span className="min-w-0 truncate">{summary}</span>
        <svg viewBox="0 0 10 10" aria-hidden className={`size-2.5 shrink-0 transition-transform duration-slow ease-dadi ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-multiselectable
            aria-label="Services"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: SLOW_S, ease: EASE }}
            className="popover-glass absolute top-full right-0 z-30 mt-1.5 flex max-h-72 w-56 flex-col overflow-hidden"
          >
            <div className="min-h-0 overflow-y-auto p-1">
              <ServiceOption label="All services" on={selected.size === 0} onClick={onClear} />
              <div className="mx-2 my-1 border-t border-dashed border-rule" />
              {services.map((name) => (
                <ServiceOption key={name} label={name} on={selected.has(name)} onClick={() => onToggle(name)} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** One checklist row in the services picker. */
function ServiceOption({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={on}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12px] text-ink transition-colors duration-slow ease-dadi hover:bg-sage-fill"
    >
      <span
        className={`flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-slow ease-dadi ${
          on ? "border-sage bg-sage text-bone" : "border-sage-line"
        }`}
      >
        {on ? (
          <svg viewBox="0 0 10 10" aria-hidden className="size-2.5">
            <path d="M2 5.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

/**
 * Nas GET /logs explorer: one toolbar (search with range, services, level), dense
 * one-line rows, and a hover popover with the full line. Click a row to pin it.
 */
export function LogExplorer({ className }: LogExplorerProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [level, setLevel] = useState<NasLogLevel | "">("");
  const [qDraft, setQDraft] = useState("");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<RangePreset>("1h");

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [qDraft]);

  const servicesParam =
    selected.size > 0 ? [...selected].sort().join(",") : undefined;

  const servicesQuery = useQuery({
    queryKey: ["nas", "logs", "services"],
    queryFn: () => nas.listLogServices(),
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  const logsQuery = useQuery({
    queryKey: ["nas", "logs", servicesParam ?? "", level, q, range],
    queryFn: () => {
      const { from, to } = rangeBounds(range);
      return nas.getLogs({
        services: servicesParam,
        level: level || undefined,
        q: q || undefined,
        from,
        to,
        limit: 200,
      });
    },
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  const toggleService = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const rawEntries = useMemo(() => logsQuery.data?.entries ?? [], [logsQuery.data]);
  const rows = useMemo(() => {
    const kept =
      q && /request completed|incoming request|\/health/i.test(q)
        ? rawEntries
        : rawEntries.filter((e) => !isNoiseLog(e));
    return keyEntries(kept);
  }, [rawEntries, q]);
  const hiddenNoise = rawEntries.length - rows.length;

  const details = useHoverDetails("logs");
  const [pinned, setPinned] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const lastPointerDownInList = useRef(0);
  const lastDetail = useRef<NasLogEntry | null>(null);

  /**
   * Line the popover shows. Keeps the last one after it scrolls out of the result set so
   * a pinned or closing panel does not empty out under the pointer.
   */
  const detailEntry = useMemo(() => {
    const hit = rows.find((r) => r.key === details.id)?.entry ?? null;
    if (hit) {
      lastDetail.current = hit;
    }
    return hit ?? lastDetail.current;
  }, [rows, details.id]);

  const detailCause = useMemo(() => {
    if (!detailEntry || detailEntry.level.toLowerCase() !== "error") {
      return null;
    }
    const { title, code } = errorCardCopy(detailEntry);
    return title && title !== detailEntry.msg.trim() ? { title, code } : null;
  }, [detailEntry]);

  /** Beside the list, level with the row, on whichever side has room. */
  const anchorFor = (row: HTMLElement): DetailsAnchor | null => {
    const list = listRef.current?.getBoundingClientRect();
    if (!list) {
      return null;
    }
    const r = row.getBoundingClientRect();
    return { x: list.left + list.width / 2, y: r.top + r.height / 2, radius: list.width / 2 };
  };

  /** Hover preview; ignored while a row is pinned. */
  const previewRow = (key: string, row: HTMLElement) => {
    if (pinned) {
      return;
    }
    const at = anchorFor(row);
    if (at) {
      details.hover(key, at);
    }
  };

  /** Row click: pin its detail open, or unpin when it is already the pinned row. */
  const pinRow = (key: string, row: HTMLElement) => {
    if (pinned === key) {
      setPinned(null);
      return;
    }
    const at = anchorFor(row);
    if (!at) {
      return;
    }
    setPinned(key);
    details.hover(key, at);
  };

  const leaveDetails = () => {
    if (!pinned) {
      details.leave();
    }
  };

  /**
   * Popover dismiss (Esc / outside press). A press that just landed in the list is a
   * row click handled by `pinRow`, so it does not dismiss.
   */
  const closeDetails = useCallback(() => {
    if (performance.now() - lastPointerDownInList.current < 80) {
      return;
    }
    setPinned(null);
    details.close();
  }, [details.close]);

  const filterToService = (service: string) => {
    setSelected(new Set([service]));
    setPinned(null);
    details.close();
  };

  if (!connected) {
    return (
      <div className={`flex h-full items-center justify-center ${className ?? ""}`}>
        <p className="text-[13px] text-ink-ghost">Connect to search logs</p>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col gap-2 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex h-8 min-w-[220px] flex-1 items-center gap-2 rounded-[7px] border border-dashed border-sage-line bg-bone pr-1 pl-2.5 transition-colors duration-slow ease-dadi focus-within:border-sage hover:border-sage">
          <span className="flex size-3.5 shrink-0 text-ink-ghost [&_svg]:size-3.5">
            <IconSearch />
          </span>
          <input
            type="search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQDraft("");
              } else if (e.key === "Enter") {
                setQ(qDraft.trim());
              }
            }}
            placeholder="Filter messages…"
            aria-label="Filter messages"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-ghost [&::-webkit-search-cancel-button]:appearance-none"
          />
          {qDraft ? (
            <button
              type="button"
              aria-label="Clear filter"
              onClick={() => setQDraft("")}
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-ink-ghost transition-colors duration-slow ease-dadi hover:bg-sage-active hover:text-sage-deep [&_svg]:size-3"
            >
              <IconDismiss />
            </button>
          ) : null}
          <Glider options={RANGE_OPTIONS} value={range} onChange={setRange} label="Time range" size="sm" />
        </label>

        <ServicePicker
          services={servicesQuery.data?.services ?? []}
          loading={servicesQuery.isLoading}
          error={
            servicesQuery.isError
              ? servicesQuery.error instanceof Error
                ? servicesQuery.error.message
                : String(servicesQuery.error)
              : null
          }
          selected={selected}
          onToggle={toggleService}
          onClear={() => setSelected(new Set())}
        />

        <Glider options={SEVERITY_OPTIONS} value={level} onChange={setLevel} label="Severity" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius)] border border-dashed border-rule">
        <div className="min-h-0 flex-1 overflow-y-auto" onScroll={() => (pinned ? undefined : details.close())}>
          {logsQuery.isLoading ? (
            <p className="px-3 py-6 text-[13px] text-ink-ghost">Loading logs…</p>
          ) : logsQuery.isError ? (
            <p className="px-3 py-6 text-[13px] text-ink-muted">Could not load logs.</p>
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center px-3 py-6">
              <p className="text-[13px] text-ink-ghost">No log lines</p>
            </div>
          ) : (
            <ul
              ref={listRef}
              onPointerDown={() => {
                lastPointerDownInList.current = performance.now();
              }}
              onPointerLeave={leaveDetails}
            >
              {rows.map(({ key, entry }, i) => {
                const tone = levelTone(entry.level);
                const isError = entry.level.toLowerCase() === "error";
                const active = details.open && details.id === key;
                return (
                  <motion.li
                    key={key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: SLOW_S,
                      ease: EASE,
                      delay: Math.min(i * 0.008, 0.12),
                    }}
                    tabIndex={0}
                    aria-label={`${entry.level} ${entry.service}: ${entry.msg}`}
                    onPointerEnter={(e) => previewRow(key, e.currentTarget)}
                    onClick={(e) => pinRow(key, e.currentTarget)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        pinRow(key, e.currentTarget);
                      }
                    }}
                    className={`relative flex cursor-default items-center gap-2.5 border-b border-rule/60 py-[5px] pr-3 pl-3 outline-none transition-colors duration-slow ease-dadi last:border-b-0 focus-visible:bg-sage-fill ${
                      active
                        ? "bg-sage-active"
                        : isError
                          ? "bg-error-fill/40 hover:bg-error-fill/70"
                          : "hover:bg-sage-fill"
                    }`}
                  >
                    <span aria-hidden className={`absolute inset-y-0 left-0 w-[2px] ${tone.bar}`} />
                    <time className="w-[52px] shrink-0 font-mono text-[10.5px] tabular-nums text-ink-ghost">
                      {formatRowTime(entry.time)}
                    </time>
                    <span aria-hidden title={entry.level} className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />
                    <span className="w-[76px] shrink-0 truncate text-[11px] font-medium tracking-wide text-sage-text" title={entry.service}>
                      {entry.service || "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] leading-snug text-ink">
                      {entry.msg}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-dashed border-rule px-3 py-1 text-[10px] tracking-wide text-ink-ghost">
          <span className="tabular-nums">
            {rows.length} {rows.length === 1 ? "line" : "lines"}
            {hiddenNoise > 0 ? ` · ${hiddenNoise} health checks hidden` : ""}
          </span>
          {logsQuery.isFetching && !logsQuery.isLoading ? <span className="size-1 rounded-full bg-sage" aria-hidden /> : null}
          <span className="ml-auto">Hover for detail · click to pin</span>
        </div>
      </div>

      <LogPopover
        open={details.open}
        entry={detailEntry}
        entryKey={details.id}
        anchor={details.anchor}
        cause={detailCause}
        pinned={pinned !== null && pinned === details.id}
        onClose={closeDetails}
        onFilterService={filterToService}
        onPointerEnter={details.keep}
        onPointerLeave={leaveDetails}
      />
    </div>
  );
}

export type ErrorLogCardsProps = {
  className?: string;
  /** Max cards to show. */
  limit?: number;
};

/**
 * Recent error lines as cards — used on the System page in place of uptime.
 */
export function ErrorLogCards({ className, limit = 8 }: ErrorLogCardsProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);

  const errorsQuery = useQuery({
    queryKey: ["nas", "logs", "errors", limit],
    queryFn: () => {
      const { from, to } = rangeBounds("1h");
      return nas.getLogs({
        level: "error",
        from,
        to,
        limit,
      });
    },
    enabled: connected,
    refetchInterval: POLL_MS,
  });

  if (!connected) {
    return (
      <div className={className}>
        <p className="text-[13px] text-ink-ghost">Connect to load errors</p>
      </div>
    );
  }

  if (errorsQuery.isError) {
    return (
      <div className={className}>
        <p className="text-[13px] text-ink-muted">Could not load errors.</p>
      </div>
    );
  }

  const entries = errorsQuery.data?.entries ?? [];

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium tracking-[2px] text-sage-deep">
          ERRORS
        </span>
        <span className="text-[11px] text-ink-ghost">
          {errorsQuery.isLoading ? "…" : `${entries.length} · last hour`}
        </span>
      </div>

      {errorsQuery.isLoading ? (
        <p className="text-[13px] text-ink-ghost">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-[13px] text-ink-ghost">No errors in the last hour</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {entries.map((entry, i) => {
            const { title, context, code } = errorCardCopy(entry);
            return (
              <motion.li
                key={`${entry.time}-${entry.service}-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: SLOW_S,
                  ease: EASE,
                  delay: Math.min(i * 0.03, 0.2),
                }}
                className="min-w-0 overflow-hidden rounded-[var(--radius)] border border-dashed border-error-line bg-error-fill px-3 py-2.5"
              >
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[11px] font-medium tracking-wide text-error">
                    {entry.service || "unknown"}
                    {code != null ? (
                      <span className="ml-1.5 font-normal text-ink-ghost">
                        · {code}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-ink-ghost">
                    {formatCardTime(entry.time)}
                  </span>
                </div>
                <p className="mt-1.5 min-w-0 overflow-hidden text-[13px] leading-snug tracking-normal text-ink [overflow-wrap:break-word] line-clamp-3">
                  {title}
                </p>
                {context ? (
                  <p className="mt-1 min-w-0 truncate text-[11px] leading-snug text-ink-muted">
                    {context}
                  </p>
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

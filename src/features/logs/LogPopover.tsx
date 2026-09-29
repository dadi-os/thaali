import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { NasLogEntry } from "../../shared/api/nas";
import { Popover, type PopoverAnchor } from "../../shared/components/Popover";
import { formatRelative } from "../../shared/lib/ux/time";
import { copyText } from "../chaavi/copy";
import { logDetail } from "./fields";

/** Colour tokens for one log level: row edge bar, dot, and label text. */
export type LevelTone = { bar: string; dot: string; text: string };

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

export type LogPopoverProps = {
  open: boolean;
  /** Line shown; kept after close so the panel fades out with its content. */
  entry: NasLogEntry | null;
  /** Identity of the line, so the panel glides and cross-fades between rows. */
  entryKey: string | null;
  anchor: PopoverAnchor | null;
  /** Clean cause for error lines, when it differs from the message. */
  cause: { title: string; code: number | null } | null;
  pinned: boolean;
  onClose: () => void;
  onFilterService: (service: string) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
};

/**
 * Full detail for one log line: exact time, whole message, parsed fields, stack,
 * and raw JSON. Opens on row hover; a click on the row pins it.
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

  useEffect(() => {
    setShowRaw(false);
    setCopied(null);
  }, [entryKey]);

  if (!entry || !anchor) {
    return null;
  }

  const tone = levelTone(entry.level);

  const copy = (what: "raw" | "msg") => {
    const text = what === "raw" ? (detail.pretty ?? entry.raw ?? entry.msg) : entry.msg;
    copyText(text)
      .then(() => {
        setCopied(what);
        window.setTimeout(() => setCopied(null), 1200);
      })
      .catch(() => setCopied(null));
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
            {entry.service || "unknown"}
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
            {entry.msg || "—"}
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

          {showRaw && detail.pretty ? (
            <pre className="mt-3 max-h-56 overflow-auto rounded-[6px] bg-ink/[0.04] px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ink-muted">
              {detail.pretty}
            </pre>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-1 border-t border-dashed border-rule px-2.5 py-2">
          <PopoverAction onClick={() => copy("msg")}>
            {copied === "msg" ? "Copied" : "Copy message"}
          </PopoverAction>
          {detail.pretty ? (
            <>
              <PopoverAction onClick={() => copy("raw")}>
                {copied === "raw" ? "Copied" : "Copy raw"}
              </PopoverAction>
              <PopoverAction onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "Hide raw" : "Show raw"}
              </PopoverAction>
            </>
          ) : null}
          {entry.service ? (
            <PopoverAction className="ml-auto" onClick={() => onFilterService(entry.service)}>
              Only {entry.service}
            </PopoverAction>
          ) : null}
        </footer>
      </div>
    </Popover>
  );
}

function PopoverAction({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[6px] px-2 py-1 text-[11px] tracking-wide text-ink-muted transition-colors duration-slow ease-hath hover:bg-sage-fill hover:text-sage-deep ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

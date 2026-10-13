import { Component, useEffect, useState, type ErrorInfo, type MouseEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { openTarget } from "../../../chrome/Toaster";
import { failureTarget } from "../../../store/toasts";
import { logLine } from "../../lib/platform/log";
import { BREATH_S, EASE, SLOW_S } from "../../lib/ux/motion";
import { formatAbsolute, formatRelative } from "../../lib/ux/time";
import { failureFacts } from "./failure";

/**
 * Which non-happy state a view is in. `loading`: the first answer is on its way. `offline`:
 * the mesh to dadi is down, so nothing can be asked. `error`: a request or a render failed.
 * `empty`: a real answer with nothing in it.
 */
export type StateTone = "loading" | "offline" | "error" | "empty";

type StateViewBase = {
  /** Tracking-caps headline naming the module and its state, e.g. "Yaad is offline". */
  label: string;
  /** Tile scale: a smaller mark and type, for home widgets and narrow panels. */
  compact?: boolean;
  className?: string;
};

export type StateViewProps = StateViewBase &
  (
    | {
        tone: "loading" | "offline" | "empty";
        /** One quiet line under the label: what is happening or what comes next. */
        detail?: string;
      }
    | {
        tone: "error";
        /** The thrown value, shown verbatim, with its service, status and request when a service answered. */
        error: unknown;
        /** Try again: refetch the failed query, or render a crashed unit afresh. */
        onRetry?: () => void;
      }
  );

/** Ink for each tone's label and mark: sage while things are fine, ghost ink for absence, the error ink only for a real failure. */
const LABEL_INK: Record<StateTone, string> = {
  loading: "text-sage-deep",
  offline: "text-ink-ghost",
  error: "text-error",
  empty: "text-sage-deep",
};

/**
 * The house's one view for a unit that cannot show its content: an abstract ring mark that
 * moves in its tone's way (an arc circling while loading, a dashed ring drifting when
 * offline, a slow ripple from a marked core on error, still when empty), a tracking-caps
 * label, and one quiet line. An error shows its own message and, when a dadi service
 * answered, the service, status and request with a way to that request's log line. Same
 * type and palette as GraphPlaceholder, which stays the graphs' own stand-in.
 */
export function StateView(props: StateViewProps) {
  const { tone, label, compact = false, className = "" } = props;
  const navigate = useNavigate();
  const reduced = useReducedMotion() ?? false;
  const failure = props.tone === "error" ? failureFacts(props.error) : null;
  const logs = props.tone === "error" ? failureTarget(props.error) : null;
  const onRetry = props.tone === "error" ? props.onRetry : undefined;

  const act = (run: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    run();
  };

  return (
    <motion.div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`flex h-full w-full min-w-0 flex-col items-center justify-center text-center ${
        compact ? "gap-2.5 px-3" : "gap-4 px-6"
      } ${className}`}
      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -4 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <StateMark tone={tone} className={compact ? "size-9" : "size-16"} />
      <div className="flex min-w-0 max-w-full flex-col items-center gap-1.5">
        <span
          className={`font-medium uppercase ${LABEL_INK[tone]} ${
            compact ? "text-[10px] tracking-[2px]" : "text-[11px] tracking-[2.5px]"
          }`}
        >
          {label}
        </span>
        {props.tone !== "error" && props.detail ? (
          <p className={`max-w-xs leading-relaxed text-ink-ghost ${compact ? "text-[11.5px]" : "text-[12px]"}`}>
            {props.detail}
          </p>
        ) : null}
        {failure ? (
          <>
            <p
              title={failure.raw}
              className={`max-w-sm select-text leading-relaxed text-ink-muted [overflow-wrap:anywhere] ${
                compact ? "line-clamp-3 text-[11.5px]" : "line-clamp-6 text-[12.5px]"
              }`}
            >
              {failure.message}
            </p>
            {failure.origin ? (
              <p className="font-numeric text-[10.5px] tracking-[0.02em] text-ink-ghost">{failure.origin}</p>
            ) : null}
          </>
        ) : null}
      </div>
      {onRetry || logs ? (
        <div className="flex items-center gap-4">
          {onRetry ? (
            <button
              type="button"
              onClick={act(onRetry)}
              className="text-[10.5px] font-medium tracking-[2px] text-sage-deep transition-colors duration-fast ease-dadi hover:text-sage"
            >
              RETRY
            </button>
          ) : null}
          {logs ? (
            <button
              type="button"
              onClick={act(() => openTarget(logs, navigate))}
              className="text-[10.5px] font-medium tracking-[2px] text-sage-deep transition-colors duration-fast ease-dadi hover:text-sage"
            >
              LOG LINE
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

type StateMarkProps = {
  tone: StateTone;
  /** Size utility for the square mark. */
  className: string;
};

/** A ring around a core, drawn and moved per tone; still under reduced motion. */
function StateMark({ tone, className }: StateMarkProps) {
  const reduced = useReducedMotion() ?? false;
  const moving = !reduced;

  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 overflow-visible ${className}`} aria-hidden>
      {tone === "loading" ? (
        <>
          <circle cx="32" cy="32" r="22" fill="none" stroke="var(--sage-line)" strokeWidth="1.2" opacity="0.7" />
          <motion.circle
            cx="32"
            cy="32"
            r="22"
            fill="none"
            stroke="var(--sage)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="22 116"
            animate={moving ? { rotate: 360 } : undefined}
            transition={moving ? { duration: BREATH_S, ease: "linear", repeat: Infinity } : undefined}
          />
          <motion.circle
            cx="32"
            cy="32"
            r="5"
            fill="var(--sage)"
            animate={moving ? { opacity: [0.4, 1, 0.4] } : undefined}
            transition={moving ? { duration: BREATH_S, ease: EASE, repeat: Infinity } : undefined}
          />
        </>
      ) : null}
      {tone === "offline" ? (
        <>
          <motion.circle
            cx="32"
            cy="32"
            r="22"
            fill="none"
            stroke="var(--ink-ghost)"
            strokeWidth="1.2"
            strokeDasharray="3 4"
            animate={moving ? { rotate: 360 } : undefined}
            transition={moving ? { duration: 36, ease: "linear", repeat: Infinity } : undefined}
          />
          <circle cx="32" cy="32" r="5" fill="none" stroke="var(--ink-ghost)" strokeWidth="1.2" strokeDasharray="2.5 2" />
          <motion.circle
            cx="56"
            cy="14"
            r="2"
            fill="var(--ink-ghost)"
            animate={moving ? { opacity: [0.15, 0.7, 0.15], x: [0, 2, 0], y: [0, -2, 0] } : undefined}
            transition={moving ? { duration: BREATH_S * 2, ease: EASE, repeat: Infinity } : undefined}
          />
        </>
      ) : null}
      {tone === "error" ? (
        <>
          <circle cx="32" cy="32" r="22" fill="none" stroke="var(--error-line)" strokeWidth="1.2" />
          {moving ? (
            <motion.circle
              cx="32"
              cy="32"
              r="22"
              fill="var(--error-fill)"
              initial={{ scale: 5 / 22, opacity: 0.9 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: BREATH_S, ease: "easeOut", repeat: Infinity, repeatDelay: BREATH_S / 2 }}
            />
          ) : null}
          <circle cx="32" cy="32" r="5" fill="var(--error)" />
        </>
      ) : null}
      {tone === "empty" ? (
        <>
          <circle cx="32" cy="32" r="22" fill="none" stroke="var(--sage-line)" strokeWidth="1.2" strokeDasharray="3 4" />
          <circle cx="32" cy="32" r="5" fill="none" stroke="var(--sage-line)" strokeWidth="1.2" />
        </>
      ) : null}
    </svg>
  );
}

/** How often a stale banner's "reported … ago" moves on. */
const STALE_TICK_MS = 30_000;

export type StaleBannerProps = {
  /** What keeps the data from being current, in the module's voice, e.g. "Ghar is offline". */
  label: string;
  /** When the shown data last arrived (ms since epoch), e.g. a query's `dataUpdatedAt`. */
  since: number;
  /** The failure keeping it stale, shown verbatim; omit when the cause is the mesh being offline. */
  error?: unknown;
  /** What happens next, e.g. "Controls come back when it does". */
  detail?: string;
  /** One truncated line without the detail, for a home tile. */
  compact?: boolean;
  className?: string;
};

/**
 * One dashed line over last-known content, so stale data never reads as current: what is
 * wrong, how old the shown state is (exact time on hover), the failure's own words when a
 * request failed, and what comes next.
 */
export function StaleBanner({ label, since, error, detail, compact = false, className = "" }: StaleBannerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), STALE_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  const at = new Date(since).toISOString();
  const failure = error === undefined ? null : failureFacts(error);

  return (
    <motion.div
      role="status"
      className={`flex min-w-0 items-start rounded-[var(--radius)] border border-dashed text-left leading-relaxed ${
        compact ? "gap-2 px-2.5 py-1 text-[11px]" : "gap-2.5 px-3.5 py-2 text-[12px]"
      } ${failure ? "border-error-line" : "border-sage-line"} ${className}`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <span
        aria-hidden
        className={`mt-[0.45em] size-[7px] shrink-0 rounded-full border border-dashed ${
          failure ? "border-error" : "border-ink-faint"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-ink-muted ${compact ? "truncate" : ""}`}>
          <span className={failure ? "text-error" : "text-ink"}>{label}</span>
          {" · "}
          <span title={formatAbsolute(at)}>showing what it reported {formatRelative(at, now)}</span>
          {detail && !compact ? <span className="text-ink-ghost"> · {detail}</span> : null}
        </p>
        {failure ? (
          <p title={failure.raw} className={`truncate select-text text-ink-ghost ${compact ? "text-[10.5px]" : "text-[11.5px]"}`}>
            {failure.origin ? `${failure.origin} · ` : ""}
            {failure.message}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

export type ErrorBoundaryProps = {
  /** The unit guarded, as the user knows it ("Ghar", "hath"); heads the failure view. */
  label: string;
  /** Tile scale for the failure view. */
  compact?: boolean;
  children: ReactNode;
};

type ErrorBoundaryState = {
  /** What the children threw while rendering; null while they render. */
  caught: { error: unknown } | null;
};

/**
 * Keeps a render failure inside the unit that threw: the unit shows the thrown error's own
 * message in the error StateView, with a retry that renders it afresh, and the failure is
 * logged with its component stack, while everything around it keeps working.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { caught: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { caught: { error } };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    logLine("error", `${this.props.label} failed to render: ${failureFacts(error).message}${info.componentStack}`, "render_failed");
  }

  render() {
    const { caught } = this.state;
    if (caught) {
      return (
        <StateView
          tone="error"
          label={`${this.props.label} could not render`}
          error={caught.error}
          compact={this.props.compact}
          onRetry={() => this.setState({ caught: null })}
        />
      );
    }
    return this.props.children;
  }
}

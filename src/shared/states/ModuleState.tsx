import { motion } from "motion/react";
import { FADE, RISE } from "../motion";
import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { Truncate } from "../ui/Truncate";

/** What a module cannot show: its service is down, a request failed, the mesh is out of reach, or there is nothing yet. */
export type StateKind = "error" | "module-offline" | "offline" | "empty";

/** The icon each kind of state draws. */
const MARK: Record<StateKind, IconName> = { error: "alert", "module-offline": "server", offline: "wifiOff", empty: "info" };

export type StateViewProps = {
  kind: StateKind;
  title: string;
  detail?: string;
  /** The service that answered with a failure, such as `hath`. */
  service?: string;
  /** The failure's HTTP status. */
  status?: number;
  /** The `X-Request-Id` the failed request carried. */
  requestId?: string;
  /** Try again; the button shows when this is given and the state is not `empty`. */
  onRetry?: () => void;
  /** One row (mark, text, retry) for a short strip. */
  compact?: boolean;
  /** A short tile: the mark, the title and one line, centred. */
  dense?: boolean;
};

/** The state's mark: a tinted rounded square holding its icon. */
function Mark({ kind, size }: { kind: StateKind; size: number }) {
  const failure = kind === "error" || kind === "module-offline";
  return (
    <span
      className={`flex flex-none items-center justify-center ${kind === "empty" ? "bg-sage-fill" : "bg-error-fill"} ${failure ? "text-error" : "text-sage-text"}`}
      style={{ width: size, height: size, borderRadius: size / 3 }}
    >
      <Icon name={MARK[kind]} size={size / 2.2} />
    </span>
  );
}

/**
 * A module's stand-in for content it cannot show, in three sizes: a centred panel, a one-row strip (`compact`)
 * and a short centred tile (`dense`). A failure names its service, status and request so the log line is findable.
 */
export function StateView({ kind, title, detail, service, status, requestId, onRetry, compact = false, dense = false }: StateViewProps) {
  const retry =
    onRetry !== undefined && kind !== "empty" ? (
      <Button tone="outline" size="md" pill icon="retry" className="text-sage-text" onClick={onRetry}>
        Retry
      </Button>
    ) : null;
  const role = kind === "error" || kind === "module-offline" ? "alert" : "status";
  if (dense) {
    return (
      <motion.div role={role} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3 py-1.5 text-center" {...FADE}>
        <Mark kind={kind} size={36} />
        <Truncate text={title} className="max-w-full text-[14px] font-semibold" />
        {retry ?? (detail ? <Truncate text={detail} className="max-w-full text-[13px] text-ink-muted" /> : null)}
      </motion.div>
    );
  }
  if (compact) {
    return (
      <motion.div role={role} className="flex min-w-0 flex-1 items-center gap-3" {...FADE}>
        <Mark kind={kind} size={36} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Truncate text={title} className="text-[14px] font-semibold" />
          {detail ? <Truncate text={detail} className="text-[13px] text-ink-muted" /> : null}
        </div>
        {retry}
      </motion.div>
    );
  }
  return (
    <motion.div role={role} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 p-5 text-center" {...FADE}>
      <Mark kind={kind} size={44} />
      <span className="text-[15px] font-semibold">{title}</span>
      {detail ? <span className="max-w-80 text-[13px] leading-[19px] text-ink-muted">{detail}</span> : null}
      {service || status || requestId ? (
        <div data-selectable className="flex flex-wrap items-center justify-center gap-2 font-numeric text-[12px] text-ink-muted">
          {service ? <span>{service}</span> : null}
          {status ? <span>{`HTTP ${status}`}</span> : null}
          {requestId ? <Truncate text={requestId} selectable className="max-w-[200px] font-numeric text-[12px]" /> : null}
        </div>
      ) : null}
      {retry}
    </motion.div>
  );
}

export type StaleBannerProps = {
  /** What the module shows instead of fresh content, such as "Showing what Nas reported 4 minutes ago". */
  text: string;
  onRetry: () => void;
};

/** A strip above content that is the last answer kept after a request failed, with a way to ask again. */
export function StaleBanner({ text, onRetry }: StaleBannerProps) {
  return (
    <motion.div role="status" className="flex min-h-11 flex-none items-center gap-2.5 rounded-xl border border-glass-border bg-sage-fill py-0 pr-1.5 pl-3.5 text-[13px] text-ink-muted" {...RISE}>
      <Icon name="clock" size={14} />
      <Truncate text={text} className="min-w-0 flex-1" />
      <Button tone="quiet" size="md" pill icon="retry" className="font-semibold text-sage-text" onClick={onRetry}>
        Retry
      </Button>
    </motion.div>
  );
}

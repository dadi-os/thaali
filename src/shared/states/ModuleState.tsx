import { Button } from "../ui/Button";
import { Icon, type IconName } from "../ui/Icon";
import { Truncate } from "../ui/Truncate";

/** What a module cannot show: its service is down, a request failed, the mesh is out of reach, or there is nothing yet. */
export type StateKind = "error" | "module-offline" | "offline" | "empty";

/** The icon each kind of state draws. */
const MARK: Record<StateKind, IconName> = { error: "alert", "module-offline": "server", offline: "wifiOff", empty: "info" };
/** How a state view eases in. */
const ARRIVE = "fade 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both";

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
  const empty = kind === "empty";
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        background: empty ? "var(--sage-fill)" : "var(--error-fill)",
        color: kind === "error" || kind === "module-offline" ? "var(--error)" : "var(--sage-text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
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
      <Button tone="outline" size="md" pill icon="retry" onClick={onRetry} style={{ color: "var(--sage-text)" }}>
        Retry
      </Button>
    ) : null;
  const role = kind === "error" || kind === "module-offline" ? "alert" : "status";
  if (dense) {
    return (
      <div role={role} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: "6px 12px", minHeight: 0, flex: 1, animation: ARRIVE }}>
        <Mark kind={kind} size={36} />
        <Truncate text={title} style={{ fontSize: 14, fontWeight: 600, maxWidth: "100%" }} />
        {retry ?? (detail ? <Truncate text={detail} style={{ fontSize: 13, color: "var(--ink-muted)", maxWidth: "100%" }} /> : null)}
      </div>
    );
  }
  if (compact) {
    return (
      <div role={role} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, animation: ARRIVE }}>
        <Mark kind={kind} size={36} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <Truncate text={title} style={{ fontSize: 14, fontWeight: 600 }} />
          {detail ? <Truncate text={detail} style={{ fontSize: 13, color: "var(--ink-muted)" }} /> : null}
        </div>
        {retry}
      </div>
    );
  }
  return (
    <div role={role} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, textAlign: "center", padding: "20px 20px", minHeight: 0, flex: 1, animation: ARRIVE }}>
      <Mark kind={kind} size={44} />
      <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
      {detail ? <span style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: "19px", maxWidth: 320 }}>{detail}</span> : null}
      {service || status || requestId ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center", fontFamily: "var(--font-numeric)", fontSize: 12, color: "var(--ink-muted)" }}>
          {service ? <span>{service}</span> : null}
          {status ? <span>{`HTTP ${status}`}</span> : null}
          {requestId ? <Truncate text={requestId} style={{ maxWidth: 200, fontFamily: "var(--font-numeric)", fontSize: 12 }} /> : null}
        </div>
      ) : null}
      {retry}
    </div>
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
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        padding: "0 6px 0 14px",
        borderRadius: 12,
        background: "var(--sage-fill)",
        border: "1px solid var(--glass-border)",
        fontSize: 13,
        color: "var(--ink-muted)",
        flex: "none",
        animation: "rise 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
      }}
    >
      <Icon name="clock" size={14} />
      <Truncate text={text} style={{ flex: 1, minWidth: 0 }} />
      <Button tone="quiet" size="md" pill icon="retry" onClick={onRetry} style={{ color: "var(--sage-text)", fontWeight: 600 }}>
        Retry
      </Button>
    </div>
  );
}

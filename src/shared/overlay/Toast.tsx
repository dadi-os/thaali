import type { CSSProperties } from "react";
import { Clamp, Truncate } from "../ui/Truncate";
import { Icon, type IconName } from "../ui/Icon";
import type { ToastModule } from "../../contexts/toasts";

/** What a toast is about: `info` reports something that happened, `error` a failure, `ok` something Ankur did. */
export type ToastKind = "info" | "error" | "ok";

/** The ink, mark and tint of each kind of toast. */
const LOOK: Record<ToastKind, { ink: string; mark: IconName; tint: string }> = {
  info: { ink: "var(--sage-text)", mark: "user", tint: "var(--sage-fill)" },
  error: { ink: "var(--error)", mark: "alert", tint: "var(--error-fill)" },
  ok: { ink: "var(--sage-deep)", mark: "check", tint: "var(--sage-fill)" },
};

/** The mark of each part of dadi a toast can be about. */
const MODULE_MARK: Record<ToastModule, IconName> = { ghar: "home", chaavi: "key", yaad: "brain", hath: "graph", system: "server", timeline: "cal", dadi: "send" };

export type ToastProps = {
  kind?: ToastKind;
  /** The part of dadi it is about, whose mark leads the toast; the kind's own mark when left out. */
  module?: ToastModule | null;
  /** The one line a toast shows. */
  title: string;
  /** The detail, shown on hover or focus (up to three lines). */
  body?: string | null;
  /** Show the detail without a pointer, for a toast that should read fully. */
  open?: boolean;
  /** Width in px. */
  width?: number;
  /** Time on screen in ms, drawn as the bar along the bottom and ending the toast; null for a toast that stays. */
  visibleMs?: number | null;
  /** Plays the exit animation. */
  leaving?: boolean;
  /** Changing it restarts the bar, for a toast that was pushed again. */
  restartKey?: number;
  /** The whole toast is the target: clicking it goes to the thing. */
  onActivate?: () => void;
  onDismiss?: () => void;
  /** Called when the bar has run out. */
  onExpire?: () => void;
  /** Called when the exit animation has played. */
  onLeft?: () => void;
  style?: CSSProperties;
};

/** One quiet line with a kind mark; hover or focus opens the detail, a click goes to the thing, the bar is the time left. */
export function Toast({ kind = "info", module = null, title, body, open = false, width = 340, visibleMs = null, leaving = false, restartKey, onActivate, onDismiss, onExpire, onLeft, style }: ToastProps) {
  const look = LOOK[kind];
  return (
    <div
      className={["tst", kind === "error" ? "tst-error" : "", open ? "open" : "", leaving ? "tst-leaving" : ""].filter(Boolean).join(" ")}
      role="status"
      style={{ width, ...style }}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) {
          onLeft?.();
        }
      }}
    >
      <button type="button" className="tst-hit" aria-label={title} title={title} onClick={onActivate} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 40px 9px 12px", pointerEvents: "none" }}>
        <span style={{ marginTop: 1, width: 24, height: 24, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: look.tint, color: look.ink, flex: "none" }}>
          <Icon name={module === null ? look.mark : MODULE_MARK[module]} size={14} />
        </span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <Truncate text={title} style={{ fontSize: 14, fontWeight: 600, lineHeight: "26px" }} />
          {body ? (
            <div className="rv">
              <div>
                <Clamp text={body} lines={3} style={{ fontSize: 13, lineHeight: "17px", color: "var(--ink-muted)", paddingBottom: 3 }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <button type="button" className="tst-x ui-trans ui-hover-fill" aria-label="Dismiss" title="Dismiss" onClick={onDismiss}>
        <Icon name="close" size={13} />
      </button>
      {visibleMs === null ? null : (
        <span
          key={restartKey}
          className="tst-bar"
          style={{ background: look.ink, animationDuration: `${visibleMs}ms` }}
          onAnimationEnd={(event) => {
            event.stopPropagation();
            onExpire?.();
          }}
        />
      )}
    </div>
  );
}

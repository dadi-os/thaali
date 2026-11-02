import type { ReactNode } from "react";
import { Truncate } from "./Truncate";

/** How a dialog's scrim fades in. */
const SCRIM = "scrim-in 200ms cubic-bezier(0.22, 0.61, 0.36, 1) both";

export type DialogProps = {
  title: string;
  /** One line under the title. */
  subtitle?: string;
  /** The choices; give each a {@link DialogOption}. */
  children: ReactNode;
  /** The last row, usually a note and a quiet button. */
  footer?: ReactNode;
  /** Stacking order inside the surface it covers. */
  zIndex?: number | string;
  /** Leaves with its exit animation. */
  leaving?: boolean;
};

/** A dialog over the surface it sits in: a dim scrim and a bone panel that grows in, holding a title and a few choices. */
export function Dialog({ title, subtitle, children, footer, zIndex = "var(--z-scrim)", leaving = false }: DialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={leaving ? "scrim scrim-leaving" : "scrim"}
      style={{ background: "rgba(44, 48, 42, 0.22)", zIndex, animation: leaving ? undefined : SCRIM }}
    >
      <div className={leaving ? "dialog-panel dialog-leaving" : "dialog-panel"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
          {subtitle ? <Truncate text={subtitle} style={{ minWidth: 0, fontSize: 13, color: "var(--ink-muted)" }} /> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
        {footer ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{footer}</div> : null}
      </div>
    </div>
  );
}

/** How a dialog choice reads: the solid default, a quiet outline, or a destructive tint. */
export type DialogOptionTone = "fill" | "outline" | "danger";

/** Hover treatment per dialog choice: the solid one darkens, the destructive one deepens its tint, the outline washes in sage. */
const OPTION_HOVER: Record<DialogOptionTone, string> = { fill: "ui-hover-solid", outline: "ui-hover-fill", danger: "ui-hover-danger" };

export type DialogOptionProps = {
  tone: DialogOptionTone;
  title: string;
  detail: string;
  onClick: () => void;
};

/** One choice in a {@link Dialog}: a title and a line saying what it does. */
export function DialogOption({ tone, title, detail, onClick }: DialogOptionProps) {
  return (
    <button type="button" className={`dialog-option dialog-option-${tone} ui-trans ${OPTION_HOVER[tone]}`} onClick={onClick}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 12.5, lineHeight: "17px", opacity: tone === "fill" ? 0.9 : 1, color: tone === "outline" ? "var(--ink-muted)" : "inherit" }}>{detail}</span>
    </button>
  );
}

export type ModalProps = {
  /** The accessible name, such as "Browser 3f2a91". */
  label: string;
  /** Panel width and height: px, or any CSS length such as `min(1120px, calc(100% - 96px))`. */
  width: number | string;
  height: number | string;
  /** Where the panel grows from, as a CSS transform origin; the preview it opened from. */
  origin?: string;
  /** Leaves with its exit animation. */
  leaving?: boolean;
  children: ReactNode;
};

/** A near-window modal: a scrim over the window and a panel that grows out of `origin`, holding a header, a body and a footer. */
export function Modal({ label, width, height, origin = "62% 58%", leaving = false, children }: ModalProps) {
  return (
    <div className={leaving ? "scrim scrim-leaving" : "scrim"} style={{ background: "rgba(44, 48, 42, 0.34)", zIndex: "var(--z-modal)", animation: leaving ? undefined : "scrim-in 220ms cubic-bezier(0.22, 0.61, 0.36, 1) both" }}>
      <div role="dialog" aria-modal="true" aria-label={label} className={leaving ? "modal-panel modal-leaving" : "modal-panel"} style={{ width, height, transformOrigin: origin }}>
        {children}
      </div>
    </div>
  );
}

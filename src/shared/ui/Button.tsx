import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** How loud a button is: the soft sage tint (the default), quiet text, the solid primary, or a destructive tint. */
export type ButtonTone = "sage" | "quiet" | "fill" | "danger";

/** The button scale: 20 (a text action inside a dense row or tile), 28, 32, 36 and 40 px tall; `rail` is 40 px for an action rail. Buttons are standalone: no border and no track, which is what Segmented keeps. */
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl" | "rail";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Fully rounded ends instead of the size's radius. */
  pill?: boolean;
  /** An icon drawn before the label, 13 px in the small size and 14 px otherwise. */
  icon?: IconName;
  /** Take an equal share of the row, for a {@link ButtonGroup}. */
  equal?: boolean;
  /** The chosen one of a few, marked for assistive technology and drawn raised. */
  selected?: boolean;
  children: ReactNode;
};

/** A text button: label centred, height from the scale, never narrower than its label. */
export function Button({ tone = "sage", size = "md", pill = false, icon, equal = false, selected, className, type = "button", children, ...rest }: ButtonProps) {
  const classes = ["btn", `btn-${size}`, `btn-${tone}`, "ui-trans", pill ? "btn-pill" : "", equal ? "btn-equal" : "", className ?? ""];
  return (
    <button type={type} className={classes.filter(Boolean).join(" ")} aria-pressed={selected} {...rest}>
      {icon ? <Icon name={icon} size={size === "sm" ? 13 : 14} /> : null}
      {children}
    </button>
  );
}

export type ButtonGroupProps = {
  /** Where the buttons sit along the row. */
  justify?: "flex-start" | "center" | "flex-end" | "space-between";
  /** Let the buttons drop to a second line when the row is too narrow for them. */
  wrap?: boolean;
  children: ReactNode;
};

/** Buttons side by side on one 8 px gap. Give each `equal` to share the width. */
export function ButtonGroup({ justify = "flex-start", wrap = false, children }: ButtonGroupProps) {
  return (
    <div className="btn-group" style={{ justifyContent: justify, ...(wrap ? { flexWrap: "wrap" } : {}) }}>
      {children}
    </div>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: IconName;
  /** The accessible name and the tooltip. */
  label: string;
  /** Width and height in px. */
  size?: number;
  /** The icon's size in px. */
  iconSize?: number;
  /** The chosen one of a few, marked for assistive technology and washed in sage. */
  selected?: boolean;
};

/** A square icon control with an accessible name. */
export function IconButton({ icon, label, size = 32, iconSize = 16, selected, className, type = "button", style, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className={["icon-btn", "ui-trans", "ui-hover-fill", className ?? ""].filter(Boolean).join(" ")}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

export type PillProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  active?: boolean;
  /** A count shown after the label. */
  count?: number;
  children: ReactNode;
};

/** A filter chip: sage when idle, solid when active. */
export function Pill({ active = false, count, className, type = "button", children, ...rest }: PillProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={["pill", "ui-trans", active ? "ui-hover-solid" : "ui-hover-fill", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
      {count === undefined ? null : <span style={{ fontSize: 12, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{count}</span>}
    </button>
  );
}

/** Props of {@link TextLink}. */
export type TextLinkProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
};

/** A link-weight control inside running text: sage, semibold, underlined on hover ("message the agent", "Show all", an agent's name). */
export function TextLink({ className, type = "button", children, ...rest }: TextLinkProps) {
  return (
    <button type={type} className={["ui-trans", "font-semibold", "text-sage-text", "hover:underline", className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {children}
    </button>
  );
}

/** Props of {@link SplitButton}. */
export type SplitButtonProps = {
  /** The main action's words. */
  children: ReactNode;
  onClick: () => void;
  /** Opens the menu of other actions, given the control's box so the menu can sit under it. */
  onMenu: (anchor: DOMRect) => void;
  /** The menu opener's accessible name; it is also its tooltip. */
  menuLabel: string;
  disabled?: boolean;
};

/** One solid control of two parts: the main action, and a 32 px chevron at its end that opens a menu of the others. 36 px tall, 12 px radius. */
export function SplitButton({ children, onClick, onMenu, menuLabel, disabled = false }: SplitButtonProps) {
  return (
    <div className="flex h-9 flex-none items-stretch overflow-hidden rounded-[12px] bg-sage-deep text-bone">
      <button type="button" disabled={disabled} onClick={onClick} className="ui-trans ui-hover-solid px-4 text-[14px] font-semibold whitespace-nowrap disabled:opacity-60">
        {children}
      </button>
      <button
        type="button"
        aria-label={menuLabel}
        aria-haspopup="menu"
        title={menuLabel}
        disabled={disabled}
        onClick={(event) => onMenu(event.currentTarget.parentElement!.getBoundingClientRect())}
        className="ui-trans ui-hover-solid flex w-8 items-center justify-center border-l border-bone/25 disabled:opacity-60"
      >
        <Icon name="chevDown" size={14} />
      </button>
    </div>
  );
}

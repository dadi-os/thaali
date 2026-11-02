import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** How loud a button is: an outlined default, a sage wash, quiet text, the solid primary, or a destructive tint. */
export type ButtonTone = "outline" | "sage" | "quiet" | "fill" | "danger";

/** The button scale: 28, 32, 36 and 40 px tall. */
export type ButtonSize = "sm" | "md" | "lg" | "xl";

/** Hover treatment per tone: the solid tone darkens, the destructive one deepens its tint, the rest wash in sage. */
const HOVER: Record<ButtonTone, string> = {
  outline: "ui-hover-fill",
  sage: "ui-hover-fill",
  quiet: "ui-hover-fill",
  fill: "ui-hover-solid",
  danger: "ui-hover-danger",
};

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
export function Button({ tone = "outline", size = "md", pill = false, icon, equal = false, selected, className, type = "button", children, ...rest }: ButtonProps) {
  const classes = ["btn", `btn-${size}`, `btn-${tone}`, "ui-trans", HOVER[tone], pill ? "btn-pill" : "", equal ? "btn-equal" : "", className ?? ""];
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

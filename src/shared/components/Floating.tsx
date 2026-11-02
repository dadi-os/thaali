import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Truncate } from "./Truncate";

export type MenuPanelProps = {
  children: ReactNode;
};

/** A menu: a bone panel, 220 px wide, that slides up as it opens. */
export function MenuPanel({ children }: MenuPanelProps) {
  return <div role="menu" className="floating menu-panel">{children}</div>;
}

export type MenuItemProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon: IconName;
  /** Wash the row in sage, for the current choice. */
  on?: boolean;
  /** Show a check after the label. */
  check?: boolean;
};

/** One row of a menu: an icon, a label that truncates, and an optional check. */
export function MenuItem({ label, icon, on = false, check = false, className, type = "button", ...rest }: MenuItemProps) {
  return (
    <button
      type={type}
      role="menuitem"
      className={["menu-item", on ? "menu-item-on" : "", "ui-trans", "ui-hover-fill", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      <span style={{ display: "flex", color: "var(--ink-muted)" }}>
        <Icon name={icon} size={15} />
      </span>
      <Truncate text={label} style={{ flex: 1, minWidth: 0 }} />
      {check ? (
        <span style={{ display: "flex", color: "var(--sage-deep)" }}>
          <Icon name="check" size={15} />
        </span>
      ) : null}
    </button>
  );
}

export type PopoverPanelProps = {
  children: ReactNode;
};

/** A popover's surface: a bone panel, 292 px wide, that slides up as it opens. */
export function PopoverPanel({ children }: PopoverPanelProps) {
  return <div className="floating popover-panel">{children}</div>;
}

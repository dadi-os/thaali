import type { AriaRole, KeyboardEvent, ReactNode } from "react";

export type WidgetFrameProps = {
  title: string;
  /** Live one-liner opposite the title ("2 working · 23 agents"); absent until its data is in. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  role?: AriaRole;
  tabIndex?: number;
};

/**
 * Glass widget panel with a quiet title row — the name on the left and its live status on
 * the right in light type over the veil, no heavy chrome, so the frosted frame stays the lead.
 */
export function WidgetFrame({
  title,
  aside,
  children,
  className,
  onClick,
  onKeyDown,
  role,
  tabIndex,
}: WidgetFrameProps) {
  return (
    <div
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`widget-frame ${className ?? ""}`}
    >
      <header className="widget-frame__chrome">
        <span className="widget-frame__title">{title}</span>
        {aside ? <span className="widget-frame__aside">{aside}</span> : null}
      </header>
      <div className="widget-frame__body">{children}</div>
    </div>
  );
}

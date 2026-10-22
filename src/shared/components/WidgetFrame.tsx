import type { AriaRole, KeyboardEvent, ReactNode } from "react";

export type WidgetFrameProps = {
  title: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  role?: AriaRole;
  tabIndex?: number;
};

/**
 * A home widget: a quiet title row over its content, sitting straight on the
 * window's field with no card around it, so the grid reads as one canvas.
 */
export function WidgetFrame({
  title,
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
      </header>
      <div className="widget-frame__body">{children}</div>
    </div>
  );
}

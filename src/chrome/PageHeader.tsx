import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../shared/ui/Icon";
import { Truncate } from "../shared/ui/Truncate";

export type PageHeaderProps = {
  title: string;
  /** One line under the title that sums up what the page holds, from its data. */
  meta?: string;
  /** Optional control on the right, on the title's row. */
  trailing?: ReactNode;
};

/**
 * The sub-header of a full page under the app frame: a back control to Home, the page's name in
 * tracked capitals and, under it, a line that says what the page holds. Actions go in `trailing`,
 * not stacked under the title.
 */
export function PageHeader({ title, meta, trailing }: PageHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 40, flex: "none" }}>
      <Link
        to="/"
        aria-label="Back to home"
        className="ui-trans ui-hover-fill"
        style={{ width: 32, height: 32, borderRadius: 9, border: "1px dashed var(--sage-line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sage-deep)", flex: "none" }}
      >
        <Icon name="back" size={14} />
      </Link>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2.5px", color: "var(--sage-deep)", textTransform: "uppercase" }}>{title}</span>
        {meta ? <Truncate text={meta} style={{ fontSize: 13, color: "var(--ink-muted)" }} /> : null}
      </div>
      {trailing}
    </div>
  );
}

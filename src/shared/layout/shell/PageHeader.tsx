import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../ui/Icon";
import { Truncate } from "../../ui/Truncate";

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
    <div className="flex min-h-10 flex-none items-center gap-4">
      <Link
        to="/"
        draggable={false}
        aria-label="Back to home"
        className="ui-trans ui-hover-fill flex size-8 flex-none items-center justify-center rounded-[10px] border border-dashed border-sage-line text-sage-deep"
      >
        <Icon name="back" size={14} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="ui-label text-sage-deep">{title}</span>
        {meta ? <Truncate text={meta} className="text-[13px] text-ink-muted" /> : null}
      </div>
      {trailing}
    </div>
  );
}

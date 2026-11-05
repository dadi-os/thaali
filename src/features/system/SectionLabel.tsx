import type { ReactNode } from "react";

export type SectionLabelProps = {
  /** The section's name, drawn in tracked capitals. */
  children: string;
  /** What sits at the row's far end, such as a count. */
  right?: ReactNode;
};

/** The label above a block of the System page: its name at the left and, at the right, a short line about it. */
export function SectionLabel({ children, right }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2.5 px-1 pt-1.5">
      <span className="ui-label">{children}</span>
      <div className="flex-1" />
      {right}
    </div>
  );
}

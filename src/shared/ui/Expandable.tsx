import { useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { REVEAL } from "../motion";
import { Icon } from "./Icon";

/** How an {@link Expandable} sits: a `card` that takes a border and a raised fill while open (a wake, a charter, a group of tasks), or a bare compact `row` (a tool call, a thought). */
export type ExpandableLook = "card" | "row";

/** Props of {@link Expandable}. */
export type ExpandableProps = {
  /** The summary line: what this is. It may hold links; they keep their own clicks. */
  title: ReactNode;
  /** A quieter line under the title: the facts of what is inside ("4 min ago · ran 2m · 6 tool calls"). */
  secondary?: ReactNode;
  /** Plain type at the row's end: an outcome ("Yielded"), a count ("×12"), a size. Not a pill. */
  trailing?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** `card` (the default) or `row`. */
  look?: ExpandableLook;
  /** The border colour of a `card` that needs attention, such as a failed wake. */
  tone?: "late";
  /** What opens: it eases open inline with the REVEAL preset and is mounted only while open. */
  children: ReactNode;
};

/**
 * The one expandable row of the app: a summary row with a chevron that turns a quarter, a title, a quieter secondary line and
 * a trailing value, opening inline to its content. The whole row is the control: it is a real button underneath (Enter and
 * Space work, `aria-expanded` and the title as its name), with hover and press washes and the focus ring; links and buttons
 * inside the title stay clickable. A `card` takes a hairline border and a raised fill while open (a failed one keeps the late
 * border), 14 px radius, 12 px sides; a `row` is a bare 28 px line. The content is indented to start under the title.
 */
export function Expandable({ title, secondary, trailing, open, onToggle, look = "card", tone, children }: ExpandableProps) {
  const id = useId();
  const card = look === "card";
  return (
    <div className={card ? `flex flex-col rounded-[14px] border transition-[background-color,border-color] duration-slow ease-dadi ${tone === "late" ? "border-[var(--late-line)]" : open ? "border-glass-border bg-bone-raised" : "border-transparent"}` : "flex flex-col"}>
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-labelledby={id}
          onClick={onToggle}
          className={`ui-trans absolute inset-0 w-full hover:bg-sage-active/50 active:bg-sage-active ${card ? "rounded-[14px]" : "rounded-[8px]"}`}
        />
        <div className={`pointer-events-none relative flex items-start gap-2.5 ${card ? "px-3 py-2.5" : "px-1.5 py-1"}`}>
          <span className={`mt-[5px] flex size-3 flex-none text-ink-muted transition-[rotate] duration-slow ease-dadi ${open ? "rotate-90" : ""}`}>
            <Icon name="chevron" size={12} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div id={id} className={`min-w-0 [overflow-wrap:anywhere] [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10 ${card ? "text-[13.5px] font-semibold" : "text-[12.5px]"}`}>
              {title}
            </div>
            {secondary === undefined ? null : <div className="text-[12px] leading-[17px] text-ink-muted">{secondary}</div>}
          </div>
          {trailing === undefined ? null : <div className="flex-none pt-px text-[12px] text-ink-muted tabular-nums">{trailing}</div>}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="content" {...REVEAL} className="overflow-hidden">
            <div className={card ? "px-3 pb-3 pl-[34px]" : "pb-1 pl-[26px]"}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

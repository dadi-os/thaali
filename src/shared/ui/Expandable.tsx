import { Children, useId, type HTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE, FAST_S, REVEAL, SLOW_S } from "../motion";
import { Icon, type IconName } from "./Icon";

/**
 * How an {@link Expandable} sits.
 * - `folder`: a 40 px tree row, a folder glyph that opens, a title, a count and a chevron, its children under a connector line (Chaavi folders, Someday groups, the Done fold).
 * - `card`: a summary row with a facts line that takes a hairline border and a raised fill while open (a wake, a routine, the charter).
 * - `row`: a bare compact line (a tool call, a thought).
 */
export type ExpandableLook = "folder" | "card" | "row";

/** Props of {@link Expandable}. */
export type ExpandableProps = {
  /** The summary line: what this is. It may hold links; they keep their own clicks. */
  title: ReactNode;
  /** A quieter line under the title: the facts of what is inside ("4 min ago · ran 2m · 6 tool calls"). */
  secondary?: ReactNode;
  /** Plain type at the row's end: an outcome ("Yielded"), a count ("12"), a size. Not a pill. */
  trailing?: ReactNode;
  /** A glyph before the title: the `folder` look draws a folder (that opens when the row does) unless this names another. */
  icon?: IconName;
  open: boolean;
  onToggle: () => void;
  look?: ExpandableLook;
  /** The border colour of a `card` that needs attention, such as a failed wake. */
  tone?: "late";
  /** `folder` look: this row is the chosen one (a sage wash, semibold title). */
  selected?: boolean;
  /** `folder` look: something is dragged over the row or has just landed on it. */
  hot?: boolean;
  /**
   * `folder` look: given, the title is its own control (it chooses the folder) and only the chevron toggles; left out, the
   * whole row toggles.
   */
  onSelect?: () => void;
  /** `folder` look: controls shown in place of the count while the row is hovered or focused (add, rename, delete). */
  actions?: ReactNode;
  /** Attributes for the `folder` row itself: a drop target's `data-drop`, a context menu's handlers. */
  rowProps?: HTMLAttributes<HTMLDivElement> & { "data-drop"?: string };
  /** What opens, inline with the REVEAL preset, mounted only while open. In the `folder` look its children enter one after another. Left out, a `folder` row is a leaf: no chevron. */
  children?: ReactNode;
};

/** How many children are staggered before the rest enter together. */
const STAGGER_MAX = 8;
/** The delay between one child's entrance and the next, in seconds. */
const STAGGER_S = 0.035;

/**
 * The one expander family of the app. All looks share the behaviour: a real button underneath (Enter and Space work,
 * `aria-expanded`, the title as its name), hover and press washes, the focus ring, and content that eases open inline with the
 * REVEAL preset and is mounted only while open. The `folder` look adds a tree: a folder glyph that crossfades to its open form, a
 * count, and the children under a connector line with an elbow to each, entering one after another; a leaf `folder` row has no
 * chevron and lines up with its siblings. The `card` look is the wake row: title over a facts line, a trailing outcome, and a
 * raised bordered card while open.
 */
export function Expandable({ title, secondary, trailing, icon, open, onToggle, look = "card", tone, selected = false, hot = false, onSelect, actions, rowProps, children }: ExpandableProps) {
  const id = useId();
  if (look === "folder") {
    const branch = children !== undefined;
    const glyph: IconName = icon ?? (open && branch ? "folderOpen" : "folder");
    const rowStyle = hot ? { background: "var(--sage-active)", boxShadow: "0 0 0 3px var(--sage-faint)" } : undefined;
    return (
      <div className="flex flex-col">
        <div
          {...rowProps}
          className={`xrow ui-trans relative flex h-10 flex-none items-center gap-1 rounded-[12px] pr-2 pl-1 ui-hover-fill ${selected ? "hl-on" : ""} ${rowProps?.className ?? ""}`}
          style={{ ...rowStyle, ...rowProps?.style }}
        >
          {onSelect === undefined ? (
            <button type="button" aria-expanded={branch ? open : undefined} aria-labelledby={id} onClick={onToggle} className="absolute inset-0 rounded-[12px]" />
          ) : null}
          {branch ? (
            <button
              type="button"
              aria-label={onSelect === undefined ? undefined : `${open ? "Collapse" : "Expand"} ${typeof title === "string" ? title : "folder"}`}
              aria-expanded={onSelect === undefined ? undefined : open}
              tabIndex={onSelect === undefined ? -1 : 0}
              onClick={onSelect === undefined ? undefined : onToggle}
              className={`ui-trans relative flex size-7 flex-none items-center justify-center rounded-[8px] text-ink-muted ${onSelect === undefined ? "pointer-events-none" : "hover:text-ink"}`}
            >
              <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: SLOW_S, ease: EASE }} className="flex">
                <Icon name="chevron" size={12} />
              </motion.span>
            </button>
          ) : (
            <span className="size-7 flex-none" />
          )}
          <div className={`relative flex min-w-0 flex-1 items-center ${onSelect === undefined ? "pointer-events-none" : ""}`}>
            {(() => {
              const content = (
                <>
                  <span className={`relative flex size-5 flex-none items-center justify-center ${selected ? "text-sage-text" : open ? "text-sage-text" : "text-ink-muted"} transition-colors duration-slow ease-dadi`}>
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span key={glyph} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: FAST_S, ease: EASE }} className="flex">
                        <Icon name={glyph} size={16} />
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  <span id={id} className={`min-w-0 flex-1 truncate text-[14px] ${selected ? "font-semibold" : "font-medium"} text-ink`}>
                    {title}
                  </span>
                </>
              );
              return onSelect === undefined ? (
                <div className="flex min-w-0 flex-1 items-center gap-2.5">{content}</div>
              ) : (
                <button type="button" aria-current={selected ? "true" : "false"} onClick={onSelect} className="ui-trans flex h-10 min-w-0 flex-1 items-center gap-2.5 text-left">
                  {content}
                </button>
              );
            })()}
          </div>
          {trailing === undefined ? null : <span className="xcount relative text-[13px] text-ink-muted tabular-nums">{trailing}</span>}
          {actions === undefined ? null : <span className="xact relative">{actions}</span>}
        </div>
        <AnimatePresence initial={false}>
          {open && branch ? (
            <motion.div key="children" {...REVEAL} className="overflow-hidden">
              <div className="relative ml-[17px] flex flex-col border-l border-rule pl-2">
                {Children.toArray(children).map((child, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: SLOW_S, ease: EASE, delay: Math.min(index, STAGGER_MAX) * STAGGER_S }}
                    className="relative before:absolute before:top-5 before:-left-2 before:h-px before:w-2 before:bg-rule"
                  >
                    {child}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  const card = look === "card";
  return (
    <div className={card ? `flex flex-col rounded-[14px] border transition-[background-color,border-color] duration-slow ease-dadi ${tone === "late" ? "border-[var(--late-line)]" : open ? "border-glass-border bg-bone-raised" : "border-transparent"}` : "flex flex-col"}>
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-labelledby={id}
          onClick={onToggle}
          className={`ui-trans ui-hover-fill absolute inset-0 w-full ${card ? "rounded-[14px]" : "rounded-[8px]"}`}
        />
        <div className={`pointer-events-none relative flex items-start gap-2.5 ${card ? "px-3 py-2.5" : "px-1.5 py-1"}`}>
          <span className={`mt-[5px] flex size-3 flex-none text-ink-muted transition-[rotate] duration-slow ease-dadi ${open ? "rotate-90" : ""}`}>
            <Icon name="chevron" size={12} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-start gap-2">
              <div id={id} className={`min-w-0 flex-1 [overflow-wrap:anywhere] [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_button]:relative [&_button]:z-10 ${card ? "text-[13.5px] font-semibold" : "text-[12.5px]"}`}>
                {title}
              </div>
              {trailing === undefined ? null : <div className="flex-none pt-px text-[12px] text-ink-muted tabular-nums">{trailing}</div>}
            </div>
            {secondary === undefined ? null : <div className="text-[12px] leading-[17px] text-ink-muted">{secondary}</div>}
          </div>
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

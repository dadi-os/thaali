import type { ReactNode } from "react";
import { Icon } from "../../ui/Icon";
import { ScaledFrame, type SourceSize } from "../../ui/ScaledFrame";
import { Truncate } from "../../ui/Truncate";

/** What a preview's content is laid out at before it scales to the container: a 16:9 browser viewport, and a terminal of 80 columns by 12 lines. */
export const PREVIEW_SOURCE: Record<"browser" | "terminal", SourceSize> = {
  browser: { width: 960, height: 540 },
  terminal: { width: 600, height: 224 },
};

export type TaskPreviewProps = {
  kind: "browser" | "terminal";
  /** The page address of a browser, or the id and slot of a terminal. */
  caption: string;
  /** The accessible name, such as "Open browser task 3f2a91". */
  label: string;
  /** What the helper holds: its page for a browser, its output for a terminal, drawn at {@link PREVIEW_SOURCE} size. */
  children: ReactNode;
  onOpen: () => void;
};

/**
 * A helper's live screen, drawn as a browser window or a terminal. The whole frame is the button: hover shows an
 * expand mark, and a click opens the takeover. The chrome is the shell; the page or output is the child, scaled to the frame's width.
 */
export function TaskPreview({ kind, caption, label, children, onOpen }: TaskPreviewProps) {
  const browser = kind === "browser";
  return (
    <button
      type="button"
      className={`pv ui-trans ${browser ? "bg-[var(--paper)]" : "bg-[#23271f] text-[#dfe6d6]"}`}
      aria-label={label}
      title={label}
      onClick={onOpen}
    >
      {browser ? (
        <div className="flex h-7 items-center border-b border-rule bg-[var(--chrome)] px-2">
          <div className="flex h-5 min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-[var(--paper)] px-2 text-[11px] text-ink-muted">
            <Icon name="lock" size={10} />
            <Truncate text={caption} className="min-w-0 flex-1 text-[11px]" />
          </div>
        </div>
      ) : (
        <div className="flex h-10 items-center gap-2 bg-[#1b1e18] px-3 font-numeric text-[12px] text-[#a9b3a0]">
          <Icon name="terminal" size={12} />
          <Truncate text={caption} className="min-w-0 flex-1" />
        </div>
      )}
      <ScaledFrame source={PREVIEW_SOURCE[kind]}>{children}</ScaledFrame>
      <span className="pv-x" aria-hidden="true">
        <Icon name="expand" size={15} />
      </span>
    </button>
  );
}

import { useState } from "react";
import { Popover, type PopoverAnchor } from "../../shared/components/Popover";
import { formatDayShort } from "./dates";

export type QuickAddProps = {
  open: boolean;
  /** Day the entry is for; null adds without a day and lets Yaad read the date from the text. */
  day: Date | null;
  anchor: PopoverAnchor;
  onClose: () => void;
  /** Submit the typed text; the composer closes and the timeline tracks the save. */
  onSubmit: (text: string) => void;
};

/**
 * Free-text composer for the timeline: "lunch with Riya 1pm" or "met Sparsh at the
 * lake" becomes a plan or a memory once Yaad files it. Enter submits, Shift+Enter
 * breaks the line.
 */
export function QuickAdd({ open, day, anchor, onClose, onSubmit }: QuickAddProps) {
  const [text, setText] = useState("");
  const trimmed = text.trim();

  const submit = () => {
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  return (
    <Popover open={open} onClose={onClose} anchor={anchor} aria-label="Add to timeline" widthPx={320}>
      <div className="flex flex-col gap-2 px-4 pt-3.5 pb-3">
        <span className="text-[11px] font-medium tracking-[2px] text-sage-deep">
          {day ? `ADD TO ${formatDayShort(day).toUpperCase()}` : "ADD TO YAAD"}
        </span>
        <textarea
          autoFocus
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={day ? "Lunch with Riya at 1pm" : "Dinner with Maa Friday at 7"}
          className="w-full resize-none rounded-[6px] bg-sage-fill px-2.5 py-2 text-[13px] leading-snug text-ink outline-none ring-1 ring-sage-line/60 placeholder:text-ink-ghost focus:ring-sage-line"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-ghost">Plans, memories, anything</span>
          <button
            type="button"
            disabled={!trimmed}
            onClick={submit}
            className="rounded-full bg-sage-active px-3 py-1 text-[12px] text-sage-deep transition-colors duration-slow ease-dadi enabled:hover:bg-sage-line/50 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </Popover>
  );
}

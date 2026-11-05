import { useLayoutEffect, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useDismiss } from "../../shared/interaction/dismiss";
import { RISE } from "../../shared/motion";
import { IconButton } from "../../shared/ui/Button";
import { Icon } from "../../shared/ui/Icon";
import { pasteAsFile, type DraftAttachment } from "../../shared/lib/content/attachments";

/** The open dock's textarea bounds, line height and padding around the field, from the composer it grows into. */
const FIELD = { min: 40, max: 160, pad: 8, chips: 68 } as const;

export type DockProps = {
  /** The composer is showing instead of the "Talk to Dadi" bar. */
  open: boolean;
  /** The router is running: its ring turns on the glyph and a send waits. */
  routing: boolean;
  /** The mesh is out of reach: the dock is dimmed and cannot send. */
  offline: boolean;
  draft: string;
  onDraft: (text: string) => void;
  attachments: DraftAttachment[];
  onRemoveAttachment: (index: number) => void;
  /** Add files to the draft: pasted, dropped, or a long paste turned into a text file. */
  onPickFiles: (files: FileList | File[]) => void;
  /** Open the file picker for the draft's attachments. */
  onAttach: () => void;
  onOpen: () => void;
  onClose: () => void;
  /** Send the draft to the router. */
  onSend: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

/** What the bar says under "Talk to Dadi". */
function subline(routing: boolean, offline: boolean): string {
  return offline ? "dadi unreachable" : routing ? "Routing" : "Start something new";
}

/**
 * The router dock, the only way into Dadi: a glass bar at the foot of the conversation list that
 * grows in one motion into the composer, and settles back to the bar when a message is sent. While
 * the router runs, a ring turns on the bar's glyph; nothing else reports what the router did.
 * The height follows the field: its text wraps to as many lines as it needs, up to 160 px.
 */
export function Dock({
  open,
  routing,
  offline,
  draft,
  onDraft,
  attachments,
  onRemoveAttachment,
  onPickFiles,
  onAttach,
  onOpen,
  onClose,
  onSend,
  textareaRef,
}: DockProps) {
  const [fieldHeight, setFieldHeight] = useState<number>(FIELD.min);
  useDismiss({ open, onDismiss: onClose });

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    el.style.height = "auto";
    setFieldHeight(Math.min(FIELD.max, Math.max(FIELD.min, el.scrollHeight)));
    el.style.height = "";
  }, [draft, open, textareaRef]);

  useLayoutEffect(() => {
    if (open) {
      textareaRef.current?.focus();
    }
  }, [open, textareaRef]);

  const height = FIELD.pad * 2 + fieldHeight + (attachments.length > 0 ? FIELD.chips : 0);
  const canSend = (draft.trim().length > 0 || attachments.length > 0) && !routing && !offline;
  const sub = subline(routing, offline);
  const placeholder = offline ? "dadi unreachable" : "Talk to Dadi";
  const classes = ["dock", open ? "open" : "", routing ? "routing" : "", offline ? "disabled" : ""].filter(Boolean).join(" ");

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };

  return (
    <div className={classes} style={{ "--dh": `${height}px` } as CSSProperties} data-dock>
      <button type="button" className="d-idle" aria-label="Talk to Dadi" onClick={onOpen}>
        <span className="dglyph">
          <span className="dring" />દ
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
          <span className="text-[14.5px] leading-[19px] font-semibold">Talk to Dadi</span>
          <span title={sub} className="truncate text-[13px] leading-[17px] text-ink-muted">
            {sub}
          </span>
        </span>
        <span className="dkbd">⌘K</span>
      </button>
      <div className="d-open" aria-hidden={!open}>
        <AnimatePresence initial={false}>
          {attachments.length > 0 ? (
            <motion.div key="staged" {...RISE} className="flex items-start gap-2 pt-3 pr-[18px] pl-3.5" style={{ height: FIELD.chips }}>
              {attachments.map((att, index) => (
                <motion.span key={`${att.filename ?? att.media_type}-${index}`} {...RISE} className="relative flex-none">
                  <span className="flex h-14 max-w-36 flex-col justify-center rounded-xl bg-sage-fill py-0 pr-4 pl-2.5 text-[11px] leading-[14px] text-ink-muted">
                    <span data-selectable title={att.filename ?? "file"} className="truncate">
                      {att.filename ?? "file"}
                    </span>
                    <span>{att.media_type.startsWith("image/") ? "image" : "file"}</span>
                  </span>
                  <span className="absolute -top-3 -right-3">
                    <IconButton icon="close" label="Remove attachment" size={32} iconSize={11} onClick={() => onRemoveAttachment(index)} />
                  </span>
                </motion.span>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div
          className="flex items-end gap-1"
          style={{ padding: FIELD.pad }}
          onDragOver={(e) => {
            if (!offline && e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            if (!offline && e.dataTransfer.files.length > 0) {
              e.preventDefault();
              onPickFiles(e.dataTransfer.files);
            }
          }}
        >
          <IconButton icon="plus" label="Attach a file" size={40} iconSize={18} disabled={offline} onClick={onAttach} />
          <textarea
            ref={textareaRef}
            className="dta"
            rows={1}
            aria-label="Message to Dadi"
            placeholder={placeholder}
            value={draft}
            disabled={offline}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length > 0) {
                e.preventDefault();
                onPickFiles(files);
                return;
              }
              const pasted = pasteAsFile(e.clipboardData.getData("text"));
              if (pasted) {
                e.preventDefault();
                onPickFiles([pasted]);
              }
            }}
            style={{ height: fieldHeight }}
          />
          <button
            type="button"
            aria-label="Send"
            title={routing ? "Dadi is routing" : "Send"}
            disabled={!canSend}
            onClick={onSend}
            className="dsend mb-0.5"
          >
            <Icon name="send" size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

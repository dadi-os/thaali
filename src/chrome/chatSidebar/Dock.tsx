import { useLayoutEffect, useState, type CSSProperties, type KeyboardEvent, type RefObject } from "react";
import { Icon } from "../../shared/ui/Icon";
import { pasteAsFile, type DraftAttachment } from "../../shared/lib/content/attachments";

/** The open dock's textarea bounds, line height and padding around the field, from the composer it grows into. */
const FIELD = { min: 40, max: 160, pad: 8, chips: 68 } as const;
/** How a staged attachment tile eases in. */
const TILE_IN = "rise 220ms cubic-bezier(.22,.61,.36,1) both";

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
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className={classes} style={{ "--dh": `${height}px` } as CSSProperties} data-dock>
      <button type="button" className="d-idle" aria-label="Talk to Dadi" onClick={onOpen}>
        <span className="dglyph">
          <span className="dring" />દ
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1, textAlign: "left" }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: "19px" }}>Talk to Dadi</span>
          <span title={sub} style={{ fontSize: 13, lineHeight: "17px", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sub}
          </span>
        </span>
        <span className="dkbd">⌘K</span>
      </button>
      <div className="d-open" aria-hidden={!open}>
        {attachments.length > 0 ? (
          <div style={{ display: "flex", gap: 8, padding: "12px 18px 0 14px", height: FIELD.chips, alignItems: "flex-start", overflow: "visible" }}>
            {attachments.map((att, index) => (
              <span key={`${att.filename ?? att.media_type}-${index}`} style={{ position: "relative", flex: "none", animation: TILE_IN }}>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    height: 56,
                    maxWidth: 144,
                    padding: "0 16px 0 10px",
                    borderRadius: 12,
                    border: "1px solid var(--rule)",
                    background: "var(--sage-fill)",
                    fontSize: 11,
                    lineHeight: "14px",
                    color: "var(--ink-muted)",
                  }}
                >
                  <span title={att.filename ?? "file"} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {att.filename ?? "file"}
                  </span>
                  <span style={{ color: "var(--ink-muted)" }}>{att.media_type.startsWith("image/") ? "image" : "file"}</span>
                </span>
                <button
                  type="button"
                  className="ui-trans"
                  aria-label="Remove attachment"
                  onClick={() => onRemoveAttachment(index)}
                  style={{ position: "absolute", top: -12, right: -12, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <span
                    style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--bone)", color: "var(--ink-muted)", boxShadow: "var(--shadow)", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Icon name="close" size={11} />
                  </span>
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div
          style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: FIELD.pad, boxSizing: "border-box" }}
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
          <button
            type="button"
            className="ui-trans ui-hover-fill"
            aria-label="Attach a file"
            title="Attach a file"
            disabled={offline}
            onClick={onAttach}
            style={{ width: 40, height: 40, marginBottom: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sage-deep)", flex: "none" }}
          >
            <Icon name="plus" size={18} />
          </button>
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
            className="dsend"
            aria-label="Send"
            title={routing ? "Dadi is routing" : "Send"}
            disabled={!canSend}
            onClick={onSend}
            style={{ marginBottom: 2 }}
          >
            <Icon name="send" size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

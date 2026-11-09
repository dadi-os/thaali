import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { attachmentSizeLabel, pasteAsFile, type DraftAttachment } from "../../lib/content/attachments";
import type { ActionList } from "../../interaction/actions";
import { AnchoredMenu } from "../../overlay/AnchoredMenu";
import { FADE, RISE } from "../../motion";
import { IconButton } from "../../ui/Button";
import { Icon } from "../../ui/Icon";

/** Props of {@link Composer}. */
export type ComposerProps = {
  connected: boolean;
  draft: string;
  setDraft: (v: string) => void;
  placeholder: string;
  canSubmit: boolean;
  /** Process lane busy (processing): sends go to the local queue. */
  processingMode: boolean;
  /** The work lane is running (and the process lane is not): the glass takes a live rim. */
  workingMode?: boolean;
  /** Floats above the field, such as the chip saying what the agent is doing. */
  above?: ReactNode;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  cameraInputRef: RefObject<HTMLInputElement | null>;
  attachments: DraftAttachment[];
  onRemoveAttachment: (index: number) => void;
  /** Add files to the draft: picked, pasted, dropped, or a long paste turned into a text file. */
  onPickFiles: (files: FileList | File[] | null) => void;
  onSubmit: (e: FormEvent) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Focus the field once this composer mounts (Talk to Dadi). */
  autoFocus?: boolean;
  /** Reports the composer's rendered height as it grows or shrinks. */
  onHeight: (px: number) => void;
  /** The tallest the field grows before it scrolls, in px. */
  fieldMaxPx: number;
};

/**
 * The thread's composer: one flat row on the rail's own surface, with no box around the field or the buttons.
 * Files dropped on it or pasted into it join the draft, and so does a paste over PASTE_ATTACHMENT_CHARS, as a
 * text file, instead of flooding the field. Staged files and the attach menu arrive and leave with motion.
 */
export function Composer({
  connected,
  draft,
  setDraft,
  placeholder,
  canSubmit,
  processingMode,
  workingMode = false,
  above,
  textareaRef,
  fileInputRef,
  cameraInputRef,
  attachments,
  onRemoveAttachment,
  onPickFiles,
  onSubmit,
  onKeyDown,
  autoFocus = false,
  onHeight,
  fieldMaxPx,
}: ComposerProps) {
  const [attachAnchor, setAttachAnchor] = useState<DOMRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const report = () => onHeight(Math.ceil(el.getBoundingClientRect().height));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeight]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    textareaRef.current?.focus();
  }, [autoFocus, textareaRef]);

  const attachActions: ActionList = [
    { id: "attach.file", label: "Attach file", icon: "clip", run: () => fileInputRef.current?.click() },
    { id: "attach.camera", label: "Take picture", icon: "camera", run: () => cameraInputRef.current?.click() },
  ];

  return (
    <motion.div ref={rootRef} {...RISE} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 pb-[0.65rem]">
      <div className="composer-fade" aria-hidden />
      <div className="relative z-10 px-3">
        {above}
        <AnimatePresence initial={false}>
          {!connected ? (
            <motion.p key="offline" {...FADE} className="pointer-events-none mb-1.5 px-1 text-center text-[11px] text-ink-ghost">
              Connect to message agent
            </motion.p>
          ) : null}
        </AnimatePresence>
        <form
          onSubmit={onSubmit}
          onDragOver={(e) => {
            if (connected && e.dataTransfer.types.includes("Files")) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            if (connected && e.dataTransfer.files.length > 0) {
              e.preventDefault();
              onPickFiles(e.dataTransfer.files);
            }
          }}
          className={`composer-glass pointer-events-auto flex flex-col gap-2 px-2 py-2 transition-[opacity,box-shadow] duration-slow ease-dadi ${workingMode && !processingMode ? "composer-glass--live" : ""} ${processingMode ? "composer-glass--processing" : ""} ${connected ? "" : "opacity-70"}`}
        >
          <AnimatePresence initial={false}>
            {attachments.length > 0 ? (
              <motion.div key="staged" {...RISE} className="flex gap-2 overflow-x-auto px-1.5 pt-1">
                <AnimatePresence initial={false}>
                  {attachments.map((att, index) => (
                    <motion.div key={`${att.filename ?? att.media_type}-${index}`} {...RISE} className="relative shrink-0">
                      {att.previewUrl ? (
                        <img src={att.previewUrl} alt={att.filename ?? "attachment"} className="size-14 rounded-[12px] object-cover" />
                      ) : (
                        <div className="flex h-14 max-w-[9rem] flex-col justify-center rounded-[12px] bg-sage-fill px-2.5 text-[11px] leading-tight text-ink-muted">
                          <span data-selectable className="truncate">
                            {att.filename ?? "file"}
                          </span>
                          <span className="truncate text-ink-ghost">{attachmentSizeLabel(att.media_type, att.sizeBytes)}</span>
                        </div>
                      )}
                      <span className="absolute -top-2 -right-2">
                        <IconButton icon="close" label="Remove attachment" size={32} iconSize={12} onClick={() => onRemoveAttachment(index)} />
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div data-bare-field className="flex items-end gap-1">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <span className="mb-0.5">
              <IconButton
                icon="plus"
                label="Attach"
                title={undefined}
                className="rounded-full"
                size={36}
                disabled={!connected}
                aria-expanded={attachAnchor !== null}
                onClick={(e) => setAttachAnchor(attachAnchor === null ? e.currentTarget.getBoundingClientRect() : null)}
              />
            </span>
            <AnchoredMenu actions={attachActions} anchor={attachAnchor} onClose={() => setAttachAnchor(null)} width={190} />
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
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
              rows={1}
              disabled={!connected}
              placeholder={connected ? placeholder : "Connect to message agent"}
              className={`scroll block min-h-[40px] w-full flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-snug outline-none placeholder:text-ink-ghost disabled:cursor-default ${
                processingMode ? "text-ink/70" : "text-ink"
              }`}
              style={{ maxHeight: fieldMaxPx }}
            />
            <button
              type="submit"
              aria-label={processingMode ? "Queue message" : "Send"}
              disabled={!canSubmit}
              className={`mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-slow ease-dadi ${
                canSubmit ? "bg-ink text-bone hover:opacity-90" : "bg-transparent text-ink-muted"
              } disabled:cursor-default`}
            >
              <Icon name="send" size={17} />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

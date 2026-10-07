import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { hath } from "../../../shared/api";
import { IconAttach, IconDismiss } from "../../../shared/components/IconButton";
import { MarkdownBody } from "../../../shared/components/Markdown";
import { useConnection } from "../../../shared/hooks/useConnection";
import {
  attachmentSizeLabel,
  isTextMediaType,
} from "../../../shared/lib/content/attachments";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import type { AttachmentSummary, MessageAttachment } from "../../../types/hath";

export type MessageFilesProps = {
  /** Files Hath stored with the message. */
  files: AttachmentSummary[];
  /** Files still on their way to Hath, shown by name until it confirms them. */
  sending: MessageAttachment[];
  /** Side of the thread the files sit on. */
  align: "start" | "end";
};

const chipClass =
  "inline-flex max-w-[15rem] items-center gap-1.5 rounded-[12px] border border-rule bg-sage-fill/30 px-2.5 py-1.5 text-[12px] leading-tight text-ink-muted";

/**
 * The files a message carries: images as thumbnails, everything else as a chip with its
 * name and size. A thumbnail or a text chip opens the file over the frosted window;
 * ESC, the close button or a click on the frost puts it back. Files still sending show
 * by name only.
 */
export function MessageFiles({ files, sending, align }: MessageFilesProps) {
  const { state: connection } = useConnection();
  const [open, setOpen] = useState<AttachmentSummary | null>(null);
  const connected = connection === "connected";

  useEffect(() => {
    if (open === null) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (files.length === 0 && sending.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${align === "end" ? "justify-end" : ""}`}>
      {files.map((file) => {
        const image = file.media_type.startsWith("image/");
        const viewable = connected && (image || isTextMediaType(file.media_type));
        if (image && connected) {
          return (
            <button
              key={file.id}
              type="button"
              aria-label={`Open ${file.filename}`}
              onClick={() => setOpen(file)}
              className="cursor-zoom-in overflow-hidden rounded-[12px] border border-rule"
            >
              <img
                src={hath.attachmentUrl(file.id)}
                alt={file.description ?? file.filename}
                className="h-24 max-w-[12rem] object-cover"
              />
            </button>
          );
        }
        return (
          <button
            key={file.id}
            type="button"
            disabled={!viewable}
            title={viewable ? `Open ${file.filename}` : file.filename}
            onClick={() => setOpen(file)}
            className={`${chipClass} ${viewable ? "cursor-pointer hover:text-ink" : "cursor-default"}`}
          >
            <span className="size-3.5 shrink-0 [&_svg]:size-full">
              <IconAttach />
            </span>
            <span className="truncate">{file.filename}</span>
            <span className="shrink-0 text-ink-ghost">
              {attachmentSizeLabel(file.media_type, file.size_bytes)}
            </span>
          </button>
        );
      })}
      {sending.map((att, index) => (
        <span key={`${att.filename ?? att.media_type}-${index}`} className={`${chipClass} opacity-60`}>
          <span className="size-3.5 shrink-0 [&_svg]:size-full">
            <IconAttach />
          </span>
          <span className="truncate">{att.filename ?? att.media_type}</span>
        </span>
      ))}

      {createPortal(
        <AnimatePresence>
          {open !== null ? (
            <motion.div
              key="file-modal"
              className="host-modal fixed inset-0 z-[200] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: SLOW_S, ease: EASE }}
              onClick={() => setOpen(null)}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(null)}
                className="host-modal__close fixed top-5 right-5 inline-flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors duration-fast ease-dadi hover:text-ink [&_svg]:size-4"
              >
                <IconDismiss />
              </button>
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={open.filename}
                className="host-modal__media max-h-[86vh] max-w-[min(92vw,1100px)] overflow-auto rounded-[16px]"
                initial={{ opacity: 0, scale: 0.94, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: SLOW_S, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
              >
                {open.media_type.startsWith("image/") ? (
                  <img
                    src={hath.attachmentUrl(open.id)}
                    alt={open.description ?? open.filename}
                    className="block max-h-[86vh] max-w-full object-contain"
                  />
                ) : (
                  <TextFile file={open} />
                )}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

/** A text attachment's contents: Markdown rendered, anything else as preformatted text; a failed load shows its error. */
function TextFile({ file }: { file: AttachmentSummary }) {
  const query = useQuery({
    queryKey: ["attachment-text", file.id],
    queryFn: () => hath.getAttachmentText(file.id),
    staleTime: Infinity,
  });
  const frame = "w-[min(92vw,820px)] bg-bone px-6 py-5 text-[14px] leading-[1.6] text-ink";

  if (query.isError) {
    return (
      <p className={`${frame} text-error`}>
        {query.error instanceof Error ? query.error.message : String(query.error)}
      </p>
    );
  }
  if (query.data === undefined) {
    return <p className={`${frame} text-ink-ghost`}>Loading {file.filename}…</p>;
  }
  if (file.media_type === "text/markdown") {
    return (
      <div className={frame}>
        <MarkdownBody content={query.data} />
      </div>
    );
  }
  return <pre className={`${frame} whitespace-pre-wrap break-words font-mono text-[13px]`}>{query.data}</pre>;
}

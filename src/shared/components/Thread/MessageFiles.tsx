import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { hath } from "../../api";
import { useConnection } from "../../hooks/useConnection";
import { useContextActions } from "../../interaction/contextMenu";
import { attachmentSizeLabel } from "../../lib/content/attachments";
import { RISE } from "../../motion";
import { Icon } from "../../ui/Icon";
import type { AttachmentSummary, MessageAttachment } from "../../../types/hath";
import { attachmentActions } from "./actions";
import { FileViewer } from "./FileViewer";

/** Props of {@link MessageFiles}. */
export type MessageFilesProps = {
  /** Files Hath stored with the message. */
  files: AttachmentSummary[];
  /** Files still on their way to Hath, shown by name until it confirms them. */
  sending: MessageAttachment[];
  /** Side of the thread the files sit on. */
  align: "start" | "end";
};

const chipClass = "inline-flex max-w-[15rem] items-center gap-1.5 rounded-[12px] border border-rule bg-sage-fill/30 px-2.5 py-1.5 text-[12px] leading-tight text-ink-muted";

/** One stored file: an image as a thumbnail, anything else as a chip with its name and size. A click opens it; right-click offers open, copy and save. */
function FileItem({ file, connected, onOpen }: { file: AttachmentSummary; connected: boolean; onOpen: () => void }) {
  const context = useContextActions(() => attachmentActions(file, onOpen));
  if (file.media_type.startsWith("image/") && connected) {
    return (
      <motion.button {...RISE} {...context} type="button" aria-label={`Open ${file.filename}`} onClick={onOpen} className="cursor-zoom-in overflow-hidden rounded-[12px] border border-rule">
        <img src={hath.attachmentUrl(file.id)} alt={file.description ?? file.filename} className="h-24 max-w-[12rem] object-cover" />
      </motion.button>
    );
  }
  return (
    <motion.button {...RISE} {...context} type="button" disabled={!connected} title={connected ? `Open ${file.filename}` : file.filename} onClick={onOpen} className={`${chipClass} ${connected ? "hover:text-ink" : ""}`}>
      <Icon name="clip" size={14} />
      <span data-selectable className="truncate">
        {file.filename}
      </span>
      <span className="shrink-0 text-ink-ghost">{attachmentSizeLabel(file.media_type, file.size_bytes)}</span>
    </motion.button>
  );
}

/**
 * The files a message carries: images as thumbnails, everything else as a chip with its
 * name and size. Any file opens in the FileViewer while the mesh is connected. Files
 * still sending show by name only.
 */
export function MessageFiles({ files, sending, align }: MessageFilesProps) {
  const { state: connection } = useConnection();
  const [open, setOpen] = useState<AttachmentSummary | null>(null);
  const connected = connection === "connected";

  if (files.length === 0 && sending.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${align === "end" ? "justify-end" : ""}`}>
      {files.map((file) => (
        <FileItem key={file.id} file={file} connected={connected} onOpen={() => setOpen(file)} />
      ))}
      <AnimatePresence initial={false}>
        {sending.map((att, index) => (
          <motion.span key={`${att.filename ?? att.media_type}-${index}`} {...RISE} className={`${chipClass} opacity-60`}>
            <Icon name="clip" size={14} />
            <span data-selectable className="truncate">
              {att.filename ?? att.media_type}
            </span>
          </motion.span>
        ))}
      </AnimatePresence>

      <FileViewer file={open} onClose={() => setOpen(null)} />
    </div>
  );
}

import { useState } from "react";
import { motion } from "motion/react";
import { hath } from "../../api";
import { useConnection } from "../../hooks/useConnection";
import { useContextActions } from "../../interaction/contextMenu";
import { attachmentSizeLabel } from "../../lib/content/attachments";
import { RISE } from "../../motion";
import { Icon } from "../../ui/Icon";
import type { AttachmentSummary } from "../../../types/hath";
import { attachmentActions } from "./actions";
import { FileModal } from "../Files/FileModal";

/** Props of {@link MessageFiles}. */
export type MessageFilesProps = {
  /** Files Hath stored with the message. */
  files: AttachmentSummary[];
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
 * name and size. Any file opens in the FileModal while the mesh is connected.
 */
export function MessageFiles({ files, align }: MessageFilesProps) {
  const { state: connection } = useConnection();
  const [open, setOpen] = useState<AttachmentSummary | null>(null);
  const connected = connection === "connected";

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${align === "end" ? "justify-end" : ""}`}>
      {files.map((file) => (
        <FileItem key={file.id} file={file} connected={connected} onOpen={() => setOpen(file)} />
      ))}
      <FileModal file={open} onClose={() => setOpen(null)} />
    </div>
  );
}

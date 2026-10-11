import { useState } from "react";
import { hath } from "../../../shared/api";
import { IconAttach } from "../../../shared/components/IconButton";
import { useConnection } from "../../../shared/hooks/useConnection";
import { attachmentSizeLabel } from "../../../shared/lib/content/attachments";
import type { AttachmentSummary, MessageAttachment } from "../../../types/hath";
import { FileViewer } from "./FileViewer";

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
      {files.map((file) => {
        if (file.media_type.startsWith("image/") && connected) {
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
            disabled={!connected}
            title={connected ? `Open ${file.filename}` : file.filename}
            onClick={() => setOpen(file)}
            className={`${chipClass} ${connected ? "cursor-pointer hover:text-ink" : "cursor-default"}`}
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

      <FileViewer file={open} onClose={() => setOpen(null)} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { hath } from "../../../shared/api";
import { CopyButton } from "../../../shared/components/CopyButton";
import { Glider } from "../../../shared/components/Glider";
import { IconCheck, IconDismiss, IconUpdate } from "../../../shared/components/IconButton";
import { MarkdownBody } from "../../../shared/components/Markdown";
import { attachmentSizeLabel, isTextMediaType } from "../../../shared/lib/content/attachments";
import { saveFile } from "../../../shared/lib/platform/download";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import type { AttachmentSummary } from "../../../types/hath";

/** Longest text the viewer colors; past it the file shows as plain text, since highlighting would stall the window. */
const HIGHLIGHT_MAX_CHARS = 400_000;

/** Grammars for extensions Shiki does not alias itself. */
const EXT_LANG: Record<string, string> = { h: "c", hpp: "cpp", env: "shellscript", txt: "text" };

/** Grammars for files whose extension names no grammar (or that have none), by media type. */
const MEDIA_LANG: Record<string, string> = {
  "application/json": "json",
  "application/xml": "xml",
  "application/yaml": "yaml",
  "application/x-yaml": "yaml",
  "application/toml": "toml",
  "application/javascript": "javascript",
  "application/x-sh": "shellscript",
  "text/javascript": "javascript",
  "text/markdown": "markdown",
  "text/html": "html",
  "text/css": "css",
  "text/csv": "csv",
};

/** How the sheet shows a file. */
type ViewKind = "image" | "pdf" | "markdown" | "text" | "binary";

/** Markdown files read rendered by default and can flip to their source. */
type MarkdownMode = "rendered" | "source";

const MARKDOWN_MODES: Array<{ value: MarkdownMode; label: string }> = [
  { value: "rendered", label: "Rendered" },
  { value: "source", label: "Source" },
];

/** Extensions read as Markdown whatever media type the file was stored with. */
const MARKDOWN_EXTS = new Set(["md", "markdown"]);

/** Which body the sheet renders for a file, by its media type and, for Markdown, its extension. */
function viewKind(mediaType: string, filename: string): ViewKind {
  if (mediaType.startsWith("image/")) {
    return "image";
  }
  if (mediaType === "application/pdf") {
    return "pdf";
  }
  if (mediaType === "text/markdown" || MARKDOWN_EXTS.has(extensionOf(filename))) {
    return "markdown";
  }
  return isTextMediaType(mediaType) ? "text" : "binary";
}

/** The file's extension (or its whole name when it has none, e.g. Dockerfile), lowercased. */
function extensionOf(filename: string): string {
  const lower = filename.toLowerCase();
  return lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : lower;
}

/**
 * Color `text` as HTML with Shiki, picking the grammar from the extension, then the media
 * type, else plain text. Shiki loads on first use, with only the grammar this file needs.
 */
async function highlight(text: string, filename: string, mediaType: string): Promise<string> {
  const { bundledLanguages, codeToHtml } = await import("shiki");
  const ext = extensionOf(filename);
  const lang =
    EXT_LANG[ext] ?? (ext in bundledLanguages ? ext : (MEDIA_LANG[mediaType] ?? "text"));
  return codeToHtml(text, {
    lang,
    themes: { light: "vitesse-light", dark: "vitesse-dark" },
    defaultColor: false,
  });
}

export type FileViewerProps = {
  /** The file to show, or null when the viewer is closed. */
  file: AttachmentSummary | null;
  onClose: () => void;
};

/**
 * A message's file over the frosted window: one sheet whose header names the file, its
 * kind and size, with copy (text), download and close; its body is the image, the PDF,
 * the code colored by its language with line numbers, rendered Markdown (or its source),
 * or, for other files, a card to download them. ESC or a click on the frost closes it.
 */
export function FileViewer({ file, onClose }: FileViewerProps) {
  useEffect(() => {
    if (file === null) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, onClose]);

  return createPortal(
    <AnimatePresence>
      {file !== null ? (
        <motion.div
          key="file-viewer"
          className="host-modal fixed inset-0 z-[200] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: SLOW_S, ease: EASE }}
          onClick={onClose}
        >
          <Sheet key={file.id} file={file} onClose={onClose} />
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

type SheetProps = {
  file: AttachmentSummary;
  onClose: () => void;
};

/** The open file's sheet: header with its actions over the body for its kind. */
function Sheet({ file, onClose }: SheetProps) {
  const kind = viewKind(file.media_type, file.filename);
  const textual = kind === "text" || kind === "markdown";
  const [mode, setMode] = useState<MarkdownMode>("rendered");
  const text = useQuery({
    queryKey: ["attachment-text", file.id],
    queryFn: () => hath.getAttachmentText(file.id),
    staleTime: Infinity,
    enabled: textual,
  });
  const colored = kind === "text" || (kind === "markdown" && mode === "source");
  const html = useQuery({
    queryKey: ["attachment-html", file.id],
    queryFn: () => {
      if (text.data === undefined) {
        throw new Error("file text not loaded");
      }
      return highlight(text.data, file.filename, file.media_type);
    },
    staleTime: Infinity,
    enabled: colored && text.data !== undefined && text.data.length <= HIGHLIGHT_MAX_CHARS,
  });
  const lines = text.data === undefined ? null : text.data.split("\n").length;
  const meta = [
    extensionOf(file.filename).toUpperCase(),
    lines === null ? null : `${lines.toLocaleString()} ${lines === 1 ? "line" : "lines"}`,
    attachmentSizeLabel(file.media_type, file.size_bytes),
  ].filter((part) => part !== null);
  const wide = kind !== "image";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={file.filename}
      className={`file-sheet flex max-h-[88vh] flex-col overflow-hidden rounded-[18px] ${
        wide ? "h-[min(88vh,820px)] w-[min(92vw,960px)]" : "max-w-[min(92vw,1200px)]"
      }`}
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-rule/70 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] leading-tight font-medium text-ink" title={file.filename}>
            {file.filename}
          </p>
          <p className="truncate text-[11px] leading-tight text-ink-ghost">{meta.join(" · ")}</p>
        </div>
        {kind === "markdown" ? (
          <Glider options={MARKDOWN_MODES} value={mode} onChange={setMode} label="Markdown view" size="sm" />
        ) : null}
        <div className="flex shrink-0 items-center gap-0.5">
          {textual && text.data !== undefined ? (
            <CopyButton text={text.data} label={`Copy ${file.filename}`} />
          ) : null}
          <DownloadButton file={file} text={text.data} />
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="inline-flex size-6 items-center justify-center rounded-[7px] text-ink-ghost transition-colors duration-fast ease-dadi hover:bg-sage-active/50 hover:text-ink-muted [&_svg]:size-3"
          >
            <IconDismiss />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        {kind === "image" ? (
          <div className="file-sheet__canvas flex items-center justify-center">
            <img
              src={hath.attachmentUrl(file.id)}
              alt={file.description ?? file.filename}
              className="block max-h-[calc(88vh-3rem)] max-w-full object-contain"
            />
          </div>
        ) : kind === "pdf" ? (
          <iframe title={file.filename} src={hath.attachmentUrl(file.id)} className="size-full border-0" />
        ) : kind === "binary" ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
            <p className="text-[14px] text-ink">No preview for {file.media_type}</p>
            <p className="text-[12px] text-ink-ghost">Download it to open it on this computer.</p>
          </div>
        ) : text.isError ? (
          <p className="px-5 py-4 text-[13px] text-error">{text.error.message}</p>
        ) : text.data === undefined ? (
          <div aria-label={`Loading ${file.filename}`} className="flex flex-col gap-2.5 px-5 py-5">
            {[72, 54, 88, 40, 66].map((width) => (
              <span key={width} className="h-2.5 animate-pulse rounded-full bg-rule/60" style={{ width: `${width}%` }} />
            ))}
          </div>
        ) : kind === "markdown" && mode === "rendered" ? (
          <div className="mx-auto max-w-[760px] px-7 py-6 text-[14px] leading-[1.65] text-ink">
            <MarkdownBody content={text.data} />
          </div>
        ) : html.isError ? (
          <p className="px-5 py-4 text-[13px] text-error">Could not color this file: {html.error.message}</p>
        ) : html.data !== undefined ? (
          <div className="code-view font-mono" dangerouslySetInnerHTML={{ __html: html.data }} />
        ) : (
          <pre className="code-view__plain font-mono">{text.data}</pre>
        )}
      </div>
    </motion.div>
  );
}

type DownloadButtonProps = {
  file: AttachmentSummary;
  /** The text already loaded for a text file, saved as is instead of fetched again. */
  text: string | undefined;
};

/** Saves the file (see saveFile); the icon turns into a check on success, and a failure shows its error beside it. */
function DownloadButton({ file, text }: DownloadButtonProps) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "saved") {
      return;
    }
    const timer = window.setTimeout(() => setState("idle"), 1_400);
    return () => window.clearTimeout(timer);
  }, [state]);

  const save = async () => {
    setError(null);
    setState("saving");
    try {
      const blob =
        text !== undefined
          ? new Blob([text], { type: file.media_type })
          : await hath.getAttachmentBlob(file.id);
      await saveFile(file.filename, blob);
      setState("saved");
    } catch (err: unknown) {
      setState("idle");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      {error ? (
        <span role="alert" className="max-w-[16rem] truncate text-[11px] text-error" title={error}>
          Download failed: {error}
        </span>
      ) : null}
      <button
        type="button"
        aria-label={`Download ${file.filename}`}
        title={state === "saved" ? "Saved" : "Download"}
        disabled={state === "saving"}
        onClick={() => void save()}
        className={`inline-flex size-6 items-center justify-center rounded-[7px] transition-colors duration-fast ease-dadi hover:bg-sage-active/50 [&_svg]:size-[14px] ${
          state === "saved" ? "text-sage-deep" : error ? "text-error" : "text-ink-ghost hover:text-ink-muted"
        } ${state === "saving" ? "animate-breath" : ""}`}
      >
        {state === "saved" ? <IconCheck /> : <IconUpdate />}
      </button>
    </span>
  );
}

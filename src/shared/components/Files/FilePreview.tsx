import { useEffect, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { hath, nas } from "../../api";
import { CopyButton } from "../../ui/CopyButton";
import { Segmented } from "../../ui/Segmented";
import { IconButton } from "../../ui/Button";
import { MarkdownBody } from "../Markdown";
import { attachmentSizeLabel, isTextMediaType } from "../../lib/content/attachments";
import { saveFile } from "../../desktop/download";
import type { AttachmentSummary } from "../../../types/hath";
import type { NasFileEntry } from "../../../types/nas";

/** The color themes the viewer highlights with, in light and dark. */
const THEMES = { light: "github-light", dark: "github-dark" } as const;

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

/** How the viewer shows a file. */
type ViewKind = "image" | "pdf" | "markdown" | "text" | "binary";

/** Markdown files read rendered by default and can flip to their source. */
type MarkdownMode = "rendered" | "source";

const MARKDOWN_MODES: Array<{ value: MarkdownMode; label: string }> = [
  { value: "rendered", label: "Rendered" },
  { value: "source", label: "Source" },
];

/** Extensions read as Markdown whatever media type the file was stored with. */
const MARKDOWN_EXTS = new Set(["md", "markdown"]);

/** A file the viewer can show, wherever it is stored: a message attachment on Hath or a path on the box. */
export type FileSource = {
  /** Names the file's cached reads; it changes when the bytes do. */
  key: string;
  name: string;
  mediaType: string;
  size: number;
  /** What an image or PDF is loaded from; called only when the file is drawn. */
  url: () => string;
  /** Image description to use as alt text, when there is one. */
  description?: string | null;
  /** The file as text. */
  loadText: () => Promise<string>;
  /** The file's bytes, for saving it. */
  loadBlob: () => Promise<Blob>;
};

/** A message attachment as a {@link FileSource}. */
export function attachmentSource(file: AttachmentSummary): FileSource {
  return {
    key: `attachment:${file.id}`,
    name: file.filename,
    mediaType: file.media_type,
    size: file.size_bytes,
    url: () => hath.attachmentUrl(file.id),
    description: file.description,
    loadText: () => hath.getAttachmentText(file.id),
    loadBlob: () => hath.getAttachmentBlob(file.id),
  };
}

/** A file on the box as a {@link FileSource}; the key carries its modified time, so a file replaced in place is read again. */
export function boxSource(entry: NasFileEntry): FileSource {
  return {
    key: `box:${entry.path}:${entry.modified}`,
    name: entry.name,
    mediaType: entry.media_type,
    size: entry.size,
    url: () => nas.fileUrl(entry.path),
    loadText: () => nas.getFileText(entry.path),
    loadBlob: () => nas.getFileBlob(entry.path),
  };
}

/** Which body the viewer renders for a file, by its media type and, for Markdown, its extension. */
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
    themes: THEMES,
    defaultColor: false,
  });
}

/** What {@link useFileView} reads of a file: its kind, its text and colored text when it has any, and the Markdown view chosen. */
export type FileView = {
  source: FileSource;
  kind: ViewKind;
  /** Whether the file is read as text (code or Markdown). */
  textual: boolean;
  mode: MarkdownMode;
  setMode: (mode: MarkdownMode) => void;
  text: UseQueryResult<string>;
  html: UseQueryResult<string>;
  /** The head's second line: extension, line count and size. */
  meta: string;
};

/** Read `source` for the viewer: its text (when it is text) and the Shiki-colored text of code and Markdown source. */
export function useFileView(source: FileSource): FileView {
  const kind = viewKind(source.mediaType, source.name);
  const textual = kind === "text" || kind === "markdown";
  const [mode, setMode] = useState<MarkdownMode>("rendered");
  const text = useQuery({
    queryKey: ["file-text", source.key],
    queryFn: source.loadText,
    staleTime: Infinity,
    enabled: textual,
  });
  const colored = kind === "text" || (kind === "markdown" && mode === "source");
  const html = useQuery({
    queryKey: ["file-html", THEMES.light, source.key],
    queryFn: () => {
      if (text.data === undefined) {
        throw new Error("file text not loaded");
      }
      return highlight(text.data, source.name, source.mediaType);
    },
    staleTime: Infinity,
    enabled: colored && text.data !== undefined && text.data.length <= HIGHLIGHT_MAX_CHARS,
  });
  const lines = text.data === undefined ? null : text.data.split("\n").length;
  const meta = [
    extensionOf(source.name).toUpperCase(),
    lines === null ? null : `${lines.toLocaleString()} ${lines === 1 ? "line" : "lines"}`,
    attachmentSizeLabel(source.mediaType, source.size),
  ].filter((part) => part !== null);
  return { source, kind, textual, mode, setMode, text, html, meta: meta.join(" · ") };
}

/** The viewer's controls: the Markdown rendered/source switch, copy for text and download. */
export function FileViewActions({ view }: { view: FileView }) {
  const { source, kind, mode, setMode, text } = view;
  return (
    <>
      {kind === "markdown" ? <Segmented options={MARKDOWN_MODES} value={mode} onChange={setMode} label="Markdown view" size="sm" /> : null}
      <div className="flex shrink-0 items-center gap-1">
        {view.textual && text.data !== undefined ? <CopyButton text={text.data} label={`Copy ${source.name}`} size={36} /> : null}
        <DownloadButton source={source} text={text.data} />
      </div>
    </>
  );
}

/** The viewer's body for the file's kind: the image, the PDF, the code colored by its language with line numbers, rendered Markdown (or its source), or a card for any other file. */
export function FileViewBody({ view }: { view: FileView }) {
  const { source, kind, mode, text, html } = view;
  return (
    <div className="scroll min-h-0 flex-1 overflow-auto">
      {kind === "image" ? (
        <div className="file-sheet__canvas flex items-center justify-center">
          <img src={source.url()} alt={source.description ?? source.name} className="block max-h-[calc(88vh-3rem)] max-w-full object-contain" />
        </div>
      ) : kind === "pdf" ? (
        <iframe title={source.name} src={source.url()} className="size-full border-0" />
      ) : kind === "binary" ? (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
          <p className="text-[14px] text-ink">No preview for {source.mediaType}</p>
          <p className="text-[12px] text-ink-ghost">Download it to open it on this computer.</p>
        </div>
      ) : text.isError ? (
        <p data-selectable className="px-6 py-5 text-[13px] text-error">{text.error.message}</p>
      ) : text.data === undefined ? (
        <div aria-label={`Loading ${source.name}`} className="flex flex-col gap-2.5 px-6 py-6">
          {[72, 54, 88, 40, 66].map((width) => (
            <span key={width} className="h-2.5 animate-pulse rounded-full bg-rule/60" style={{ width: `${width}%` }} />
          ))}
        </div>
      ) : kind === "markdown" && mode === "rendered" ? (
        <div data-selectable className="max-w-[780px] px-6 py-6 text-[15px] leading-[1.65] text-ink">
          <MarkdownBody content={text.data} />
        </div>
      ) : html.isError ? (
        <p data-selectable className="px-5 py-4 text-[13px] text-error">Could not color this file: {html.error.message}</p>
      ) : html.data !== undefined ? (
        <div data-selectable className={`code-view font-mono ${kind === "markdown" ? "code-view--wrap" : ""}`} dangerouslySetInnerHTML={{ __html: html.data }} />
      ) : (
        <pre data-selectable className="code-view__plain font-mono">{text.data}</pre>
      )}
    </div>
  );
}

type DownloadButtonProps = {
  source: FileSource;
  /** The text already loaded for a text file, saved as is instead of fetched again. */
  text: string | undefined;
};

/** Saves the file (see saveFile); the icon turns into a check on success, and a failure shows its error beside it. */
function DownloadButton({ source, text }: DownloadButtonProps) {
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
      const blob = text !== undefined ? new Blob([text], { type: source.mediaType }) : await source.loadBlob();
      await saveFile(source.name, blob);
      setState("saved");
    } catch (err: unknown) {
      setState("idle");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      {error ? (
        <span role="alert" data-selectable className="max-w-[16rem] truncate text-[11px] text-error" title={error}>
          Download failed: {error}
        </span>
      ) : null}
      <IconButton
        icon={state === "saved" ? "check" : "download"}
        label={state === "saved" ? "Saved" : `Download ${source.name}`}
        size={36}
        iconSize={15}
        disabled={state === "saving"}
        onClick={() => void save()}
        className={state === "saved" ? "text-sage-deep" : error ? "text-error" : ""}
      />
    </span>
  );
}

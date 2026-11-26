/** Max files per outbound message. */
export const MAX_ATTACHMENTS = 8;

/** Pasted text longer than this many characters (~1k tokens) becomes a staged file instead of draft text. */
export const PASTE_ATTACHMENT_CHARS = 4000;

/**
 * Media types by extension, trusted over the platform's guess (which types `.ts` as
 * video/mp2t and leaves most source files untyped). Text formats map to text types so
 * the chip sizes them in tokens; source code with no registered type is text/plain.
 */
const EXT_MEDIA: Record<string, string> = {
  ts: "text/plain",
  tsx: "text/plain",
  mts: "text/plain",
  cts: "text/plain",
  js: "text/javascript",
  jsx: "text/plain",
  mjs: "text/javascript",
  cjs: "text/javascript",
  py: "text/plain",
  go: "text/plain",
  rs: "text/plain",
  swift: "text/plain",
  kt: "text/plain",
  java: "text/plain",
  c: "text/plain",
  h: "text/plain",
  cpp: "text/plain",
  hpp: "text/plain",
  cs: "text/plain",
  rb: "text/plain",
  php: "text/plain",
  lua: "text/plain",
  sql: "text/plain",
  sh: "application/x-sh",
  bash: "application/x-sh",
  zsh: "application/x-sh",
  css: "text/css",
  scss: "text/plain",
  vue: "text/plain",
  svelte: "text/plain",
  graphql: "text/plain",
  proto: "text/plain",
  ini: "text/plain",
  env: "text/plain",
  diff: "text/plain",
  patch: "text/plain",
  tex: "text/plain",
  jsonc: "text/plain",
  jsonl: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  html: "text/html",
  json: "application/json",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  toml: "application/toml",
};

/** Non-`text/*` media types that read as text. */
const TEXT_MEDIA_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/javascript",
  "application/x-sh",
]);

/** Where a staged file is in its upload to the box's Inbox. */
export type DraftUpload =
  | { state: "staged" }
  | { state: "uploading" }
  /** On the box at `path`, the final one Nas chose (a taken name gets " (2)"). */
  | { state: "uploaded"; path: string }
  | { state: "failed"; message: string };

/** A file staged in the composer: it uploads to the box when the message is sent, and the message then links it. */
export type DraftAttachment = {
  /** Stable across re-renders and removals, so an upload's progress finds its chip. */
  id: number;
  file: File;
  media_type: string;
  /** Object URL for image preview chips; revoke on remove/send. */
  previewUrl?: string;
  /** File size, for the chip's size label. */
  sizeBytes: number;
  upload: DraftUpload;
};

/** True for media types Hath stores and agents read as text. */
export function isTextMediaType(mediaType: string): boolean {
  return mediaType.startsWith("text/") || TEXT_MEDIA_TYPES.has(mediaType);
}

/** A chip's size label: approximate tokens for text (four bytes each), KB or MB otherwise. */
export function attachmentSizeLabel(mediaType: string, bytes: number): string {
  if (isTextMediaType(mediaType)) {
    const tokens = Math.round(bytes / 4);
    return tokens < 1000 ? `~${tokens} tokens` : `~${(tokens / 1000).toFixed(1)}k tokens`;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A paste long enough to stage as a text file named for the time it was pasted; null when it stays draft text. */
export function pasteAsFile(text: string, now = new Date()): File | null {
  if (text.length <= PASTE_ATTACHMENT_CHARS) {
    return null;
  }
  const clock = [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, "0")).join("");
  return new File([text], `pasted-${clock}.txt`, { type: "text/plain" });
}

let nextDraftId = 1;

/** Stage files as draft attachments, with an image preview URL for images. */
export function filesToDraftAttachments(files: FileList | File[]): DraftAttachment[] {
  return Array.from(files).map((file) => {
    const media_type = resolveMediaType(file);
    return {
      id: nextDraftId++,
      file,
      media_type,
      sizeBytes: file.size,
      upload: { state: "staged" },
      previewUrl: media_type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    };
  });
}

/** Revoke object URLs created for image preview chips. */
export function revokeDraftPreviews(attachments: DraftAttachment[]): void {
  for (const att of attachments) {
    if (att.previewUrl) {
      URL.revokeObjectURL(att.previewUrl);
    }
  }
}

/** The line a staged chip shows under its name: its size, or where its upload is; `failed` marks an error to draw as one. */
export function draftStatusLine(att: DraftAttachment): { text: string; failed: boolean } {
  switch (att.upload.state) {
    case "uploading":
      return { text: "Uploading…", failed: false };
    case "failed":
      return { text: att.upload.message, failed: true };
    default:
      return { text: attachmentSizeLabel(att.media_type, att.sizeBytes), failed: false };
  }
}

/** A file's media type: its extension's when known, else the platform's, else opaque bytes. */
export function resolveMediaType(file: Pick<File, "name" | "type">): string {
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : undefined;
  if (ext && EXT_MEDIA[ext]) {
    return EXT_MEDIA[ext];
  }
  if (file.type) {
    return file.type;
  }
  return "application/octet-stream";
}

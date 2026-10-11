import type { MessageAttachment } from "../../../types/hath";

/** Match Dwar/Hath image.describe max. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Max files per outbound message. */
export const MAX_ATTACHMENTS = 8;

/** Pasted text longer than this many characters (~1k tokens) becomes an attachment instead of draft text. */
export const PASTE_ATTACHMENT_CHARS = 4000;

/**
 * Media types by extension, trusted over the platform's guess (which types `.ts` as
 * video/mp2t and leaves most source files untyped). Text formats map to text types so
 * Hath stores them as text agents can read, not as opaque bytes; source code with no
 * registered type is text/plain, as Hath's own create_attachment does.
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

/** Non-`text/*` media types Hath stores as text; mirrors Hath's list. */
const TEXT_MEDIA_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/javascript",
  "application/x-sh",
]);

export type DraftAttachment = MessageAttachment & {
  /** Object URL for image preview chips; revoke on remove/send. */
  previewUrl?: string;
  /** File size, for the chip's size label. */
  sizeBytes: number;
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

/** A paste long enough to send as an attachment, as a text file; null when it stays draft text. */
export function pasteAsFile(text: string): File | null {
  if (text.length <= PASTE_ATTACHMENT_CHARS) {
    return null;
  }
  return new File([text], "pasted-text.txt", { type: "text/plain" });
}

/** Read files into draft attachments (base64 + optional image preview URL). */
export async function filesToDraftAttachments(
  files: FileList | File[],
): Promise<DraftAttachment[]> {
  const list = Array.from(files);
  const out: DraftAttachment[] = [];
  for (const file of list) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} exceeds the ${MAX_ATTACHMENT_BYTES} byte limit`);
    }
    const media_type = resolveMediaType(file);
    const data = await readFileAsBase64(file);
    const draft: DraftAttachment = {
      media_type,
      data,
      filename: file.name || undefined,
      sizeBytes: file.size,
    };
    if (media_type.startsWith("image/")) {
      draft.previewUrl = URL.createObjectURL(file);
    }
    out.push(draft);
  }
  return out;
}

/** Revoke object URLs created for image preview chips. */
export function revokeDraftPreviews(attachments: DraftAttachment[]): void {
  for (const att of attachments) {
    if (att.previewUrl) {
      URL.revokeObjectURL(att.previewUrl);
    }
  }
}

/** Strip preview URLs for the wire MessageAttachment payload. */
export function toMessageAttachments(
  drafts: DraftAttachment[],
): MessageAttachment[] {
  return drafts.map(({ media_type, data, filename }) => {
    const out: MessageAttachment = { media_type, data };
    if (filename) {
      out.filename = filename;
    }
    return out;
  });
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

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`failed to read ${file.name}`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error(`failed to read ${file.name}`));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

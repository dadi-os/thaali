import type { NasFileEntry, NasUploaded } from "../../types/nas";
import { ApiError } from "../../shared/api/errors";
import { BOX_HOME, boxMarkdownLink, inboxFolder } from "../../shared/lib/content/boxLink";
import type { DraftAttachment, DraftUpload } from "../../shared/lib/content/attachments";

/** Puts `file` in `folder` on the box and answers where it landed: `nas.uploadFile`. */
export type UploadFile = (folder: string, file: File) => Promise<NasUploaded>;

/** Thrown after every staged file was tried when some failed; each failed chip already holds its own error. */
export class UploadFailed extends Error {
  constructor(readonly failed: number) {
    super(failed === 1 ? "1 file did not upload" : `${failed} files did not upload`);
  }
}

/**
 * Upload every staged file that is not on the box yet to this month's Inbox, one after another, and report each
 * file's state as it changes. A file already uploaded by an earlier attempt is not sent again. Every file is tried.
 * @param report called with a draft's id and its new upload state
 * @returns the final box paths, in the drafts' order
 * @throws {UploadFailed} when any upload failed
 */
export async function uploadDrafts(
  drafts: DraftAttachment[],
  now: Date,
  upload: UploadFile,
  report: (id: number, state: DraftUpload) => void,
): Promise<string[]> {
  const folder = inboxFolder(now);
  const paths: string[] = [];
  let failed = 0;
  for (const draft of drafts) {
    if (draft.upload.state === "uploaded") {
      paths.push(draft.upload.path);
      continue;
    }
    report(draft.id, { state: "uploading" });
    try {
      const { path } = await upload(folder, draft.file);
      report(draft.id, { state: "uploaded", path });
      paths.push(path);
    } catch (err) {
      report(draft.id, { state: "failed", message: err instanceof Error ? err.message : String(err) });
      failed += 1;
    }
  }
  if (failed > 0) {
    throw new UploadFailed(failed);
  }
  return paths;
}

/** A message's text: one link per uploaded file on its own line, then what was typed (just the links when nothing was). */
export function messageWithLinks(paths: string[], typed: string): string {
  const links = paths.map((path) => boxMarkdownLink(path, false));
  return [...links, typed.trim()].filter((line) => line !== "").join("\n");
}

/**
 * `draft` with a link to each picked entry on its own line, inserted at `caret` (the end when it is null), with a
 * line break kept between the links and the text around them.
 * @returns the new text and where the caret goes: after the inserted lines
 */
export function insertLinks(draft: string, caret: number | null, entries: NasFileEntry[]): { text: string; caret: number } {
  const at = caret ?? draft.length;
  const before = draft.slice(0, at);
  const after = draft.slice(at);
  const block = entries.map((entry) => boxMarkdownLink(entry.path, entry.kind === "folder")).join("\n");
  const lead = before === "" || before.endsWith("\n") ? "" : "\n";
  const tail = after === "" || after.startsWith("\n") ? "" : "\n";
  const inserted = `${lead}${block}${tail}`;
  return { text: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}

/**
 * Where the box picker opens: this month's Inbox when Nas has it, else the home.
 * @param stat Nas's `statFile`; a 404 means the month has no folder yet, any other failure propagates
 */
export async function pickerStart(now: Date, stat: (path: string) => Promise<unknown>): Promise<string> {
  const month = inboxFolder(now);
  try {
    await stat(month);
    return month;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return BOX_HOME;
    }
    throw err;
  }
}

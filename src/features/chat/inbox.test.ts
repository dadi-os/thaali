import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/errors";
import { BOX_HOME, boxMarkdownLink, inboxFolder } from "../../shared/lib/content/boxLink";
import type { DraftAttachment } from "../../shared/lib/content/attachments";
import type { NasFileEntry } from "../../types/nas";
import { insertLinks, messageWithLinks, pickerStart, uploadDrafts, UploadFailed } from "./inbox";

const INBOX = `${BOX_HOME}/Inbox/2026-11`;
const NOW = new Date(2026, 10, 26, 9, 30);

let nextId = 1;
const draft = (name: string, upload: DraftAttachment["upload"] = { state: "staged" }): DraftAttachment => ({
  id: nextId++,
  file: new File(["x"], name),
  media_type: "text/plain",
  sizeBytes: 1,
  upload,
});

const entry = (path: string, kind: NasFileEntry["kind"]): NasFileEntry => ({ name: path.split("/").pop()!, path, kind, size: 0, modified: "2026-11-20T12:00:00Z", media_type: "" });

describe("the Inbox month folder", () => {
  it("is the local month at send time, zero padded", () => {
    expect(inboxFolder(new Date(2026, 0, 2))).toBe(`${BOX_HOME}/Inbox/2026-01`);
    expect(inboxFolder(NOW)).toBe(INBOX);
  });
});

describe("uploadDrafts", () => {
  it("uploads each file under its original name to the month folder and answers the final paths", async () => {
    const upload = vi.fn(async (folder: string, file: File) => ({ path: `${folder}/${file.name}`, name: file.name, size: 1 }));
    const paths = await uploadDrafts([draft("hw3.pdf"), draft("notes.txt")], NOW, upload, vi.fn());
    expect(upload.mock.calls.map(([folder, file]) => [folder, file.name])).toEqual([
      [INBOX, "hw3.pdf"],
      [INBOX, "notes.txt"],
    ]);
    expect(paths).toEqual([`${INBOX}/hw3.pdf`, `${INBOX}/notes.txt`]);
  });

  it("builds the link from the path Nas returned when the name was taken", async () => {
    const upload = vi.fn(async (folder: string) => ({ path: `${folder}/hw3 (2).pdf`, name: "hw3 (2).pdf", size: 1 }));
    const paths = await uploadDrafts([draft("hw3.pdf")], NOW, upload, vi.fn());
    expect(messageWithLinks(paths, "")).toBe("[hw3 (2).pdf](box:///var/home/dadi/Inbox/2026-11/hw3%20%282%29.pdf)");
  });

  it("reports uploading then uploaded for each file", async () => {
    const report = vi.fn();
    const one = draft("a.txt");
    await uploadDrafts([one], NOW, async (folder) => ({ path: `${folder}/a.txt`, name: "a.txt", size: 1 }), report);
    expect(report.mock.calls).toEqual([
      [one.id, { state: "uploading" }],
      [one.id, { state: "uploaded", path: `${INBOX}/a.txt` }],
    ]);
  });

  it("tries every file, marks the failed one with its error and throws; a retry skips what already uploaded", async () => {
    const good = draft("good.txt");
    const bad = draft("bad.txt");
    const states = new Map<number, DraftAttachment["upload"]>();
    const report = (id: number, state: DraftAttachment["upload"]) => states.set(id, state);
    let unreachable = true;
    const upload = vi.fn(async (folder: string, file: File) => {
      if (file.name === "bad.txt" && unreachable) {
        throw new Error("Nas is unreachable");
      }
      return { path: `${folder}/${file.name}`, name: file.name, size: 1 };
    });

    await expect(uploadDrafts([good, bad], NOW, upload, report)).rejects.toBeInstanceOf(UploadFailed);
    expect(states.get(good.id)).toEqual({ state: "uploaded", path: `${INBOX}/good.txt` });
    expect(states.get(bad.id)).toEqual({ state: "failed", message: "Nas is unreachable" });

    unreachable = false;
    upload.mockClear();
    const retry = [
      { ...good, upload: states.get(good.id)! },
      { ...bad, upload: states.get(bad.id)! },
    ];
    const paths = await uploadDrafts(retry, NOW, upload, report);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0]![1].name).toBe("bad.txt");
    expect(paths).toEqual([`${INBOX}/good.txt`, `${INBOX}/bad.txt`]);
  });
});

describe("messageWithLinks", () => {
  const paths = [`${INBOX}/a.txt`, `${INBOX}/b (2).txt`];
  const links = `${boxMarkdownLink(paths[0]!, false)}\n${boxMarkdownLink(paths[1]!, false)}`;

  it("puts one link per line above what was typed", () => {
    expect(messageWithLinks(paths, "  please file these  ")).toBe(`${links}\nplease file these`);
  });

  it("is just the links when nothing was typed", () => {
    expect(messageWithLinks(paths, "  \n")).toBe(links);
  });
});

describe("insertLinks", () => {
  const file = entry(`${BOX_HOME}/msu/hw3.pdf`, "file");
  const folder = entry(`${BOX_HOME}/msu/cse-431`, "folder");
  const block = `${boxMarkdownLink(file.path, false)}\n${boxMarkdownLink(folder.path, true)}`;

  it("inserts each file and folder on its own line at the caret, keeping the text around it on its own lines", () => {
    const result = insertLinks("look at this please", 12, [file, folder]);
    expect(result.text).toBe(`look at this\n${block}\n please`);
    expect(result.caret).toBe(`look at this\n${block}\n`.length);
  });

  it("appends at the end when there is no caret, and adds no break to an empty draft or after a line break", () => {
    expect(insertLinks("", null, [file]).text).toBe(boxMarkdownLink(file.path, false));
    expect(insertLinks("see:\n", null, [file]).text).toBe(`see:\n${boxMarkdownLink(file.path, false)}`);
  });

  it("marks a folder with a trailing slash", () => {
    expect(insertLinks("", null, [folder]).text).toMatch(/\/\)$/);
  });
});

describe("pickerStart", () => {
  it("opens at this month's Inbox when it exists", async () => {
    const stat = vi.fn(async () => ({}));
    expect(await pickerStart(NOW, stat)).toBe(INBOX);
    expect(stat).toHaveBeenCalledWith(INBOX);
  });

  it("opens at the home when the month has no folder yet", async () => {
    const stat = vi.fn(async () => {
      throw new ApiError("HTTP 404", "http://nas.dadi", "id", 404);
    });
    expect(await pickerStart(NOW, stat)).toBe(BOX_HOME);
  });

  it("lets any other failure through", async () => {
    const stat = vi.fn(async () => {
      throw new ApiError("HTTP 502", "http://nas.dadi", "id", 502);
    });
    await expect(pickerStart(NOW, stat)).rejects.toThrow("HTTP 502");
  });
});

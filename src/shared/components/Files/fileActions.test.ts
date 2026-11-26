import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Action } from "../../interaction/actions";
import type { NasFileEntry } from "../../../types/nas";

const nas = vi.hoisted(() => ({
  moveFile: vi.fn(),
  makeFolder: vi.fn(),
  trashFile: vi.fn(),
  uploadFile: vi.fn(),
  getFileBlob: vi.fn(),
}));
const copyText = vi.hoisted(() => vi.fn(async () => undefined));
const saveFile = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../api", () => ({ nas }));
vi.mock("../../desktop/clipboard", () => ({ copyText }));
vi.mock("../../desktop/download", () => ({ saveFile }));

import { copyLinks, createFolder, fileActions, moveEntries, renameEntry, trashEntries, uploadFiles } from "./fileActions";

const HOME = "/var/home/dadi";
const file: NasFileEntry = { name: "hw 3 (final).pdf", path: `${HOME}/msu/hw 3 (final).pdf`, kind: "file", size: 10, modified: "2026-11-01T00:00:00Z", media_type: "application/pdf" };
const folder: NasFileEntry = { name: "work", path: `${HOME}/msu/work`, kind: "folder", size: 0, modified: "2026-11-01T00:00:00Z", media_type: "" };

/** The action with `id` from the list a surface offers. */
function find(id: string, entries: NasFileEntry[], deps: Parameters<typeof fileActions>[1]): Action {
  const action = fileActions(entries, deps).find((entry): entry is Action => entry !== "separator" && entry.id === id);
  if (action === undefined) {
    throw new Error(`no action ${id}`);
  }
  return action;
}

beforeEach(() => {
  for (const fn of Object.values(nas)) {
    fn.mockReset();
  }
  copyText.mockClear();
  saveFile.mockClear();
});

describe("the file actions", () => {
  it("copies the link as a markdown-free box:// URL, with a slash for a folder, and the path as it is", async () => {
    await find("file.copy-link", [file, folder], {}).run();
    expect(copyText).toHaveBeenLastCalledWith("box:///var/home/dadi/msu/hw%203%20%28final%29.pdf\nbox:///var/home/dadi/msu/work/");
    await find("file.copy-path", [file], {}).run();
    expect(copyText).toHaveBeenLastCalledWith(file.path);
  });

  it("saves a file's bytes from Nas to this Mac under its name, and a failed read rejects instead of saving", async () => {
    const blob = new Blob(["x"]);
    nas.getFileBlob.mockResolvedValueOnce(blob);
    await find("file.save", [file], {}).run();
    expect(nas.getFileBlob).toHaveBeenCalledWith(file.path);
    expect(saveFile).toHaveBeenCalledWith(file.name, blob);
    nas.getFileBlob.mockRejectedValueOnce(new Error("HTTP 404: not_found"));
    await expect(find("file.save", [file], {}).run()).rejects.toThrow("not_found");
    expect(saveFile).toHaveBeenCalledTimes(1);
  });

  it("offers only what the surface can carry out: a link in a message has no rename, move or trash", () => {
    const ids = fileActions([file], { onOpen: () => undefined }).flatMap((entry) => (entry === "separator" ? [] : [entry.id]));
    expect(ids).toEqual(["file.open", "file.copy-link", "file.copy-path", "file.save"]);
  });

  it("hands rename, move, new folder and trash to the surface, which confirms before it calls Nas", () => {
    const deps = { onOpen: vi.fn(), onRename: vi.fn(), onMove: vi.fn(), onNewFolder: vi.fn(), onTrash: vi.fn() };
    for (const id of ["file.open", "file.rename", "file.move", "file.new-folder", "file.trash"]) {
      void find(id, [file], deps).run();
    }
    expect(deps.onOpen).toHaveBeenCalledWith(file);
    expect(deps.onRename).toHaveBeenCalledWith(file);
    expect(deps.onMove).toHaveBeenCalledWith([file]);
    expect(deps.onNewFolder).toHaveBeenCalled();
    expect(deps.onTrash).toHaveBeenCalledWith([file]);
    expect(nas.trashFile).not.toHaveBeenCalled();
    expect(find("file.trash", [file], deps).destructive).toBe(true);
  });

  it("disables what needs a single item when several are selected, and saving a folder", () => {
    const deps = { onOpen: () => undefined, onRename: () => undefined };
    expect(find("file.rename", [file, folder], deps).disabledReason).toBeDefined();
    expect(find("file.open", [file, folder], deps).disabledReason).toBeDefined();
    expect(find("file.save", [folder], deps).disabledReason).toBeDefined();
    expect(find("file.copy-link", [file, folder], deps).disabledReason).toBeUndefined();
  });

  it("offers just New folder on the empty space of a folder", () => {
    const ids = fileActions([], { onNewFolder: () => undefined, onTrash: () => undefined }).flatMap((entry) => (entry === "separator" ? [] : [entry.id]));
    expect(ids).toEqual(["file.new-folder"]);
  });
});

describe("the writes the actions lead to", () => {
  it("renames in the same folder through a move, and refuses a name with a slash before asking Nas", async () => {
    nas.moveFile.mockResolvedValueOnce({ path: `${HOME}/msu/renamed.pdf` });
    await expect(renameEntry(file, " renamed.pdf ")).resolves.toBe(`${HOME}/msu/renamed.pdf`);
    expect(nas.moveFile).toHaveBeenCalledWith(file.path, `${HOME}/msu/renamed.pdf`);
    await expect(renameEntry(file, "a/b")).rejects.toThrow(/slash/);
    await expect(renameEntry(file, "  ")).rejects.toThrow(/slash/);
    expect(nas.moveFile).toHaveBeenCalledTimes(1);
  });

  it("surfaces a name that is taken as the conflict Nas answered with", async () => {
    nas.moveFile.mockRejectedValueOnce(new Error('HTTP 409: {"error":{"type":"conflict"}}'));
    await expect(renameEntry(file, "taken.pdf")).rejects.toThrow("conflict");
  });

  it("moves each entry into the folder under its own name and stops at the first refusal", async () => {
    nas.moveFile.mockResolvedValueOnce({ path: "a" }).mockRejectedValueOnce(new Error("HTTP 409"));
    await expect(moveEntries([file, folder, { ...file, name: "never.md" }], `${HOME}/career`)).rejects.toThrow("409");
    expect(nas.moveFile.mock.calls).toEqual([
      [file.path, `${HOME}/career/${file.name}`],
      [folder.path, `${HOME}/career/work`],
    ]);
  });

  it("makes a folder inside the open one", async () => {
    nas.makeFolder.mockResolvedValueOnce({ path: `${HOME}/msu/new` });
    await createFolder(`${HOME}/msu`, "new");
    expect(nas.makeFolder).toHaveBeenCalledWith(`${HOME}/msu/new`);
  });

  it("moves each entry to the trash and rejects with what Nas said when one fails", async () => {
    nas.trashFile.mockResolvedValueOnce({ path: "t" }).mockRejectedValueOnce(new Error("HTTP 403: forbidden"));
    await expect(trashEntries([file, folder])).rejects.toThrow("forbidden");
    expect(nas.trashFile.mock.calls).toEqual([[file.path], [folder.path]]);
  });

  it("reports an upload whose name was taken from the path Nas answered with", async () => {
    const a = new File(["a"], "hw3.zip");
    const b = new File(["b"], "notes.md");
    nas.uploadFile.mockResolvedValueOnce({ path: `${HOME}/Inbox/hw3 (2).zip`, name: "hw3 (2).zip", size: 1 }).mockResolvedValueOnce({ path: `${HOME}/Inbox/notes.md`, name: "notes.md", size: 1 });
    const renamed = await uploadFiles(`${HOME}/Inbox`, [a, b]);
    expect(nas.uploadFile.mock.calls.map(([target, sent]) => [target, sent.name])).toEqual([
      [`${HOME}/Inbox`, "hw3.zip"],
      [`${HOME}/Inbox`, "notes.md"],
    ]);
    expect(renamed).toHaveLength(1);
    expect(renamed[0]).toContain("hw3 (2).zip");
  });

  it("copies links through the same function the shortcut uses", async () => {
    await copyLinks([folder]);
    expect(copyText).toHaveBeenCalledWith("box:///var/home/dadi/msu/work/");
  });
});

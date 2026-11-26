import { nas } from "../../api";
import { copyText } from "../../desktop/clipboard";
import { saveFile } from "../../desktop/download";
import type { ActionList } from "../../interaction/actions";
import { boxHref, childPath, parentPath } from "../../lib/content/boxLink";
import type { NasFileEntry } from "../../../types/nas";

/** What the actions on files need from the surface that shows them; an action whose handler is absent is not offered. */
export type FileActionDeps = {
  /** Open the entry: a folder lists, a file previews. */
  onOpen?: (entry: NasFileEntry) => void;
  /** Start renaming the entry in place. */
  onRename?: (entry: NasFileEntry) => void;
  /** Ask where the entries should move to. */
  onMove?: (entries: NasFileEntry[]) => void;
  /** Start a new folder in the open folder. */
  onNewFolder?: () => void;
  /** Ask before the entries go to the trash. */
  onTrash?: (entries: NasFileEntry[]) => void;
};

/** The `box://` link to an entry: a folder's ends in a slash. */
export function linkOf(entry: NasFileEntry): string {
  return boxHref(entry.path, entry.kind === "folder");
}

/** Put the entries' links on the clipboard as plain text, one a line. */
export function copyLinks(entries: readonly NasFileEntry[]): Promise<void> {
  return copyText(entries.map(linkOf).join("\n"));
}

/** Put the entries' absolute paths on the clipboard, one a line. */
export function copyPaths(entries: readonly NasFileEntry[]): Promise<void> {
  return copyText(entries.map((entry) => entry.path).join("\n"));
}

/** Download a file from the box and save it on this computer. */
export async function saveEntry(entry: NasFileEntry): Promise<void> {
  await saveFile(entry.name, await nas.getFileBlob(entry.path));
}

/**
 * Rename an entry in its folder.
 * @returns the new path
 * @throws When the name is empty or holds a slash, or Nas refuses (a 409 when the name is taken).
 */
export async function renameEntry(entry: NasFileEntry, name: string): Promise<string> {
  const next = name.trim();
  if (next === "" || next.includes("/")) {
    throw new Error("A name cannot be empty or contain a slash.");
  }
  return (await nas.moveFile(entry.path, childPath(parentPath(entry.path), next))).path;
}

/** Move each entry into `folder` under its own name, stopping at the first refusal; the ones before it have moved. */
export async function moveEntries(entries: readonly NasFileEntry[], folder: string): Promise<void> {
  for (const entry of entries) {
    await nas.moveFile(entry.path, childPath(folder, entry.name));
  }
}

/**
 * Make a folder named `name` inside `folder`.
 * @returns the new folder's path
 */
export async function createFolder(folder: string, name: string): Promise<string> {
  const next = name.trim();
  if (next === "" || next.includes("/")) {
    throw new Error("A name cannot be empty or contain a slash.");
  }
  return (await nas.makeFolder(childPath(folder, next))).path;
}

/**
 * Upload `files` into `folder`, one after another, stopping at the first failure (the ones before it are there).
 * @returns a line for each file that landed under another name because its own was taken, read from the path Nas answered with
 */
export async function uploadFiles(folder: string, files: readonly File[]): Promise<string[]> {
  const renamed: string[] = [];
  for (const file of files) {
    const landed = await nas.uploadFile(folder, file);
    if (landed.name !== file.name) {
      renamed.push(`${file.name} was taken, so it was saved as ${landed.name}.`);
    }
  }
  return renamed;
}

/** Move each entry to the trash, stopping at the first refusal; the ones before it are gone. */
export async function trashEntries(entries: readonly NasFileEntry[]): Promise<void> {
  for (const entry of entries) {
    await nas.trashFile(entry.path);
  }
}

/**
 * The actions on one or several entries, declared once for the right-click menu, the click menu and the shortcuts:
 * open, copy the link or the path, save to this Mac, rename, move, a new folder and the trash. Moving, renaming and
 * trashing hand off to the surface (an inline field, a picker, a confirmation), which then calls the matching
 * function above; the ones that need only Nas run here and a failure reaches the person as a toast.
 */
export function fileActions(entries: readonly NasFileEntry[], deps: FileActionDeps): ActionList {
  if (entries.length === 0) {
    return deps.onNewFolder === undefined ? [] : [{ id: "file.new-folder", label: "New folder", icon: "plus", run: () => deps.onNewFolder!() }];
  }
  const one = entries.length === 1 ? entries[0]! : null;
  const many = entries.length > 1 ? "Select a single item" : undefined;
  const saveable = one !== null && one.kind === "file" ? undefined : "Select a single file";
  const list: ActionList = [
    ...(deps.onOpen === undefined ? [] : [{ id: "file.open", label: "Open", icon: "chevron" as const, disabledReason: many, run: () => deps.onOpen!(one!) }]),
    { id: "file.copy-link", label: entries.length > 1 ? "Copy links" : "Copy link", icon: "link" as const, shortcut: "mod+c", run: () => copyLinks(entries) },
    { id: "file.copy-path", label: entries.length > 1 ? "Copy paths" : "Copy path", icon: "copy" as const, run: () => copyPaths(entries) },
    { id: "file.save", label: "Save to this Mac", icon: "download" as const, disabledReason: saveable, run: () => saveEntry(one!) },
    ...(deps.onRename === undefined && deps.onMove === undefined && deps.onNewFolder === undefined ? [] : (["separator"] as const)),
    ...(deps.onRename === undefined ? [] : [{ id: "file.rename", label: "Rename", icon: "pencil" as const, disabledReason: many, run: () => deps.onRename!(one!) }]),
    ...(deps.onMove === undefined ? [] : [{ id: "file.move", label: "Move to…", icon: "folder" as const, run: () => deps.onMove!([...entries]) }]),
    ...(deps.onNewFolder === undefined ? [] : [{ id: "file.new-folder", label: "New folder", icon: "plus" as const, run: () => deps.onNewFolder!() }]),
    ...(deps.onTrash === undefined ? [] : (["separator"] as const)),
    ...(deps.onTrash === undefined ? [] : [{ id: "file.trash", label: "Move to trash", icon: "trash" as const, destructive: true, run: () => deps.onTrash!([...entries]) }]),
  ];
  return list;
}

/**
 * Nested folders. The vault stores folders flat; a slash in a name nests it, so
 * `development/fliks-gg` sits under `development` (which may or may not be a folder of its own).
 */

import type { ChaaviFolder, ChaaviItem } from "../../types/chaavi";

/** Separates a folder's parent path from its own name. */
export const FOLDER_SEP = "/";

/** One row of the folder tree. */
export type FolderNode = {
  /** Full path, e.g. `development/fliks-gg`. */
  path: string;
  /** The last path segment. */
  name: string;
  /** The vault folder at this path, or null when only deeper folders exist under it. */
  id: string | null;
  /** Items in this folder and every folder under it. */
  count: number;
  /** Items filed in this folder itself. */
  own: number;
  children: FolderNode[];
};

/** True when `path` is `scope` or sits anywhere under it. */
export function isWithin(path: string, scope: string): boolean {
  return path === scope || path.startsWith(scope + FOLDER_SEP);
}

/** The path above `path`; null for a top-level folder. */
export function parentPath(path: string): string | null {
  const cut = path.lastIndexOf(FOLDER_SEP);
  return cut === -1 ? null : path.slice(0, cut);
}

/** `parent` plus a child name; the child name alone at the root. */
export function joinPath(parent: string | null, name: string): string {
  return parent === null ? name : parent + FOLDER_SEP + name;
}

/** The folder tree, siblings in name order. Counts roll up through each node's subtree. */
export function buildFolderTree(folders: ChaaviFolder[], items: ChaaviItem[]): FolderNode[] {
  const nodes = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  const nodeAt = (path: string): FolderNode => {
    const existing = nodes.get(path);
    if (existing !== undefined) {
      return existing;
    }
    const cut = path.lastIndexOf(FOLDER_SEP);
    const node: FolderNode = { path, name: path.slice(cut + 1), id: null, count: 0, own: 0, children: [] };
    nodes.set(path, node);
    (cut === -1 ? roots : nodeAt(path.slice(0, cut)).children).push(node);
    return node;
  };

  const pathOf = new Map<string, string>();
  for (const folder of folders) {
    nodeAt(folder.name).id = folder.id;
    pathOf.set(folder.id, folder.name);
  }
  for (const item of items) {
    const path = item.folderId === null ? undefined : pathOf.get(item.folderId);
    if (path !== undefined) {
      const segments = path.split(FOLDER_SEP);
      for (let depth = 1; depth <= segments.length; depth++) {
        nodes.get(segments.slice(0, depth).join(FOLDER_SEP))!.count += 1;
      }
      nodes.get(path)!.own += 1;
    }
  }

  const byName = (a: FolderNode, b: FolderNode) => a.name.localeCompare(b.name);
  for (const node of nodes.values()) {
    node.children.sort(byName);
  }
  return roots.sort(byName);
}

/**
 * The renames that move the folder tree at `from` to `to`: the folder at `from` and every
 * folder under it, each with its new full name.
 */
export function subtreeRenames(folders: ChaaviFolder[], from: string, to: string): { id: string; name: string }[] {
  return folders
    .filter((folder) => isWithin(folder.name, from))
    .map((folder) => ({ id: folder.id, name: to + folder.name.slice(from.length) }));
}

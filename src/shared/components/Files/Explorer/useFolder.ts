import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../api/errors";
import { isMeshOnline, nas } from "../../../api";
import { useConnection } from "../../../hooks/useConnection";
import { useModuleState } from "../../../hooks/useModuleState";
import { BOX_HOME, baseName, parentPath } from "../../../lib/content/boxLink";
import type { NasFileEntry, NasFileList } from "../../../../types/nas";

/** The React Query key of a folder's listing; every file query sits under `["nas", "files"]`. */
export function listKey(path: string): readonly string[] {
  return ["nas", "files", "list", path];
}

/** The React Query key of one path's stat. */
export function statKey(path: string): readonly string[] {
  return ["nas", "files", "stat", path];
}

/** A folder's listing as its module state: loading, offline, module-offline, error, empty, or the entries (stale when a refetch failed). */
export function useFolder(path: string) {
  const { state: connection } = useConnection();
  const query = useQuery({ queryKey: listKey(path), queryFn: () => nas.listFiles(path), enabled: isMeshOnline(connection) });
  return { query, state: useModuleState<NasFileList>(query, (list) => list.entries.length === 0) };
}

/** Refetch every folder listing and stat the app holds, after a write the explorer made (Nas has no change feed). */
export function useRefreshFiles(): () => Promise<void> {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["nas", "files"] });
}

/** Where the explorer opens for a box path. */
export type BoxTarget = {
  /** The folder to list. */
  folder: string;
  /** The file the path named, selected in that folder; null when the path is a folder or is gone. */
  selected: NasFileEntry | null;
  /** The name of the file or folder that was removed, when the path no longer exists and its nearest parent opened instead. */
  removed: string | null;
};

/** Whether the request failed because the path does not exist. */
function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/**
 * Where to open for `path`: its folder, with it selected when it is a file. A path that is gone opens its nearest
 * existing parent and names what was removed.
 * @throws Any failure other than a 404, such as the mesh or Nas being down.
 */
export async function resolveBoxPath(path: string): Promise<BoxTarget> {
  try {
    const entry = await nas.statFile(path);
    return entry.kind === "folder" ? { folder: path, selected: null, removed: null } : { folder: parentPath(path), selected: entry, removed: null };
  } catch (err) {
    if (!isNotFound(err) || path === BOX_HOME) {
      throw err;
    }
    const parent = await resolveBoxPath(parentPath(path));
    return { folder: parent.folder, selected: null, removed: baseName(path) };
  }
}

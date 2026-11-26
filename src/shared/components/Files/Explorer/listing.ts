import { isTextMediaType } from "../../../lib/content/attachments";
import type { IconName } from "../../../ui/Icon";
import type { NasFileEntry } from "../../../../types/nas";

/** The columns the list sorts by. */
export type SortKey = "name" | "modified" | "size";

/** How the list is ordered: by one column, ascending or descending. */
export type Sort = {
  key: SortKey;
  descending: boolean;
};

/** Order with names first, as the box lists a folder. */
export const DEFAULT_SORT: Sort = { key: "name", descending: false };

/** Whether a row opens (a folder or a link) rather than previews. */
export function isFolder(entry: NasFileEntry): boolean {
  return entry.kind === "folder";
}

/**
 * The rows to draw: entries whose name contains `filter` (ignoring case), folders first, then by `sort`. Folders have
 * no size, so a size sort orders them by name.
 */
export function arrange(entries: readonly NasFileEntry[], sort: Sort, filter: string): NasFileEntry[] {
  const needle = filter.trim().toLowerCase();
  const sign = sort.descending ? -1 : 1;
  const byName = (a: NasFileEntry, b: NasFileEntry) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  const compare = (a: NasFileEntry, b: NasFileEntry): number => {
    if (isFolder(a) !== isFolder(b)) {
      return isFolder(a) ? -1 : 1;
    }
    if (sort.key === "modified") {
      return sign * (Date.parse(a.modified) - Date.parse(b.modified)) || byName(a, b);
    }
    if (sort.key === "size" && !isFolder(a)) {
      return sign * (a.size - b.size) || byName(a, b);
    }
    return sort.key === "name" ? sign * byName(a, b) : byName(a, b);
  };
  return entries.filter((entry) => needle === "" || entry.name.toLowerCase().includes(needle)).sort(compare);
}

/** The sort after a press on a column's header: a new column starts ascending, the same column flips. */
export function nextSort(sort: Sort, key: SortKey): Sort {
  return sort.key === key ? { key, descending: !sort.descending } : { key, descending: false };
}

/** The icon a row draws: a folder, an image, text (and code), or the plain file for anything else. */
export function iconFor(entry: Pick<NasFileEntry, "kind" | "media_type">): IconName {
  if (entry.kind === "folder") {
    return "folder";
  }
  if (entry.media_type.startsWith("image/")) {
    return "image";
  }
  return isTextMediaType(entry.media_type) ? "note" : "doc";
}

/** A file's size as the list shows it: bytes, KB or MB; a dash for a folder. */
export function sizeLabel(entry: NasFileEntry): string {
  if (isFolder(entry)) {
    return "—";
  }
  if (entry.size < 1024) {
    return `${entry.size} B`;
  }
  if (entry.size < 1024 * 1024) {
    return `${Math.round(entry.size / 1024)} KB`;
  }
  return `${(entry.size / (1024 * 1024)).toFixed(1)} MB`;
}

/** The day an entry changed, with the year only when it is not this one ("Nov 18", "Sep 2, 2025"). */
export function modifiedLabel(entry: NasFileEntry, now = new Date()): string {
  const date = new Date(entry.modified);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" }).format(date);
}

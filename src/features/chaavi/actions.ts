import { copyText } from "../../shared/desktop/clipboard";
import type { ActionList } from "../../shared/interaction/actions";
import type { ChaaviItem } from "../../types/chaavi";
import { websiteUrl } from "./draft";

/** What the actions on a vault item need from the page that holds the item. */
export type ItemActionDeps = {
  /** Show the item in the detail pane. */
  open: () => void;
  /** Open the item's edit sheet. */
  edit: () => void;
  /** Star or unstar the item. */
  toggleFavorite: () => void;
  /** Ask whether to delete the item. */
  remove: () => void;
};

/** What the actions on a folder need from the pane that draws it. */
export type FolderActionDeps = {
  /** A folder change is in flight, so none can start. */
  busy: boolean;
  /** Ask for the name of a folder to add inside it. */
  add: () => void;
  /** Ask for a new name. */
  rename: () => void;
  /** Ask whether to delete it. */
  remove: () => void;
};

/** What a person can do to a folder in the tree: add one inside it, rename it, delete it (a folder that exists only as another's path has no vault folder to delete). */
export function folderActions(name: string, exists: boolean, deps: FolderActionDeps): ActionList {
  const busy = deps.busy ? "A folder change is in progress" : undefined;
  return [
    { id: "add", label: `Add a folder inside ${name}`, icon: "plus", disabledReason: busy, run: deps.add },
    { id: "rename", label: "Rename", icon: "pencil", disabledReason: busy, run: deps.rename },
    ...(exists ? ["separator" as const, { id: "delete", label: "Delete folder", icon: "trash" as const, destructive: true, disabledReason: busy, run: deps.remove }] : []),
  ];
}

/**
 * What a person can do to a vault item, shown on right click and usable from any menu: open it, copy its public
 * name and username, edit, star, delete. A stored secret is never offered here; it is revealed or copied from the
 * detail pane after the owner check.
 */
export function itemActions(item: ChaaviItem, deps: ItemActionDeps): ActionList {
  const username = item.type === "login" ? item.login.username : null;
  const first = item.type === "login" ? item.login.uris[0] : undefined;
  const website = first === undefined ? null : websiteUrl(first.uri);
  return [
    { id: "open", label: "Open", icon: "doc", run: deps.open },
    { id: "edit", label: "Edit", icon: "pencil", run: deps.edit },
    { id: "favorite", label: item.favorite ? "Remove from favorites" : "Add to favorites", icon: "star", run: deps.toggleFavorite },
    "separator",
    { id: "copy-name", label: "Copy name", icon: "copy", run: () => copyText(item.name) },
    ...(username === null || username === "" ? [] : [{ id: "copy-username", label: "Copy username", icon: "copy" as const, run: () => copyText(username) }]),
    ...(website === null ? [] : [{ id: "copy-website", label: "Copy website", icon: "link" as const, run: () => copyText(website) }]),
    "separator",
    { id: "delete", label: "Delete", icon: "trash", destructive: true, run: deps.remove },
  ];
}

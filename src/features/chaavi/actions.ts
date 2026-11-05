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

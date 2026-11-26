import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { asyncDataLoaderFeature, hotkeysCoreFeature, selectionFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { nas } from "../../../api";
import { BOX_HOME, ancestorsOf } from "../../../lib/content/boxLink";
import { Icon } from "../../../ui/Icon";
import type { NasFileEntry } from "../../../../types/nas";
import { listKey, statKey } from "./useFolder";

/** The tree's hidden root; its one child is the home, so the home shows as a row to open. */
const ROOT = "box://";

/** How far each level of folders steps in, in px. */
const INDENT = 14;

/** How long a folder's listing is reused by the tree before it asks Nas again, in ms. */
const FRESH_MS = 5_000;

/** The home as the tree's first row. */
const HOME: NasFileEntry = { name: "Home", path: BOX_HOME, kind: "folder", size: 0, modified: "", media_type: "" };

/** Props of {@link FolderTree}. */
export type FolderTreeProps = {
  /** The folder the explorer shows; its row is marked and its ancestors are opened. */
  current: string;
  /** A folder row was opened (pressed, or Enter). */
  onOpenFolder: (path: string) => void;
  /** Changes when something was written, so the folders opened reload. */
  version?: number;
  /** A folder's children could not be loaded. */
  onError: (err: unknown) => void;
  /** The accessible name of the tree. */
  label?: string;
};

/**
 * The folder tree: the home and the folders under it, loaded one level at a time as they open, with the arrow keys,
 * Enter to open a folder, and multi-select with the modifier keys (headless-tree supplies the behavior; the rows are
 * the app's own). Only folders appear, from the same listing the file list reads, so one fetch serves both.
 */
export function FolderTree({ current, onOpenFolder, version = 0, onError, label = "Folders" }: FolderTreeProps) {
  const client = useQueryClient();
  const [expanded, setExpanded] = useState<string[]>([ROOT, BOX_HOME]);
  const [selected, setSelected] = useState<string[]>([]);
  const [focused, setFocused] = useState<string | null>(null);

  const tree = useTree<NasFileEntry>({
    rootItemId: ROOT,
    getItemName: (item) => item.getItemData().name,
    isItemFolder: () => true,
    indent: INDENT,
    dataLoader: {
      getItem: (id) => (id === BOX_HOME ? HOME : client.fetchQuery({ queryKey: statKey(id), queryFn: () => nas.statFile(id), staleTime: FRESH_MS })),
      getChildrenWithData: async (id) => {
        if (id === ROOT) {
          return [{ id: BOX_HOME, data: HOME }];
        }
        try {
          const list = await client.fetchQuery({ queryKey: listKey(id), queryFn: () => nas.listFiles(id), staleTime: FRESH_MS });
          return list.entries.filter((entry) => entry.kind === "folder").map((entry) => ({ id: entry.path, data: entry }));
        } catch (err) {
          onError(err);
          return [];
        }
      },
    },
    state: { expandedItems: expanded, selectedItems: selected, focusedItem: focused },
    setExpandedItems: setExpanded,
    setSelectedItems: setSelected,
    setFocusedItem: setFocused,
    onPrimaryAction: (item) => {
      item.expand();
      onOpenFolder(item.getId());
    },
    features: [asyncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
  });

  useEffect(() => {
    setExpanded((open) => [...new Set([...open, ...ancestorsOf(current)])]);
  }, [current]);

  useEffect(() => {
    if (version > 0) {
      for (const id of expanded) {
        if (id !== ROOT) {
          void tree.getItemInstance(id).invalidateChildrenIds();
        }
      }
    }
  }, [version]);

  return (
    <div {...tree.getContainerProps(label)} className="flex min-h-0 flex-col gap-px">
      {tree.getItems().map((item) => {
        const open = item.isExpanded();
        const here = item.getId() === current;
        return (
          <button
            {...item.getProps()}
            key={item.getId()}
            type="button"
            data-selected={item.isSelected() || undefined}
            aria-current={here ? "location" : undefined}
            style={{ paddingLeft: 6 + item.getItemMeta().level * INDENT }}
            className={`flex h-8 w-full min-w-0 items-center gap-1.5 rounded-[8px] pr-2 text-left text-[13px] ${here ? "bg-sage-fill font-semibold text-ink" : "text-ink-muted"} ${item.isSelected() && !here ? "bg-sage-fill/50" : ""}`}
          >
            <Icon name="chevron" size={12} style={{ flex: "none", transform: open ? "rotate(90deg)" : undefined }} />
            <Icon name="folder" size={14} style={{ flex: "none" }} />
            <span className="min-w-0 flex-1 truncate">{item.getItemName()}</span>
          </button>
        );
      })}
    </div>
  );
}

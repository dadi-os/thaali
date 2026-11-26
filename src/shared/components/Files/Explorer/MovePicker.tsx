import { useState } from "react";
import { Dialog } from "../../../overlay/Dialog";
import { Button, ButtonGroup } from "../../../ui/Button";
import type { NasFileEntry } from "../../../../types/nas";
import { FolderTree } from "./FolderTree";

/** Props of {@link MovePicker}. */
export type MovePickerProps = {
  /** What is being moved; the picker shows while there are some. */
  entries: NasFileEntry[] | null;
  /** The folder the entries are in, where the picker starts. */
  folder: string;
  /** Changes when something was written, so the tree reloads. */
  version: number;
  /** The move is in flight: the buttons rest and the dialog cannot be dismissed. */
  pending: boolean;
  /** Why the last attempt failed, kept until the next attempt. */
  error: string | null;
  onCancel: () => void;
  /** Move the entries into the chosen folder. */
  onMove: (folder: string) => void;
  /** A folder's children could not be loaded. */
  onTreeError: (err: unknown) => void;
};

/** A dialog over the explorer that asks for a destination: the folder tree, with the chosen folder marked, and Move. */
export function MovePicker({ entries, folder, version, pending, error, onCancel, onMove, onTreeError }: MovePickerProps) {
  const [target, setTarget] = useState(folder);
  const title = entries === null ? "Move" : entries.length === 1 ? `Move ${entries[0]!.name}` : `Move ${entries.length} items`;
  return (
    <Dialog open={entries !== null} onClose={onCancel} title={title} subtitle="Choose the folder to move it into" locked={pending} width={420}>
      <div className="scroll h-64 overflow-auto rounded-[12px] border border-rule p-1.5">
        <FolderTree current={target} onOpenFolder={setTarget} version={version} onError={onTreeError} label="Destination folders" />
      </div>
      {error === null ? null : (
        <span role="alert" data-selectable className="text-[13px] leading-[18px] text-error [overflow-wrap:anywhere]">
          {error}
        </span>
      )}
      <ButtonGroup justify="flex-end">
        <Button tone="quiet" size="xl" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button tone="fill" size="xl" disabled={pending || target === folder} onClick={() => onMove(target)}>
          Move here
        </Button>
      </ButtonGroup>
    </Dialog>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isMeshOnline } from "../../api";
import { useConnection } from "../../hooks/useConnection";
import { useModuleState } from "../../hooks/useModuleState";
import { useRetained } from "../../hooks/useRetained";
import { Icon } from "../../ui/Icon";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { PreviewModal } from "../../overlay/PreviewModal";
import { failureProps } from "../../lib/ux/moduleState";
import { StateView } from "../../states/ModuleState";
import type { AttachmentSummary } from "../../../types/hath";
import type { NasFileEntry } from "../../../types/nas";
import { Explorer, resolveBoxPath, type BoxTarget } from "./Explorer";
import { attachmentSource, boxSource, FileViewActions, FileViewBody, useFileView } from "./FilePreview";

/** Props of {@link FileModal} for a message attachment. */
export type AttachmentFileModalProps = {
  /** The file to show, or null when the modal is closed. */
  file: AttachmentSummary | null;
  onClose: () => void;
};

/** Props of {@link FileModal} for the box's files. */
export type BoxFileModalProps = {
  /** The absolute box path to open at, or null when the modal is closed: a file opens its folder with the file selected, a folder opens its listing. */
  path: string | null;
  /** Pick mode: the explorer offers Insert links, which hands back the selected paths and closes. */
  onPick?: (paths: string[]) => void;
  /** Draw over the nearest positioned ancestor instead of the window (see Modal), as the design gallery frames it. */
  scoped?: boolean;
  onClose: () => void;
};

export type FileModalProps = AttachmentFileModalProps | BoxFileModalProps;

/** The panel of a wide file: the largest the window allows up to a page's width; an image sizes the panel to itself instead. */
const WIDE = "h-[min(88vh,820px)] w-[min(92vw,960px)]";
const FIT = "max-h-[88vh] max-w-[min(92vw,1200px)]";

/**
 * A file in the shared {@link PreviewModal}, in one of two modes. Given a message attachment (`file`) it shows its name
 * over its kind, line count and size, with copy (text) and download beside the close button, and a body for its kind:
 * the image, the PDF, the code colored by its language with line numbers, rendered Markdown (or its source), or, for
 * other files, a card to download them. Given a box path (`path`) it is the file explorer opened at that path with
 * the same preview of the selected file under the list; a path that is gone opens its nearest parent with a note.
 */
export function FileModal(props: FileModalProps) {
  return "path" in props ? <BoxFileModal {...props} /> : <AttachmentFileModal {...props} />;
}

function AttachmentFileModal({ file, onClose }: AttachmentFileModalProps) {
  const shown = useRetained(file);
  return shown === null ? null : <OpenFile key={shown.id} file={shown} open={file !== null} onClose={onClose} />;
}

type OpenFileProps = {
  file: AttachmentSummary;
  /** False while the modal plays its exit animation. */
  open: boolean;
  onClose: () => void;
};

/** One attachment's modal: it reads the file, then gives the frame its head and the body for its kind. */
function OpenFile({ file, open, onClose }: OpenFileProps) {
  const view = useFileView(attachmentSource(file));
  return (
    <PreviewModal
      open={open}
      onClose={onClose}
      label={file.filename}
      panelClassName={view.kind === "image" ? FIT : WIDE}
      title={
        <span data-selectable className="min-w-0 truncate text-[15px] leading-5 font-semibold text-ink" title={file.filename}>
          {file.filename}
        </span>
      }
      subtitle={<span className="block truncate text-[12.5px] leading-4">{view.meta}</span>}
      actions={<FileViewActions view={view} />}
    >
      <FileViewBody view={view} />
    </PreviewModal>
  );
}

function BoxFileModal({ path, onPick, scoped, onClose }: BoxFileModalProps) {
  const shown = useRetained(path);
  return shown === null ? null : <OpenBox key={shown} path={shown} onPick={onPick} scoped={scoped} open={path !== null} onClose={onClose} />;
}

type OpenBoxProps = {
  path: string;
  onPick?: (paths: string[]) => void;
  scoped?: boolean;
  /** False while the modal plays its exit animation. */
  open: boolean;
  onClose: () => void;
};

/** The explorer's modal at one path: it first finds where the path leads (see {@link resolveBoxPath}), then draws the explorer there. */
function OpenBox({ path, onPick, scoped, open, onClose }: OpenBoxProps) {
  const { state: connection } = useConnection();
  const target = useQuery({ queryKey: ["nas", "target", path], queryFn: () => resolveBoxPath(path), enabled: isMeshOnline(connection), staleTime: Infinity, gcTime: 0 });
  const state = useModuleState(target, () => false);
  return (
    <PreviewModal
      open={open}
      onClose={onClose}
      scoped={scoped}
      label="Files"
      mark={<Icon name="folder" size={16} />}
      title={<span className="text-[15px] leading-5 font-semibold text-ink">Files</span>}
      subtitle={<span className="block truncate text-[12.5px] leading-4">{path}</span>}
    >
      {state.kind === "ready" ? (
        <Browser target={state.data} onPick={onPick} onClose={onClose} />
      ) : state.kind === "loading" ? (
        <div aria-label="Opening" className="flex flex-col gap-2 p-5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={28} />
          ))}
        </div>
      ) : state.kind === "offline" ? (
        <StateView kind="offline" title="dadi is unreachable" detail="Files open when this computer is back on the network." />
      ) : state.kind === "module-offline" ? (
        <StateView kind="module-offline" title="Files aren’t available" {...failureProps(state.error)} onRetry={() => void target.refetch()} />
      ) : state.kind === "error" ? (
        <StateView kind="error" title="This path didn’t open" {...failureProps(state.error)} onRetry={() => void target.refetch()} />
      ) : null}
    </PreviewModal>
  );
}

type BrowserProps = {
  target: BoxTarget;
  onPick?: (paths: string[]) => void;
  onClose: () => void;
};

/** The explorer at a resolved target, holding the folder, selection and filter, with the selected file's preview under the list and, in pick mode, the Insert links bar. */
function Browser({ target, onPick, onClose }: BrowserProps) {
  const [folder, setFolder] = useState(target.folder);
  const [selection, setSelection] = useState<NasFileEntry[]>(target.selected === null ? [] : [target.selected]);
  const [filter, setFilter] = useState(target.removed ?? "");
  const [notice, setNotice] = useState<string | null>(target.removed === null ? null : "File removed");
  const previewed = selection.length === 1 && selection[0]!.kind !== "folder" ? selection[0]! : null;
  return (
    <>
      <Explorer
        folder={folder}
        onFolderChange={(next) => {
          setFolder(next);
          setNotice(null);
        }}
        selection={selection}
        onSelectionChange={setSelection}
        filter={filter}
        onFilterChange={setFilter}
        notice={notice}
      >
        {previewed === null ? undefined : <FilePane key={previewed.path} entry={previewed} />}
      </Explorer>
      {onPick === undefined ? null : (
        <div className="flex h-14 flex-none items-center justify-end gap-3 border-t border-rule px-4 text-[13px] text-ink-muted">
          <span>{selection.length === 0 ? "Select files or folders to link" : `${selection.length} selected`}</span>
          <Button
            tone="fill"
            size="lg"
            disabled={selection.length === 0}
            onClick={() => {
              onPick(selection.map((entry) => entry.path));
              onClose();
            }}
          >
            Insert links
          </Button>
        </div>
      )}
    </>
  );
}

/** The selected file's preview under the list: its name over its kind and size, the controls, and the body for its kind. */
function FilePane({ entry }: { entry: NasFileEntry }) {
  const view = useFileView(boxSource(entry));
  return (
    <>
      <div className="flex min-h-12 flex-none items-center gap-3 border-b border-rule px-4 py-1.5">
        <div className="flex min-w-0 flex-1 flex-col">
          <span data-selectable className="truncate text-[13px] font-semibold text-ink" title={entry.name}>
            {entry.name}
          </span>
          <span className="truncate text-[12px] text-ink-muted">{view.meta}</span>
        </div>
        <FileViewActions view={view} />
      </div>
      <FileViewBody view={view} />
    </>
  );
}

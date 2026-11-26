import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { setOpenBoxPath } from "../../../contexts/files";
import { ApiError } from "../../api/errors";
import { isMeshOnline, nas } from "../../api";
import { useConnection } from "../../hooks/useConnection";
import { useInView } from "../../hooks/useInView";
import { useContextActions } from "../../interaction/contextMenu";
import { baseName, parseBoxHref } from "../../lib/content/boxLink";
import { Tooltip } from "../../overlay/Tooltip";
import { Icon } from "../../ui/Icon";
import type { NasFileEntry } from "../../../types/nas";
import { iconFor, statKey } from "./Explorer";
import { fileActions } from "./fileActions";

/** Wait before the path tooltip shows under the pointer. */
const TOOLTIP_DELAY_MS = 450;

/** How long a link's check that its file still exists is reused, in ms. */
const CHECK_FRESH_MS = 60_000;

/** Props of {@link FileLink}. */
export type FileLinkProps = {
  /** The link target as written: a `box://` URL. */
  href: string;
  /** The link's text as parsed. */
  children?: ReactNode;
};

/**
 * A link to a file or folder on the box, in a message: the file's icon before its name in the link style, like a web link
 * with its favicon (no chip). A press opens the explorer at that path. When it scrolls into view it asks Nas whether the
 * path still exists (never while the mesh is out of reach); a path that is gone shows its name struck through with
 * "File removed", still opening the nearest folder. Right-click offers the file actions. A target that is not a
 * `box://` path is plain text.
 */
export function FileLink({ href, children }: FileLinkProps) {
  const link = parseBoxHref(href);
  return link === null ? <span>{children}</span> : <BoxLink path={link.path} folder={link.folder} label={children} />;
}

type BoxLinkProps = {
  path: string;
  folder: boolean;
  label: ReactNode;
};

function BoxLink({ path, folder, label }: BoxLinkProps) {
  const { state: connection } = useConnection();
  const [watch, seen] = useInView<HTMLButtonElement>();
  const stat = useQuery({ queryKey: statKey(path), queryFn: () => nas.statFile(path), enabled: seen && isMeshOnline(connection), staleTime: CHECK_FRESH_MS, retry: false });
  const gone = stat.error instanceof ApiError && stat.error.status === 404;
  const entry: NasFileEntry = stat.data ?? { name: baseName(path), path, kind: folder ? "folder" : "file", size: 0, modified: "", media_type: "" };
  const context = useContextActions(() => fileActions([entry], { onOpen: () => setOpenBoxPath(path) }));
  return (
    <Tooltip content={path} delayMs={TOOLTIP_DELAY_MS} wrap className="inline!">
      <button ref={watch} {...context} type="button" onClick={() => setOpenBoxPath(path)} className="chat-link inline text-left">
        <Icon name={iconFor(entry)} size={13} style={{ display: "inline-block", verticalAlign: "-0.1em", marginRight: "0.3em", opacity: 0.8 }} />
        <span className={gone ? "line-through opacity-70" : undefined}>{label}</span>
        {gone ? <span className="ml-1.5 text-[0.85em] text-ink-muted">File removed</span> : null}
      </button>
    </Tooltip>
  );
}

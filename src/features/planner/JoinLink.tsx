import { useEffect, useState } from "react";
import { pushToast } from "../../contexts/toasts";
import { openExternal } from "../../shared/desktop/open";
import { Tooltip } from "../../shared/overlay/Tooltip";
import { copyText } from "../../shared/desktop/clipboard";
import { IconButton } from "../../shared/ui/Button";
import { Icon } from "../../shared/ui/Icon";
import type { MeetingLink } from "./meeting";

/** Props of {@link JoinLink}. */
export type JoinLinkProps = {
  link: MeetingLink;
};

/**
 * The "Join" value of a virtual plan: the service's name, which opens the call in the browser when clicked. Hovering or focusing
 * it shows the full address with a copy glyph (the copy button beside the row copies it).
 */
export function JoinLink({ link }: JoinLinkProps) {
  return (
    <Tooltip
      side="top"
      wrap
      content={
        <span className="inline-flex items-center gap-1.5">
          {link.url}
          <Icon name="copy" size={12} />
        </span>
      }
    >
      <button
        type="button"
        aria-label={`Join ${link.service} call`}
        onClick={() => void openExternal(link.url).catch((error: unknown) => pushToast({ key: "planner:join", tone: "error", title: "Couldn’t open the call", body: error instanceof Error ? error.message : String(error) }))}
        className="ui-hover-fill ui-trans -mx-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-left text-ink underline decoration-ink-ghost decoration-dotted underline-offset-4"
      >
        <Icon name="video" size={14} />
        {link.service}
      </button>
    </Tooltip>
  );
}

/** How long the tooltip says "Copied" before it offers "Copy link" again. */
const COPIED_MS = 1_500;

/** The copy button beside a Join row: its tooltip reads "Copy link", then a check and "Copied" for a moment after the click. */
export function CopyLinkButton({ link }: JoinLinkProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <Tooltip
      side="top"
      content={
        <span className="inline-flex items-center gap-1.5">
          {copied ? <Icon name="check" size={12} /> : null}
          {copied ? "Copied" : "Copy link"}
        </span>
      }
    >
      <IconButton
        icon={copied ? "check" : "copy"}
        label="Copy link"
        title={undefined}
        data-keep-open
        size={28}
        iconSize={14}
        onClick={() =>
          copyText(link.url).then(
            () => setCopied(true),
            (error: unknown) => pushToast({ key: "planner:copy-link", tone: "error", title: "Couldn’t copy the link", body: error instanceof Error ? error.message : String(error) }),
          )
        }
      />
    </Tooltip>
  );
}

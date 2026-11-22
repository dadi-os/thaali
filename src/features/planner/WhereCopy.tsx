import { useEffect, useState } from "react";
import { pushToast } from "../../contexts/toasts";
import { copyText } from "../../shared/desktop/clipboard";
import { Tooltip } from "../../shared/overlay/Tooltip";
import { Icon } from "../../shared/ui/Icon";

/** How long the tooltip says "Copied" before it shows the address again. */
const COPIED_MS = 1_500;

/** Props of {@link WhereCopy}. */
export type WhereCopyProps = {
  /** The place as the row reads it: its name, and its room. */
  label: string;
  /** The street address the click copies and the tooltip shows; the place is plain text when it has none. */
  address: string | null;
};

/**
 * The "Where" value of a plan: the place's name, which copies its address to the clipboard when clicked and opens nothing. Hovering
 * or focusing it shows the address with a copy glyph; once copied the tooltip says "Copied" with a check, then shows the address again.
 */
export function WhereCopy({ label, address }: WhereCopyProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);
  if (address === null) return <span>{label}</span>;
  return (
    <Tooltip
      side="top"
      wrap
      content={
        <span className="inline-flex items-center gap-1.5">
          {copied ? <Icon name="check" size={12} /> : null}
          {copied ? "Copied" : address}
          {copied ? null : <Icon name="copy" size={12} />}
        </span>
      }
    >
      <button
        type="button"
        data-keep-open
        aria-label="Copy address"
        onClick={() =>
          copyText(address).then(
            () => setCopied(true),
            (error: unknown) => pushToast({ key: "planner:copy-address", tone: "error", title: "Couldn’t copy the address", body: error instanceof Error ? error.message : String(error) }),
          )
        }
        className="ui-hover-fill ui-trans -mx-1.5 cursor-pointer rounded-md px-1.5 text-left text-ink underline decoration-ink-ghost decoration-dotted underline-offset-4"
      >
        {label}
      </button>
    </Tooltip>
  );
}

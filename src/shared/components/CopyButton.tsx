import { useEffect, useState } from "react";
import { copyText } from "../lib/platform/clipboard";
import { IconCheck, IconCopy } from "./IconButton";

/** How long the check mark shows after a copy. */
const COPIED_MS = 1_400;

export type CopyButtonProps = {
  /** Text placed on the clipboard. */
  text: string;
  /** Accessible name and tooltip, e.g. "Copy message". */
  label: string;
  /** Extra classes, e.g. positioning or a hover reveal. */
  className?: string;
};

/**
 * Small icon button that copies `text`: the icon turns into a check for a moment, and a
 * failed copy shows the clipboard's error beside it until the next try.
 */
export function CopyButton({ text, label, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        aria-label={copied ? "Copied" : label}
        title={copied ? "Copied" : label}
        onClick={(e) => {
          e.stopPropagation();
          setError(null);
          copyText(text)
            .then(() => setCopied(true))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
        }}
        className={`inline-flex size-6 items-center justify-center rounded-[7px] transition-colors duration-fast ease-dadi hover:bg-sage-active/50 [&_svg]:size-[13px] ${
          copied ? "text-sage-deep" : error ? "text-error" : "text-ink-ghost hover:text-ink-muted"
        }`}
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-error">
          Copy failed: {error}
        </span>
      ) : null}
    </span>
  );
}

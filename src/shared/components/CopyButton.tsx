import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { copyText } from "../lib/platform/clipboard";
import { EASE, SLOW_S } from "../lib/ux/motion";
import { IconCheck, IconCopy } from "./IconButton";

/** How long the check mark shows after a copy. */
const COPIED_MS = 1_400;

export type CopyButtonProps = {
  /**
   * Text placed on the clipboard, or a function that fetches it at click time, so a secret
   * can be copied without being rendered first.
   */
  text: string | (() => Promise<string>);
  /** Accessible name and tooltip, e.g. "Copy message". */
  label: string;
  /** Extra classes, e.g. positioning or a hover reveal. */
  className?: string;
};

/**
 * Small icon button that copies `text`: the icon pops into a check for a moment, and a
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
          (typeof text === "string" ? copyText(text) : text().then(copyText))
            .then(() => setCopied(true))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
        }}
        className={`inline-flex size-6 items-center justify-center rounded-[7px] transition-colors duration-fast ease-dadi hover:bg-sage-active/50 [&_svg]:size-[13px] ${
          copied ? "text-sage-deep" : error ? "text-error" : "text-ink-ghost hover:text-ink-muted"
        }`}
      >
        <AnimatePresence initial={false}>
          <motion.span
            key={copied ? "copied" : "copy"}
            className="inline-flex"
            initial={{ scale: 0.5, opacity: 0, rotate: copied ? -45 : 0 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: SLOW_S, ease: EASE }}
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </motion.span>
        </AnimatePresence>
      </button>
      {error ? (
        <span role="alert" className="text-[11px] text-error">
          Copy failed: {error}
        </span>
      ) : null}
    </span>
  );
}

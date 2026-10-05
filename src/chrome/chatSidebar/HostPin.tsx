import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { BrowserFrame } from "../../features/agents/BrowserFrame";
import { TerminalScreen } from "../../features/agents/TerminalScreen";
import { IconDismiss } from "../../shared/components/IconButton";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";

export type HostPinProps = {
  /** Live Nas browser to pin, or null when this agent has none. */
  browserId: number | null;
  /** Live Nas terminal and the agent's last command in it, or null. */
  terminal: { id: string; last_command: string | null } | null;
};

/** Which host view is blown up into the modal. */
type Expanded = "browser" | "terminal" | null;

/**
 * Host strip above an open agent thread: the agent's live browser and live terminal as
 * glass cards. The strip is in layout (the thread scrolls beneath it, not behind it) and
 * reads as floating through its shadow and the thread's top dissolve. Clicking a card
 * blows it up into a frosted modal; ESC, the close button or a click on the frost puts
 * it back.
 */
export function HostPin({ browserId, terminal }: HostPinProps) {
  const [expanded, setExpanded] = useState<Expanded>(null);
  const shown =
    (expanded === "browser" && browserId !== null) || (expanded === "terminal" && terminal !== null)
      ? expanded
      : null;

  useEffect(() => {
    if (shown === null) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]);

  if (browserId === null && terminal === null) {
    return null;
  }

  const card =
    "host-pin block w-full cursor-zoom-in text-left transition-[transform,box-shadow] duration-slow ease-dadi hover:-translate-y-px hover:shadow-[var(--shadow-deep)]";

  return (
    <div className="relative z-10 flex shrink-0 flex-col gap-2 px-3 pb-1 pt-3">
      {browserId !== null ? (
        <button type="button" className={card} aria-label="Expand browser" onClick={() => setExpanded("browser")}>
          <div className="flex min-w-0 items-center gap-2 px-3 py-2">
            <span className="host-pin__live" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[11px] leading-none tracking-[0.12em] text-sage-text uppercase">
              Browser
            </span>
          </div>
          <div className="px-1.5 pb-1.5">
            <BrowserFrame browserId={browserId} variant="rail" className="rounded-[11px]" />
          </div>
        </button>
      ) : null}
      {terminal !== null ? (
        <button type="button" className={card} aria-label="Expand terminal" onClick={() => setExpanded("terminal")}>
          <div className="p-1.5">
            <TerminalScreen terminalId={terminal.id} command={terminal.last_command} variant="rail" className="rounded-[11px]" />
          </div>
        </button>
      ) : null}

      {createPortal(
        <AnimatePresence>
          {shown !== null ? (
            <motion.div
              key="host-modal"
              className="host-modal fixed inset-0 z-[200] flex items-center justify-center p-[4vh_4vw]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: SLOW_S, ease: EASE }}
              onClick={() => setExpanded(null)}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={shown === "browser" ? "Browser" : "Terminal"}
                className="host-modal__sheet relative flex h-full max-h-[86vh] w-full max-w-[1200px] flex-col overflow-hidden"
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: SLOW_S, ease: EASE }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center gap-2 px-4 py-2.5">
                  <span className="host-pin__live" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[11px] tracking-[0.12em] text-sage-text uppercase">
                    {shown === "browser" ? "Browser" : "Terminal"}
                  </span>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setExpanded(null)}
                    className="inline-flex size-7 items-center justify-center rounded-full text-ink-muted transition-colors duration-fast ease-dadi hover:bg-sage-active/50 hover:text-ink [&_svg]:size-3.5"
                  >
                    <IconDismiss />
                  </button>
                </div>
                <div className="min-h-0 flex-1 px-2 pb-2">
                  {shown === "browser" && browserId !== null ? (
                    <BrowserFrame browserId={browserId} variant="full" className="rounded-[14px]" />
                  ) : null}
                  {shown === "terminal" && terminal !== null ? (
                    <TerminalScreen
                      terminalId={terminal.id}
                      command={terminal.last_command}
                      variant="full"
                      className="h-full rounded-[14px]"
                    />
                  ) : null}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

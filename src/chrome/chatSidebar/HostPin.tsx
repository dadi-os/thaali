import { AnimatePresence, motion } from "motion/react";
import { TaskView } from "../../shared/components/Task/TaskView";
import { REVEAL, RISE } from "../../shared/motion";
import type { PinnedTask } from "../../features/agents/sessions";

export type HostPinProps = {
  /** The agent's newest live browser task, or null when it has none. */
  browser: PinnedTask | null;
  /** The agent's newest live terminal task, or null when it has none. */
  terminal: PinnedTask | null;
};

/**
 * Strip above an open agent thread: the agent's live browser and live terminal, each drawn by the shared
 * {@link TaskView} so they look and open exactly as they do in the agent sheet and on the System page. A click opens the takeover.
 * The strip is in layout (the thread scrolls beneath it, not behind it).
 */
export function HostPin({ browser, terminal }: HostPinProps) {
  const pinned = [
    browser === null ? null : { ...browser, kind: "browser" as const },
    terminal === null ? null : { ...terminal, kind: "terminal" as const },
  ].filter((entry) => entry !== null);
  return (
    <AnimatePresence initial={false}>
      {pinned.length > 0 ? (
        <motion.div key="pin" {...REVEAL} className="relative z-10 shrink-0 overflow-hidden">
          <div className="flex flex-col gap-2 px-3 pt-3 pb-1">
            <AnimatePresence initial={false}>
              {pinned.map((entry) => (
                <motion.div key={entry.task} {...RISE}>
                  <TaskView task={entry.task} kind={entry.kind} resource={entry.resource} caption={entry.caption} variant="compact" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

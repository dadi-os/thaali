import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FADE } from "../../../shared/motion";
import { AgentName } from "../../../shared/ui/AgentName";
import { Tooltip } from "../../../shared/overlay/Tooltip";
import { IconButton, SplitButton } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Clamp, Truncate } from "../../../shared/ui/Truncate";
import type { TaskStatus } from "../../../types/hath";
import type { ControlState } from "./control";

/** What the modal's header and footer say about the task. */
export type TakeoverTask = {
  /** The task's address, such as `task/browser/3f2a91`. */
  task: string;
  kind: "browser" | "terminal";
  /** The agent that started it. */
  owner: string;
  purpose: string;
  status: TaskStatus;
  /** The browser slot or terminal id it holds. */
  resource: string;
};

/** A task's id without its `task/` prefix. */
function shortId(task: string): string {
  return task.replace(/^task\//, "");
}

/** Whether the state is one in which Ankur holds the task, including the moment it is being handed back. */
export function isControlling(state: ControlState): boolean {
  return state === "in-control" || state === "returning";
}

/** A keyboard shortcut as the footer names it. */
function Kbd({ children }: { children: string }) {
  return <span className="rounded-[6px] border border-sage-line px-[5px] py-px font-numeric text-[11px] text-ink-muted">{children}</span>;
}

/** What the title's state dot says for a task that is doing something; idle, asleep and stopped show no dot. */
const DOT: Partial<Record<TaskStatus, { color: string; pulse: boolean; label: string }>> = {
  working: { color: "var(--sage)", pulse: true, label: "Working" },
  asking: { color: "var(--tide)", pulse: true, label: "Waiting on its agent" },
  paused: { color: "var(--ink-faint)", pulse: false, label: "Paused" },
};

export type TaskPreviewOptions = {
  state: ControlState;
  onTakeover: () => void;
  onReturn: () => void;
  /** Opens the arrow's menu from the split button's box. */
  onMenu: (anchor: DOMRect) => void;
};

/**
 * The head a task's modal gives {@link PreviewModal}: the task's kind as the mark, its id and owner behind a small state
 * dot over its purpose, and one split button. Takeover (Return while Ankur is in control) is the main half and the arrow
 * opens the Pause, Resume and Stop menu.
 */
export function taskHead(task: TakeoverTask, { state, onTakeover, onReturn, onMenu }: TaskPreviewOptions) {
  const controlling = isControlling(state);
  const busy = state === "pausing" || state === "returning";
  const dot = DOT[task.status];
  return {
    mark: <Icon name={task.kind === "browser" ? "browser" : "terminal"} size={16} />,
    title: (
      <>
        {dot === undefined ? null : (
          <Tooltip content={dot.label} side="bottom">
            <span role="img" aria-label={dot.label} className={`dot size-2 ${dot.pulse ? "dot-pulse" : ""}`} style={{ background: dot.color }} />
          </Tooltip>
        )}
        <Truncate text={shortId(task.task)} className="flex-none font-numeric text-ink" />
        <AgentName name={task.owner} className="flex-1 text-ink-muted" />
      </>
    ),
    subtitle: <Clamp text={task.purpose} lines={1} style={{ fontSize: 13, color: "var(--ink-muted)" }} />,
    actions: (
      <SplitButton disabled={busy} onClick={controlling ? onReturn : onTakeover} onMenu={onMenu} menuLabel="More">
        {state === "pausing" ? "Taking over…" : state === "returning" ? "Returning…" : controlling ? "Return" : "Takeover"}
      </SplitButton>
    ),
  };
}

/** The footer a task's modal gives {@link PreviewModal}: the shortcut that leaves or returns, and where the task runs. */
export function taskFooter(kind: "browser" | "terminal", resource: string, state: ControlState) {
  const controlling = isControlling(state);
  return (
    <>
      <div className="flex items-center gap-1.5">
        <Kbd>{controlling ? "⌘ ." : "Esc"}</Kbd>
        {controlling ? "Return" : "Close"}
      </div>
      <div className="flex-1" />
      <Truncate text={kind === "browser" ? `slot ${resource}` : `tmux ${resource}`} className="ui-mono" />
    </>
  );
}

/** The ring that marks the page or the pane Ankur controls; it lives inside the modal and nowhere else. */
function ControlRing({ controlling }: { controlling: boolean }) {
  return (
    <AnimatePresence>
      {controlling ? <motion.span key="ring" {...FADE} className="pointer-events-none absolute inset-0 z-[3] shadow-[inset_0_0_0_2px_var(--sage-deep)]" /> : null}
    </AnimatePresence>
  );
}

export type TakeoverBrowserProps = {
  /** The address of the page in front, as the address pill shows it. */
  url: string;
  /** The task's id, for the page's accessible name. */
  task: string;
  /** Ankur controls the browser: Back and Reload work and a ring marks the page. */
  controlling: boolean;
  onBack: () => void;
  onReload: () => void;
  /** The page itself: the live picture, which sizes itself to the largest 16:9 the region allows. */
  children: ReactNode;
};

/** The browser modal's body: the address bar with Back and Reload, and the page in a region the picture is centred in. */
export function TakeoverBrowser({ url, task, controlling, onBack, onReload, children }: TakeoverBrowserProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 flex-none items-center gap-2 border-b border-rule bg-[var(--chrome)] px-3">
        <IconButton icon="back" label="Back" size={32} disabled={!controlling} onClick={onBack} />
        <IconButton icon="retry" label="Reload" size={32} disabled={!controlling} onClick={onReload} />
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-rule bg-[var(--paper)] px-3 text-[13px] text-ink-muted">
          <Icon name="lock" size={12} />
          <Truncate text={url} className="min-w-0 flex-1 text-[13px]" />
        </div>
      </div>
      <div role="application" aria-label={`Browser page for ${shortId(task)}`} className="relative min-h-0 flex-1 cursor-default [container-type:size] bg-[#ece9e1]">
        {children}
      </div>
      <ControlRing controlling={controlling} />
    </div>
  );
}

export type TakeoverTerminalProps = {
  /** Ankur controls the terminal: a ring marks the pane. */
  controlling: boolean;
  /** The pane: its output, which Ankur types into. */
  children: ReactNode;
};

/** The terminal modal's body: the pane in its dark frame. */
export function TakeoverTerminal({ controlling, children }: TakeoverTerminalProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#23271f] text-[#dfe6d6]">
      {children}
      <ControlRing controlling={controlling} />
    </div>
  );
}

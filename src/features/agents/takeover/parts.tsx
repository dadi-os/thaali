import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FADE } from "../../../shared/motion";
import { AgentName } from "../../../shared/ui/AgentName";
import { Tooltip } from "../../../shared/overlay/Tooltip";
import { IconButton } from "../../../shared/ui/Button";
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

export type TakeoverHeaderProps = {
  task: TakeoverTask;
  state: ControlState;
  onTakeover: () => void;
  onReturn: () => void;
  /** Opens the arrow's menu from the split button's box. */
  onMenu: (anchor: DOMRect) => void;
  onClose: () => void;
};

/**
 * The modal's header: the task's kind, its id and owner behind a small state dot, its purpose, then one split button.
 * Takeover (Return while Ankur is in control) is the main half and the arrow opens the Pause, Resume and Stop menu.
 */
export function TakeoverHeader({ task, state, onTakeover, onReturn, onMenu, onClose }: TakeoverHeaderProps) {
  const controlling = isControlling(state);
  const busy = state === "pausing" || state === "returning";
  const dot = DOT[task.status];
  return (
    <div className="flex min-h-[60px] flex-none items-center gap-3 border-b border-rule py-2 pr-3 pl-4">
      <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-sage-fill text-sage-text">
        <Icon name={task.kind === "browser" ? "browser" : "terminal"} size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2.5 text-[13px]">
          {dot === undefined ? null : (
            <Tooltip content={dot.label} side="bottom">
              <span role="img" aria-label={dot.label} className={`dot size-2 ${dot.pulse ? "dot-pulse" : ""}`} style={{ background: dot.color }} />
            </Tooltip>
          )}
          <Truncate text={shortId(task.task)} className="flex-none font-numeric text-ink" />
          <AgentName name={task.owner} className="flex-1 text-ink-muted" />
        </div>
        <Clamp text={task.purpose} lines={1} style={{ fontSize: 13, color: "var(--ink-muted)" }} />
      </div>
      <div className="flex h-9 flex-none items-stretch overflow-hidden rounded-[12px] bg-sage-deep text-bone">
        <button type="button" disabled={busy} onClick={controlling ? onReturn : onTakeover} className="ui-trans ui-hover-solid px-4 text-[14px] font-semibold whitespace-nowrap disabled:opacity-60">
          {state === "pausing" ? "Taking over…" : state === "returning" ? "Returning…" : controlling ? "Return" : "Takeover"}
        </button>
        <button
          type="button"
          aria-label="More"
          aria-haspopup="menu"
          title="More"
          disabled={busy}
          onClick={(event) => onMenu(event.currentTarget.parentElement!.getBoundingClientRect())}
          className="ui-trans ui-hover-solid flex w-8 items-center justify-center border-l border-bone/25 disabled:opacity-60"
        >
          <Icon name="chevDown" size={14} />
        </button>
      </div>
      <IconButton icon="close" label="Close" size={36} onClick={onClose} />
    </div>
  );
}

export type TakeoverFooterProps = {
  kind: "browser" | "terminal";
  resource: string;
  state: ControlState;
};

/** The modal's footer: the shortcut that leaves or returns, and where the task runs. */
export function TakeoverFooter({ kind, resource, state }: TakeoverFooterProps) {
  const controlling = isControlling(state);
  return (
    <div className="flex h-11 flex-none items-center gap-3.5 border-t border-rule px-4 text-[13px] text-ink-muted">
      <div className="flex items-center gap-1.5">
        <Kbd>{controlling ? "⌘ ." : "Esc"}</Kbd>
        {controlling ? "Return" : "Close"}
      </div>
      <div className="flex-1" />
      <Truncate text={kind === "browser" ? `slot ${resource}` : `tmux ${resource}`} className="ui-mono" />
    </div>
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

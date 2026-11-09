import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FADE, REVEAL } from "../../../shared/motion";
import { AgentName } from "../../../shared/ui/AgentName";
import { Badge } from "../../../shared/ui/Badge";
import { Button, IconButton } from "../../../shared/ui/Button";
import { Icon } from "../../../shared/ui/Icon";
import { Clamp, Truncate } from "../../../shared/ui/Truncate";
import type { TaskStatus } from "../../../types/hath";

/** What the modal's header, banner and footer say about the task. */
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

/** A keyboard shortcut as the footer names it. */
function Kbd({ children }: { children: string }) {
  return <span className="rounded-[6px] border border-sage-line px-[5px] py-px font-numeric text-[11px] text-ink-muted">{children}</span>;
}

export type TakeoverHeaderProps = {
  task: TakeoverTask;
  /** Ankur is driving: the helper is paused and the header says so, with Hand back in place of Close. */
  driving: boolean;
  onClose: () => void;
};

/** The modal's header: the task's kind, id, owner and purpose, then its status, or, while Ankur drives, the mark that he is and the way to hand it back. */
export function TakeoverHeader({ task, driving, onClose }: TakeoverHeaderProps) {
  return (
    <div className="flex min-h-[60px] flex-none items-center gap-3 border-b border-rule py-2 pr-3 pl-4">
      <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-sage-fill text-sage-text">
        <Icon name={task.kind === "browser" ? "browser" : "terminal"} size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-2.5 text-[13px]">
          <Truncate text={shortId(task.task)} className="flex-none font-numeric text-ink" />
          <AgentName name={task.owner} className="flex-1 text-ink-muted" />
        </div>
        <Clamp text={task.purpose} lines={1} style={{ fontSize: 13, color: "var(--ink-muted)" }} />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {driving ? (
          <motion.span key="driving" {...FADE} className="inline-flex h-7 flex-none items-center gap-[7px] rounded-full bg-sage-deep px-3 text-[13px] font-semibold whitespace-nowrap text-bone">
            <span className="dot size-1.5 bg-bone" />
            You are driving
          </motion.span>
        ) : (
          <motion.span key="status" {...FADE} className="flex">
            <Badge status={task.status} />
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        {driving ? (
          <motion.span key="hand-back" {...FADE} className="flex">
            <Button tone="fill" onClick={onClose}>
              Hand back
            </Button>
          </motion.span>
        ) : (
          <motion.span key="close" {...FADE} className="flex">
            <IconButton icon="close" label="Close" size={36} onClick={onClose} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The strip under the header while Ankur drives: the helper is paused and waits for its agent to be handed back. */
export function TakeoverBanner({ owner, driving }: { owner: string; driving: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {driving ? (
        <motion.div key="banner" {...REVEAL} className="flex-none overflow-hidden">
          <div className="flex h-10 items-center gap-2.5 border-b border-due-line bg-due-fill px-4 text-[13px] font-medium text-due-ink">
            <Icon name="pause" size={14} />
            <span className="whitespace-nowrap">Paused while you drive</span>
            <Truncate text={`${owner}’s helper waits`} className="min-w-0 flex-1 font-normal" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export type TakeoverFooterProps = {
  kind: "browser" | "terminal";
  resource: string;
  driving: boolean;
};

/** The modal's footer: the shortcut that leaves, and where the task runs. */
export function TakeoverFooter({ kind, resource, driving }: TakeoverFooterProps) {
  return (
    <div className="flex h-11 flex-none items-center gap-3.5 border-t border-rule px-4 text-[13px] text-ink-muted">
      <div className="flex items-center gap-1.5">
        <Kbd>{driving ? "⌘ ." : "Esc"}</Kbd>
        {driving ? "Hand back" : "Close"}
      </div>
      <div className="flex-1" />
      <Truncate text={kind === "browser" ? `slot ${resource}` : `tmux ${resource}`} className="ui-mono" />
    </div>
  );
}

/** The ring that marks the page or the pane Ankur is driving; it lives inside the modal and nowhere else. */
function DrivingRing({ driving }: { driving: boolean }) {
  return (
    <AnimatePresence>
      {driving ? <motion.span key="ring" {...FADE} className="pointer-events-none absolute inset-0 z-[3] shadow-[inset_0_0_0_2px_var(--sage-deep)]" /> : null}
    </AnimatePresence>
  );
}

export type TakeoverBrowserProps = {
  /** The page's address. */
  url: string;
  /** The task's id, for the page's accessible name. */
  task: string;
  /** Ankur is driving: a ring marks the page. */
  driving: boolean;
  onBack: () => void;
  onReload: () => void;
  /** The page itself: the live picture, which sizes itself to the largest 16:9 the region allows. */
  children: ReactNode;
};

/** The browser modal's body: the address bar with Back and Reload, and the page in a region the picture is centred in. */
export function TakeoverBrowser({ url, task, driving, onBack, onReload, children }: TakeoverBrowserProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 flex-none items-center gap-2 border-b border-rule bg-[var(--chrome)] px-3">
        <IconButton icon="back" label="Back" size={32} onClick={onBack} />
        <IconButton icon="retry" label="Reload" size={32} onClick={onReload} />
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-rule bg-[var(--paper)] px-3 text-[13px] text-ink-muted">
          <Icon name="lock" size={12} />
          <Truncate text={url} className="min-w-0 flex-1 text-[13px]" />
        </div>
      </div>
      <div role="application" aria-label={`Browser page for ${shortId(task)}`} className={`relative min-h-0 flex-1 [container-type:size] bg-[#ece9e1] ${driving ? "cursor-default" : "cursor-pointer"}`}>
        {children}
      </div>
      <DrivingRing driving={driving} />
    </div>
  );
}

export type TakeoverTerminalProps = {
  /** The directory the helper is in. */
  cwd: string;
  driving: boolean;
  /** The command being typed. */
  command: string;
  onCommand: (command: string) => void;
  /** Ankur pressed Enter on the command. */
  onSubmit: () => void;
  /** The pane's output: the task's full view. */
  children: ReactNode;
};

/** The terminal modal's body: the pane's output, which scrolls, and a command line under it. */
export function TakeoverTerminal({ cwd, driving, command, onCommand, onSubmit, children }: TakeoverTerminalProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[#23271f] text-[#dfe6d6]">
      {children}
      <div className="flex h-[46px] flex-none items-center gap-2 border-t border-[#3a4033] bg-[#1b1e18] px-4 font-numeric text-[13px] text-[#dfe6d6]">
        <span data-selectable className="flex-none text-[#a9b3a0]">
          {cwd}
        </span>
        <span className="flex-none text-[#9fc08a]">$</span>
        <input
          aria-label="Command"
          autoComplete="off"
          spellCheck={false}
          value={command}
          onChange={(e) => onCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSubmit();
            }
          }}
          className="h-[34px] min-w-0 flex-1 border-0 bg-transparent font-numeric text-[13px] text-[#dfe6d6] outline-0"
        />
      </div>
      <DrivingRing driving={driving} />
    </div>
  );
}

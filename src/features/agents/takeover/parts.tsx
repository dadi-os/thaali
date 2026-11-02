import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Badge } from "../../../shared/components/Badge";
import { Button } from "../../../shared/components/Button";
import { IconButton } from "../../../shared/components/Button";
import { Icon } from "../../../shared/components/Icon";
import { Clamp, NameTruncate, Truncate } from "../../../shared/components/Truncate";
import type { TaskStatus } from "../../../types/hath";

/** The dark ground of a terminal: its output, its command line and the marks on them. */
const TERMINAL = { ground: "#23271f", bar: "#1b1e18", ink: "#dfe6d6", dim: "#a9b3a0", rule: "#3a4033", prompt: "#9fc08a" } as const;

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
  return <span style={{ fontFamily: "var(--font-numeric)", fontSize: 11, padding: "1px 5px", borderRadius: 5, border: "1px solid var(--sage-line)", color: "var(--ink-muted)" }}>{children}</span>;
}

export type TakeoverHeaderProps = {
  task: TakeoverTask;
  /** Ankur is driving: the helper is paused and the header says so, with Hand back in place of Close. */
  driving: boolean;
  onClose: () => void;
};

/** The modal's 60 px header: the task's kind, id, owner and purpose, then its status, or, while Ankur drives, the mark that he is and the way to hand it back. */
export function TakeoverHeader({ task, driving, onClose }: TakeoverHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 60, padding: "0 12px 0 16px", borderBottom: "1px solid var(--rule)", flex: "none" }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--sage-fill)", color: "var(--sage-text)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={task.kind === "browser" ? "browser" : "terminal"} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Truncate text={shortId(task.task)} className="ui-mono" style={{ fontSize: 13, color: "var(--ink)", flex: "none" }} />
          <NameTruncate name={task.owner} style={{ fontSize: 13, color: "var(--ink-muted)", flex: 1, minWidth: 0 }} />
        </div>
        <Clamp text={task.purpose} lines={1} style={{ fontSize: 12.5, color: "var(--ink-muted)" }} />
      </div>
      {driving ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 12px", borderRadius: 999, background: "var(--sage-deep)", color: "var(--bone)", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", flex: "none" }}>
          <span className="dot" style={{ width: 6, height: 6, background: "var(--bone)" }} />
          You are driving
        </span>
      ) : (
        <Badge status={task.status} />
      )}
      {driving ? (
        <Button tone="fill" onClick={onClose}>
          Hand back
        </Button>
      ) : null}
      <IconButton icon="close" label="Close" size={36} onClick={driving ? undefined : onClose} style={driving ? { display: "none" } : undefined} />
    </div>
  );
}

/** The strip under the header while Ankur drives: the helper is paused and waits for its agent to be handed back. */
export function TakeoverBanner({ owner }: { owner: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40, padding: "0 16px", background: "var(--due-fill)", color: "var(--due-ink)", borderBottom: "1px solid var(--due-line)", fontSize: 13, fontWeight: 500, flex: "none", animation: "drop-in 260ms var(--ease) both" }}>
      <Icon name="pause" size={14} />
      <span style={{ whiteSpace: "nowrap" }}>Paused while you drive</span>
      <Truncate text={`${owner}’s helper waits`} style={{ flex: 1, minWidth: 0, fontWeight: 400 }} />
    </div>
  );
}

export type TakeoverFooterProps = {
  kind: "browser" | "terminal";
  resource: string;
  driving: boolean;
};

/** The modal's 44 px footer: the shortcut that leaves, and where the task runs. */
export function TakeoverFooter({ kind, resource, driving }: TakeoverFooterProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, height: 44, padding: "0 16px", borderTop: "1px solid var(--rule)", flex: "none", fontSize: 12.5, color: "var(--ink-muted)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Kbd>{driving ? "⌘ ." : "Esc"}</Kbd>
        {driving ? "Hand back" : "Close"}
      </div>
      <div style={{ flex: 1 }} />
      <Truncate text={kind === "browser" ? `slot ${resource}` : `tmux ${resource}`} className="ui-mono" />
    </div>
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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 12px", background: "#f1f2ee", borderBottom: "1px solid var(--rule)", flex: "none" }}>
        <IconButton icon="back" label="Back" size={32} onClick={onBack} />
        <IconButton icon="retry" label="Reload" size={32} onClick={onReload} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 12px", borderRadius: 16, background: "#fff", border: "1px solid var(--rule)", fontSize: 13, color: "var(--ink-muted)" }}>
          <Icon name="lock" size={12} />
          <Truncate text={url} style={{ flex: 1, minWidth: 0, fontSize: 13 }} />
        </div>
      </div>
      <div role="application" aria-label={`Browser page for ${shortId(task)}`} style={{ flex: 1, minHeight: 0, position: "relative", containerType: "size", background: "#ece9e1", cursor: driving ? "default" : "pointer" }}>
        {children}
      </div>
      {driving ? <DrivingRing /> : null}
    </div>
  );
}

/** The ring that marks the page or the pane Ankur is driving; it lives inside the modal and nowhere else. */
function DrivingRing() {
  return <span style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 0 2px var(--sage-deep)", pointerEvents: "none", zIndex: 3, animation: "scrim-in 220ms var(--ease) both" }} />;
}

export type TakeoverTerminalProps = {
  /** The pane's text, newest line last. */
  output: string;
  /** The directory the helper is in. */
  cwd: string;
  driving: boolean;
  /** The command being typed. */
  command: string;
  onCommand: (command: string) => void;
  /** Ankur pressed Enter on the command. */
  onSubmit: () => void;
};

/** The terminal modal's body: the pane's output, which scrolls, and a command line under it. */
export function TakeoverTerminal({ output, cwd, driving, command, onCommand, onSubmit }: TakeoverTerminalProps) {
  const paneRef = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (pane) {
      pane.scrollTop = pane.scrollHeight;
    }
  }, [output]);
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, background: TERMINAL.ground, color: TERMINAL.ink, position: "relative" }}>
      <pre ref={paneRef} className="scroll" style={{ margin: 0, flex: 1, minHeight: 0, padding: "14px 16px", fontFamily: "var(--font-numeric)", fontSize: 12.5, lineHeight: "18px", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {output}
      </pre>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 16px", borderTop: `1px solid ${TERMINAL.rule}`, background: TERMINAL.bar, fontFamily: "var(--font-numeric)", fontSize: 13, color: TERMINAL.ink, flex: "none" }}>
          <span style={{ color: TERMINAL.dim, flex: "none" }}>{cwd}</span>
          <span style={{ color: TERMINAL.prompt, flex: "none" }}>$</span>
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
            style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", color: TERMINAL.ink, fontFamily: "var(--font-numeric)", fontSize: 13, height: 34 }}
          />
        </div>
      </div>
      {driving ? <DrivingRing /> : null}
    </div>
  );
}

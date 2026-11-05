import { useLayoutEffect, useRef } from "react";
import { BrowserFrame } from "../../../features/agents/BrowserFrame";
import { useTerminalCapture } from "../../../features/agents/terminalCapture";
import { setTakeover } from "../../../store/takeover";
import { TaskPreview } from "./TaskPreview";

/** Lines of a terminal's pane each variant reads: the previews read a few more than they show so the newest line is always at the bottom. */
const LINES = { compact: 12, tall: 12, full: 400 } as const;
/** The screen's height per variant and kind; the full variant fills its parent. */
const HEIGHT = {
  compact: { browser: "h-[150px]", terminal: "h-[132px]" },
  tall: { browser: "h-[330px]", terminal: "h-[288px]" },
} as const;

/** How a task is drawn: `compact` in the chat rail and the agent sheet, `tall` where the page has the width (the System page), `full` as the takeover's driven screen. */
export type TaskViewVariant = keyof typeof LINES;

export type TaskViewProps = {
  /** The task's address, such as `task/browser/3f2a91`. */
  task: string;
  kind: "browser" | "terminal";
  /** What the task holds in Nas: a browser slot or a terminal id. */
  resource: string;
  /** The page a browser is on, or the id and slot of a terminal; shown in the preview's bar. */
  caption: string;
  variant: TaskViewVariant;
  /** The owner is driving it. */
  paused?: boolean;
  /** Called each time Ankur acts on the full browser screen, which is when Nas pauses the helper. */
  onDrive?: () => void;
};

/** The tail of a terminal's pane, pinned to the newest line; a failed capture shows Nas's message in place of the output. */
function TerminalOutput({ terminalId, variant }: { terminalId: string; variant: TaskViewVariant }) {
  const { capture, live } = useTerminalCapture(terminalId, LINES[variant]);
  const paneRef = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (pane) {
      pane.scrollTop = pane.scrollHeight;
    }
  }, [capture.data]);
  const text = capture.isError ? capture.error.message : (capture.data ?? (live ? "Attaching…" : "Paused while hidden"));
  if (variant === "full") {
    return (
      <pre ref={paneRef} data-selectable className="scroll m-0 min-h-0 flex-1 overflow-auto bg-[#23271f] px-4 py-3.5 font-numeric text-[12.5px] leading-[18px] break-words whitespace-pre-wrap text-[#dfe6d6]">
        {text}
      </pre>
    );
  }
  return (
    <pre data-selectable className={`m-0 flex flex-col justify-end overflow-hidden px-3 py-2.5 font-numeric text-[11.5px] leading-[17px] break-words whitespace-pre-wrap ${HEIGHT[variant].terminal}`}>
      <div>{text}</div>
    </pre>
  );
}

/**
 * The one drawing of a helper task's live screen, its browser's picture or its terminal's tail. `compact` and `tall` are the
 * preview frame whose click opens the takeover (chat rail, agent sheet, System page); `full` is the screen the takeover itself drives.
 */
export function TaskView({ task, kind, resource, caption, variant, paused = false, onDrive }: TaskViewProps) {
  if (variant === "full") {
    return kind === "browser" ? <BrowserFrame browserId={Number(resource)} variant="page" onDrive={onDrive} /> : <TerminalOutput terminalId={resource} variant="full" />;
  }
  const shortId = task.replace(/^task\//, "");
  return (
    <TaskPreview kind={kind} caption={caption} label={`Open ${kind} task ${shortId}`} paused={paused} onOpen={() => setTakeover(task)}>
      {kind === "browser" ? (
        <div className={`relative ${HEIGHT[variant].browser}`}>
          <BrowserFrame browserId={Number(resource)} variant="fill" />
        </div>
      ) : (
        <TerminalOutput terminalId={resource} variant={variant} />
      )}
    </TaskPreview>
  );
}

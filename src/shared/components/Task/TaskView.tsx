import { BrowserFrame } from "../../../features/agents/BrowserFrame";
import { useTerminalCapture } from "../../../features/agents/terminalCapture";
import { setTakeover } from "../../../contexts/takeover";
import { TaskPreview } from "./TaskPreview";

/** Lines of a terminal's pane a preview reads: a few more than it shows so the newest line is always at the bottom. */
const LINES = 12;

export type TaskViewProps = {
  /** The task's address, such as `task/browser/3f2a91`. */
  task: string;
  kind: "browser" | "terminal";
  /** What the task holds in Nas: a browser slot or a terminal id. */
  resource: string;
  /** The address of the page in front in a browser, or the id and slot of a terminal; shown in the preview's bar. */
  caption: string;
};

/** The tail of a terminal's pane, pinned to the newest line; a failed capture shows Nas's message in place of the output. */
function TerminalOutput({ terminalId }: { terminalId: string }) {
  const { capture, live } = useTerminalCapture(terminalId, LINES);
  const text = capture.isError ? capture.error.message : (capture.data ?? (live ? "Attaching…" : "Paused while hidden"));
  return (
    <pre data-selectable className="m-0 flex h-full flex-col justify-end overflow-hidden px-3 py-2.5 font-numeric text-[12px] leading-[17px] break-words whitespace-pre-wrap">
      <div>{text}</div>
    </pre>
  );
}

/**
 * A helper task's live screen as a preview: its browser's picture or its terminal's tail, in a frame whose click opens
 * the takeover (chat rail, agent sheet).
 */
export function TaskView({ task, kind, resource, caption }: TaskViewProps) {
  const shortId = task.replace(/^task\//, "");
  return (
    <TaskPreview kind={kind} caption={caption} label={`Open ${kind} task ${shortId}`} onOpen={() => setTakeover(task)}>
      {kind === "browser" ? (
        <div className="relative h-full">
          <BrowserFrame browserId={Number(resource)} variant="fill" />
        </div>
      ) : (
        <TerminalOutput terminalId={resource} />
      )}
    </TaskPreview>
  );
}

import { TaskPreview } from "../../shared/components/TaskPreview";
import { setTakeover } from "../../store/takeover";
import { BrowserFrame } from "./BrowserFrame";
import { useTerminalCapture } from "./terminalCapture";

/** Lines of a terminal's pane the preview reads: more than its 132 px shows, so the newest line is always at the bottom. */
const PREVIEW_LINES = 12;

export type TaskPreviewLiveProps = {
  /** The task's address, such as `task/browser/3f2a91`. */
  task: string;
  kind: "browser" | "terminal";
  /** What the task holds in Nas: a browser slot or a terminal id. */
  resource: string;
  /** The page a browser is on, or the id of a terminal. */
  caption: string;
  /** The owner is driving it. */
  paused: boolean;
};

/** The tail of a terminal's pane as the preview shows it, pinned to the newest line. */
function TerminalTail({ terminalId }: { terminalId: string }) {
  const { capture } = useTerminalCapture(terminalId, PREVIEW_LINES);
  return (
    <pre
      style={{
        margin: 0,
        padding: "10px 12px",
        fontFamily: "var(--font-numeric)",
        fontSize: 11.5,
        lineHeight: "17px",
        height: 132,
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      {capture.isError ? <div>{capture.error.message}</div> : <div>{capture.data ?? ""}</div>}
    </pre>
  );
}

/** A helper task's live screen as a preview: its browser's picture or its terminal's tail, which a click opens in the takeover modal. */
export function TaskPreviewLive({ task, kind, resource, caption, paused }: TaskPreviewLiveProps) {
  const shortId = task.replace(/^task\//, "");
  return (
    <TaskPreview kind={kind} caption={caption} label={`Open ${kind} task ${shortId}`} paused={paused} onOpen={() => setTakeover(task)}>
      {kind === "browser" ? (
        <div style={{ position: "relative", height: 150 }}>
          <BrowserFrame browserId={Number(resource)} variant="fill" />
        </div>
      ) : (
        <TerminalTail terminalId={resource} />
      )}
    </TaskPreview>
  );
}

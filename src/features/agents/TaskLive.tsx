import { TaskPreview } from "../../shared/components/Task/TaskPreview";
import { setTakeover } from "../../store/takeover";
import { BrowserFrame } from "./BrowserFrame";
import { useTerminalCapture } from "./terminalCapture";

/** Lines of a terminal's pane the preview reads: more than its 132 px shows, so the newest line is always at the bottom. */
const PREVIEW_LINES = 12;
/** The heights of a preview: the agent sheet's, and the taller one the System page gives it. */
const HEIGHT = { browser: { default: 150, tall: 330 }, terminal: { default: 132, tall: 288 } } as const;

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
  /** The taller preview of the System page, where a task has the width to show more. */
  tall?: boolean;
};

/** The tail of a terminal's pane as the preview shows it, pinned to the newest line. */
function TerminalTail({ terminalId, height }: { terminalId: string; height: number }) {
  const { capture } = useTerminalCapture(terminalId, PREVIEW_LINES);
  return (
    <pre
      style={{
        margin: 0,
        padding: "10px 12px",
        fontFamily: "var(--font-numeric)",
        fontSize: 11.5,
        lineHeight: "17px",
        height,
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
export function TaskPreviewLive({ task, kind, resource, caption, paused, tall = false }: TaskPreviewLiveProps) {
  const shortId = task.replace(/^task\//, "");
  const height = HEIGHT[kind][tall ? "tall" : "default"];
  return (
    <TaskPreview kind={kind} caption={caption} label={`Open ${kind} task ${shortId}`} paused={paused} onOpen={() => setTakeover(task)}>
      {kind === "browser" ? (
        <div style={{ position: "relative", height }}>
          <BrowserFrame browserId={Number(resource)} variant="fill" />
        </div>
      ) : (
        <TerminalTail terminalId={resource} height={height} />
      )}
    </TaskPreview>
  );
}

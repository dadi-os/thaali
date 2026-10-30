import type { TaskStatus } from "../../types/hath";
import { BrowserFrame } from "./BrowserFrame";
import type { TaskLiveView } from "./sessions";
import { TerminalScreen } from "./TerminalScreen";

export type TaskLiveProps = {
  /** What the task holds in Nas, or null while it sleeps. */
  view: TaskLiveView | null;
  /** The helper's state summary, shown in place of a live view. */
  summary: string;
  /** The expanded view: a driveable browser and a long terminal, for the System page. */
  tall?: boolean;
};

/** A task's live browser or terminal screen, or its state summary while it holds none. */
export function TaskLive({ view, summary, tall = false }: TaskLiveProps) {
  if (view?.kind === "browser") {
    return (
      <div className="overflow-hidden rounded-[12px] border border-sage-line/70">
        <BrowserFrame browserId={view.browserId} variant={tall ? "full" : "detail"} />
      </div>
    );
  }
  if (view?.kind === "terminal") {
    return (
      <div className="overflow-hidden rounded-[12px] border border-sage-line/70">
        <TerminalScreen terminalId={view.terminalId} variant={tall ? "full" : "rail"} className={tall ? "h-72" : ""} />
      </div>
    );
  }
  return <p className="text-[12.5px] leading-relaxed text-ink-muted">{summary}</p>;
}

/** A task's state word, sage while it works or asks. */
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const lit = status === "working" || status === "asking";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-[2px] text-[11px] font-semibold ${
        lit ? "bg-sage-fill text-sage-text" : "border border-dashed border-sage-line text-ink-ghost"
      }`}
    >
      {status}
    </span>
  );
}

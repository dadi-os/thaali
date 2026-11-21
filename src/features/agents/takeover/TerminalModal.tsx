import { useCallback } from "react";
import { type TerminalActivity, createTerminalActivity } from "./activity";
import { TakeoverTerminal } from "./parts";
import { TaskFrame, type TaskModalProps, useTakeover } from "./TaskFrame";
import { TerminalPane } from "./TerminalPane";

/** The terminal's modal: its output pane, which Ankur types into directly once he takes over. */
export function TerminalModal(props: TaskModalProps) {
  const { task, resource } = props;
  const { control, state, requestClose } = useTakeover(task, createTerminalActivity);
  const controlling = state === "in-control";
  const onActivity = useCallback((activity: TerminalActivity) => void control.record(activity), [control]);
  return (
    <TaskFrame {...props} state={state} onTakeover={() => void control.takeOver()} onReturn={() => void control.handBack()} onClose={requestClose}>
      <TakeoverTerminal controlling={controlling}>
        <TerminalPane terminalId={resource} controlling={controlling} onActivity={onActivity} />
      </TakeoverTerminal>
    </TaskFrame>
  );
}

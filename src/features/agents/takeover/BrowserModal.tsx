import { useCallback } from "react";
import { nas } from "../../../shared/api";
import { BrowserFrame } from "../BrowserFrame";
import { pageAddress } from "../sessions";
import { type BrowserActivity, createBrowserActivity } from "./activity";
import { TakeoverBrowser } from "./parts";
import { failed, TaskFrame, type TaskModalProps, useTakeover } from "./TaskFrame";

/** The browser's modal: its live page, read-only until Ankur takes over, then driven with the pointer, the wheel and the keys. */
export function BrowserModal(props: TaskModalProps) {
  const { task, resource } = props;
  const { control, state, requestClose } = useTakeover(task, createBrowserActivity);
  const controlling = state === "in-control";
  const onActivity = useCallback((activity: BrowserActivity) => void control.record(activity), [control]);
  const navigate = async (action: "back" | "reload") => {
    control.record({ type: "key", name: action === "back" ? "Back" : "Reload" });
    try {
      await nas.navigateBrowser(Number(resource), action);
    } catch (err) {
      failed("The browser did not navigate", err);
    }
  };
  return (
    <TaskFrame {...props} state={state} onTakeover={() => void control.takeOver()} onReturn={() => void control.handBack()} onClose={requestClose}>
      <TakeoverBrowser url={pageAddress(task.active_url)} task={task.task} controlling={controlling} onBack={() => void navigate("back")} onReload={() => void navigate("reload")}>
        <BrowserFrame browserId={Number(resource)} variant="page" interactive={controlling} onActivity={onActivity} />
      </TakeoverBrowser>
    </TaskFrame>
  );
}

import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hath, nas } from "../../../shared/api";
import type { NasTask } from "../../../shared/api/nas";
import { AGENTS_QUERY_KEY } from "../../../shared/hooks/useEvents";
import { AnchoredMenu } from "../../../shared/overlay/AnchoredMenu";
import { ConfirmDialog } from "../../../shared/overlay/ConfirmDialog";
import { Modal } from "../../../shared/overlay/Modal";
import type { ActionList } from "../../../shared/interaction/actions";
import { useShortcut } from "../../../shared/interaction/shortcuts";
import { pushToast } from "../../../contexts/toasts";
import { setTakeover } from "../../../contexts/takeover";
import { type Activity } from "./activity";
import { createControl, type ControlState } from "./control";
import { STOP_DETAIL, taskMenu } from "./menu";
import { TakeoverFooter, TakeoverHeader } from "./parts";

/** Why a takeover call failed, as a toast Ankur can read. */
export function failed(title: string, err: unknown): void {
  pushToast({ key: `takeover:${title}`, tone: "error", title, body: err instanceof Error ? err.message : String(err) });
}

/** What a task's modal is given: the Nas task and whether it is showing. */
export type TaskModalProps = {
  task: NasTask;
  /** What the task holds in Nas: a browser slot or a terminal id. */
  resource: string;
  /** False while the modal plays its exit animation. */
  open: boolean;
};

export const leave = () => setTakeover(null);

/**
 * One takeover's control: watching until Takeover pauses the task in Nas, then in control until it is resumed with the
 * summary `activity` writes. `requestClose` leaves at once while watching and after the hand back while in control.
 */
export function useTakeover<E>(task: NasTask, makeActivity: () => Activity<E>) {
  const queryClient = useQueryClient();
  const [control] = useState(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["nas", "tasks"] });
    return createControl<E>({
      pause: async () => {
        await nas.pauseTask(task);
        await refresh();
      },
      resume: async (summary) => {
        await nas.resumeTask(task, summary);
        await refresh();
      },
      activity: makeActivity(),
      onError: failed,
    });
  });
  useEffect(() => () => control.dispose(), [control]);
  const state = useSyncExternalStore(control.subscribe, control.getState);
  const requestClose = () => {
    if (state === "watching") {
      leave();
    } else if (state === "in-control") {
      void control.handBack().then((handedBack) => handedBack && leave());
    }
  };
  return { control, state, requestClose };
}

type TaskFrameProps = TaskModalProps & {
  state: ControlState;
  onTakeover: () => void;
  onReturn: () => void;
  onClose: () => void;
  /** The body between the header and the footer. */
  children: ReactNode;
};

/** The frame both task modals share: a {@link Modal} holding the header, the body, the footer, the overflow menu and the confirmation before Stop. */
export function TaskFrame({ task, resource, open, state, onTakeover, onReturn, onClose, children }: TaskFrameProps) {
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);

  useShortcut("mod+.", () => {
    if (open && state === "in-control") {
      onReturn();
    }
  });

  const stop = async () => {
    setStopping(true);
    setStopError(null);
    try {
      await hath.haltSession(task.owner, task.task);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["nas", "tasks"] }),
        queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["agent", task.owner] }),
      ]);
      setConfirmingStop(false);
      leave();
    } catch (err) {
      setStopError(err instanceof Error ? err.message : String(err));
    } finally {
      setStopping(false);
    }
  };
  const refreshTasks = () => queryClient.invalidateQueries({ queryKey: ["nas", "tasks"] });
  const actions: ActionList = taskMenu({
    status: task.status,
    state,
    onPause: async () => {
      await nas.pauseTask(task);
      await refreshTasks();
    },
    onResume: async () => {
      await nas.resumeTask(task);
      await refreshTasks();
    },
    onStop: () => setConfirmingStop(true),
  });
  const info = { task: task.task, kind: task.kind, owner: task.owner, purpose: task.purpose, status: task.status, resource };
  return (
    <Modal open={open} onClose={onClose} label={`${task.kind === "browser" ? "Browser" : "Terminal"} ${task.id}`}>
      <TakeoverHeader task={info} state={state} onTakeover={onTakeover} onReturn={onReturn} onMenu={setMenu} onClose={onClose} />
      {children}
      <TakeoverFooter kind={task.kind} resource={resource} state={state} />
      <AnchoredMenu actions={actions} anchor={menu} onClose={() => setMenu(null)} width={180} />
      <ConfirmDialog
        open={open && confirmingStop}
        title="Stop this task?"
        detail={STOP_DETAIL}
        confirmLabel="Stop task"
        icon="power"
        pending={stopping}
        error={stopError}
        onCancel={() => setConfirmingStop(false)}
        onConfirm={() => void stop()}
      />
    </Modal>
  );
}


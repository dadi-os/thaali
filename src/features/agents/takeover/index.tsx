import { type ReactNode, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isMeshOnline, nas } from "../../../shared/api";
import type { NasTask } from "../../../shared/api/nas";
import { useRetained } from "../../../shared/hooks/useRetained";
import { useConnection } from "../../../shared/hooks/useConnection";
import { AnchoredMenu } from "../../../shared/overlay/AnchoredMenu";
import { ConfirmDialog } from "../../../shared/overlay/ConfirmDialog";
import { LargeDialog } from "../../../shared/overlay/LargeDialog";
import type { ActionList } from "../../../shared/interaction/actions";
import { useShortcut } from "../../../shared/interaction/shortcuts";
import { pushToast } from "../../../contexts/toasts";
import { getTakeover, setTakeover, subscribeTakeover } from "../../../contexts/takeover";
import { BrowserFrame } from "../BrowserFrame";
import { pageAddress, tasksRefetchInterval } from "../sessions";
import { type Activity, type BrowserActivity, createBrowserActivity, createTerminalActivity, type TerminalActivity } from "./activity";
import { createControl, type ControlState } from "./control";
import { TakeoverBrowser, TakeoverFooter, TakeoverHeader, TakeoverTerminal } from "./parts";
import { TerminalPane } from "./TerminalPane";

/** Why a takeover call failed, as a toast Ankur can read. */
function failed(title: string, err: unknown): void {
  pushToast({ key: `takeover:${title}`, tone: "error", title, body: err instanceof Error ? err.message : String(err) });
}

/**
 * The takeover modal: a near-window panel over the app frame, opened by a helper task's preview or its row on the System page.
 * It opens watching, with the helper still working and the screen read-only; Takeover pauses the helper and lets Ankur use the
 * browser or type into the terminal, and Return, closing the modal or half an hour without input hands it back with a summary of what he did.
 */
export function TakeoverModal() {
  const address = useSyncExternalStore(subscribeTakeover, getTakeover);
  const { state: connection } = useConnection();
  const tasks = useQuery({
    queryKey: ["nas", "tasks"],
    queryFn: () => nas.listTasks(),
    enabled: isMeshOnline(connection),
    refetchInterval: (query) => tasksRefetchInterval(query.state.data),
  });
  const found = address === null ? undefined : tasks.data?.find((candidate) => candidate.task === address);
  const live = found !== undefined && found.resource !== undefined ? found : null;
  const shown = useRetained(live);
  const wasOpen = useRef(false);
  const session = useRef(0);
  if (live !== null && !wasOpen.current) {
    session.current += 1;
  }
  wasOpen.current = live !== null;
  if (shown === null || shown.resource === undefined) {
    return null;
  }
  const props = { task: shown, resource: shown.resource, open: live !== null };
  const key = `${shown.task}:${session.current}`;
  return shown.kind === "browser" ? <BrowserTakeover key={key} {...props} /> : <TerminalTakeover key={key} {...props} />;
}

type OpenTakeoverProps = {
  task: NasTask;
  /** What the task holds in Nas: a browser slot or a terminal id. */
  resource: string;
  /** False while the modal plays its exit animation. */
  open: boolean;
};

const leave = () => setTakeover(null);

/**
 * One takeover's control: watching until Takeover pauses the task in Nas, then in control until it is resumed with the
 * summary `activity` writes. `requestClose` leaves at once while watching and after the hand back while in control.
 */
function useTakeover<E>(task: NasTask, makeActivity: () => Activity<E>) {
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

type TakeoverShellProps = OpenTakeoverProps & {
  state: ControlState;
  onTakeover: () => void;
  onReturn: () => void;
  onClose: () => void;
  /** The body between the header and the footer. */
  children: ReactNode;
};

/** The modal's frame, shared by both kinds: header, the body, footer, the overflow menu and the confirmation before Stop. */
function TakeoverShell({ task, resource, open, state, onTakeover, onReturn, onClose, children }: TakeoverShellProps) {
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
      await nas.pauseTask(task);
      await nas.stopTask(task);
      await queryClient.invalidateQueries({ queryKey: ["nas", "tasks"] });
      setConfirmingStop(false);
      leave();
    } catch (err) {
      setStopError(err instanceof Error ? err.message : String(err));
    } finally {
      setStopping(false);
    }
  };
  const actions: ActionList = [{ id: "task.stop", label: "Stop task", icon: "power", destructive: true, run: () => setConfirmingStop(true) }];
  const info = { task: task.task, kind: task.kind, owner: task.owner, purpose: task.purpose, status: task.status, resource };
  return (
    <LargeDialog open={open} onClose={onClose} label={`${task.kind === "browser" ? "Browser" : "Terminal"} ${task.id}`}>
      <TakeoverHeader task={info} state={state} onTakeover={onTakeover} onReturn={onReturn} onMenu={setMenu} onClose={onClose} />
      {children}
      <TakeoverFooter kind={task.kind} resource={resource} state={state} />
      <AnchoredMenu actions={actions} anchor={menu} onClose={() => setMenu(null)} width={180} />
      <ConfirmDialog
        open={open && confirmingStop}
        title="Stop this task?"
        detail={`It goes to sleep and ${task.owner} is told it was stopped.`}
        confirmLabel="Stop task"
        icon="power"
        pending={stopping}
        error={stopError}
        onCancel={() => setConfirmingStop(false)}
        onConfirm={() => void stop()}
      />
    </LargeDialog>
  );
}

/** The browser's takeover: its live page, read-only until Ankur takes over, then driven with the pointer, the wheel and the keys. */
function BrowserTakeover(props: OpenTakeoverProps) {
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
    <TakeoverShell {...props} state={state} onTakeover={() => void control.takeOver()} onReturn={() => void control.handBack()} onClose={requestClose}>
      <TakeoverBrowser url={pageAddress(task.active_url)} task={task.task} controlling={controlling} onBack={() => void navigate("back")} onReload={() => void navigate("reload")}>
        <BrowserFrame browserId={Number(resource)} variant="page" interactive={controlling} onActivity={onActivity} />
      </TakeoverBrowser>
    </TakeoverShell>
  );
}

/** The terminal's takeover: its output pane, which Ankur types into directly once he takes over. */
function TerminalTakeover(props: OpenTakeoverProps) {
  const { task, resource } = props;
  const { control, state, requestClose } = useTakeover(task, createTerminalActivity);
  const controlling = state === "in-control";
  const onActivity = useCallback((activity: TerminalActivity) => void control.record(activity), [control]);
  return (
    <TakeoverShell {...props} state={state} onTakeover={() => void control.takeOver()} onReturn={() => void control.handBack()} onClose={requestClose}>
      <TakeoverTerminal controlling={controlling}>
        <TerminalPane terminalId={resource} controlling={controlling} onActivity={onActivity} />
      </TakeoverTerminal>
    </TakeoverShell>
  );
}

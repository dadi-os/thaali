import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../../shared/api";
import type { NasTask } from "../../../shared/api/nas";
import { AGENTS_QUERY_KEY } from "../../../shared/hooks/useEvents";
import { useRetained } from "../../../shared/hooks/useRetained";
import { TaskView } from "../../../shared/components/Task/TaskView";
import { Button } from "../../../shared/ui/Button";
import { Dialog } from "../../../shared/overlay/Dialog";
import { LargeDialog } from "../../../shared/overlay/LargeDialog";
import { DialogOption } from "../../../shared/overlay/Overlay";
import { useConnection } from "../../../shared/hooks/useConnection";
import { pushToast } from "../../../store/toasts";
import { getTakeover, setTakeover, subscribeTakeover } from "../../../store/takeover";
import { TakeoverBanner, TakeoverBrowser, TakeoverFooter, TakeoverHeader, TakeoverTerminal } from "./parts";

/** Why a takeover call failed, as a toast Ankur can read. */
function failed(title: string, err: unknown): void {
  pushToast({ key: `takeover:${title}`, tone: "error", title, body: err instanceof Error ? err.message : String(err) });
}

/**
 * The takeover modal: a near-window panel over the app frame, opened by a helper task's preview, where Ankur acts at once, with
 * the pointer and keys in the browser or a command line in the terminal. Nas pauses the helper at his first input, so the modal
 * shows him driving from then; closing after driving asks how to hand the task back (resume, resume with a note, or stop).
 */
export function TakeoverModal() {
  const address = useSyncExternalStore(subscribeTakeover, getTakeover);
  const { state: connection } = useConnection();
  const tasks = useQuery({ queryKey: ["nas", "tasks"], queryFn: () => nas.listTasks(), enabled: isMeshOnline(connection) });
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
  return <OpenTakeover key={`${shown.task}:${session.current}`} task={shown} resource={shown.resource} open={live !== null} />;
}

type OpenTakeoverProps = {
  task: NasTask;
  /** What the task holds in Nas: a browser slot or a terminal id. */
  resource: string;
  /** False while the modal plays its exit animation. */
  open: boolean;
};

/** One takeover: its header, body and footer, the hand-back dialog, and the state they share. */
function OpenTakeover({ task, resource, open }: OpenTakeoverProps) {
  const queryClient = useQueryClient();
  const agents = useQuery({ queryKey: AGENTS_QUERY_KEY, queryFn: async () => (await hath.listAgents()).agents });
  const [driven, setDriven] = useState(false);
  const [handingBack, setHandingBack] = useState(false);
  const [writingNote, setWritingNote] = useState(false);
  const [note, setNote] = useState("");
  const [command, setCommand] = useState("");
  const driving = driven || task.status === "paused";
  const current = agents.data?.find((agent) => agent.id === task.owner)?.sessions.tasks.find((row) => row.id === task.task)?.current ?? "";

  const leave = () => setTakeover(null);
  const requestClose = () => {
    if (driving) {
      setHandingBack(true);
    } else {
      leave();
    }
  };
  const keepDriving = () => {
    setHandingBack(false);
    setWritingNote(false);
  };
  const settle = async (call: () => Promise<unknown>, title: string) => {
    try {
      await call();
      await queryClient.invalidateQueries({ queryKey: ["nas", "tasks"] });
      leave();
    } catch (err) {
      failed(title, err);
    }
  };
  const send = async (keys: string[], literal: boolean) => {
    setDriven(true);
    try {
      await nas.terminalKeys(resource, keys, literal);
    } catch (err) {
      failed("The terminal did not take the keys", err);
    }
  };
  const navigate = async (action: "back" | "reload") => {
    setDriven(true);
    try {
      await nas.navigateBrowser(Number(resource), action);
    } catch (err) {
      failed("The browser did not navigate", err);
    }
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (open && driving && !handingBack && (e.metaKey || e.ctrlKey) && e.key === ".") {
      e.preventDefault();
      e.stopPropagation();
      setHandingBack(true);
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const info = { task: task.task, kind: task.kind, owner: task.owner, purpose: task.purpose, status: task.status, resource };
  const caption = task.kind === "browser" ? current : `${task.id} · ${resource}`;
  return (
    <LargeDialog open={open} onClose={leave} label={`${task.kind === "browser" ? "Browser" : "Terminal"} ${task.id}`} locked={driving}>
      <TakeoverHeader task={info} driving={driving} onClose={requestClose} />
      <TakeoverBanner owner={task.owner} driving={driving} />
      {task.kind === "browser" ? (
        <TakeoverBrowser url={current} task={task.task} driving={driving} onBack={() => void navigate("back")} onReload={() => void navigate("reload")}>
          <TaskView task={task.task} kind="browser" resource={resource} caption={caption} variant="full" onDrive={() => setDriven(true)} />
        </TakeoverBrowser>
      ) : (
        <TakeoverTerminal
          cwd={current.split(" · ")[0]!}
          driving={driving}
          command={command}
          onCommand={setCommand}
          onSubmit={() => {
            const typed = command;
            setCommand("");
            void send([typed], true).then(() => send(["Enter"], false));
          }}
        >
          <TaskView task={task.task} kind="terminal" resource={resource} caption={caption} variant="full" />
        </TakeoverTerminal>
      )}
      <TakeoverFooter kind={task.kind} resource={resource} driving={driving} />
      <Dialog
        open={open && handingBack}
        onClose={keepDriving}
        title="Hand it back?"
        subtitle={`${task.owner}’s helper is paused${current ? ` on ${current}` : ""}.`}
        footer={
          <>
            <span className="min-w-0 flex-1 text-[12px] leading-4 text-ink-muted">Either way the helper first sees the page and its own last step, not your keystrokes.</span>
            <Button tone="quiet" onClick={keepDriving}>
              Keep driving
            </Button>
          </>
        }
      >
        {writingNote ? (
          <>
            <textarea
              aria-label="Note for the helper"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-sage-line bg-bone px-3 py-2.5 text-[14px] leading-5 text-ink"
            />
            <Button tone="fill" onClick={() => void settle(() => nas.resumeTask(task, note), "The helper did not resume")}>
              Hand back
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <DialogOption tone="fill" title="Resume the loop" detail="It continues from where it paused, with the page as it is now." onClick={() => void settle(() => nas.resumeTask(task), "The helper did not resume")} />
            <DialogOption tone="outline" title="Hand back with a note" detail="It is told what you did and where things stand, then continues." onClick={() => setWritingNote(true)} />
            <DialogOption tone="danger" title="Stop the task" detail={`It goes to sleep and ${task.owner} is told it was stopped.`} onClick={() => void settle(() => nas.stopTask(task), "The task did not stop")} />
          </div>
        )}
      </Dialog>
    </LargeDialog>
  );
}

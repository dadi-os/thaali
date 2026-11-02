import { useEffect, useEffectEvent, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hath, isMeshOnline, nas } from "../../../shared/api";
import type { NasTask } from "../../../shared/api/nas";
import { AGENTS_QUERY_KEY } from "../../../shared/hooks/useEvents";
import { Button } from "../../../shared/components/Button";
import { Dialog, DialogOption, Modal } from "../../../shared/components/Overlay";
import { useConnection } from "../../../shared/hooks/useConnection";
import { pushToast } from "../../../store/toasts";
import { getTakeover, setTakeover, subscribeTakeover } from "../../../store/takeover";
import { BrowserFrame } from "../BrowserFrame";
import { useTerminalCapture } from "../terminalCapture";
import { TakeoverBanner, TakeoverBrowser, TakeoverFooter, TakeoverHeader, TakeoverTerminal } from "./parts";

/** How long the modal's exit animation plays before it is removed. */
const LEAVE_MS = 200;
/** Lines of the pane the terminal modal reads. */
const TERMINAL_LINES = 400;

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
  const task = address === null ? undefined : tasks.data?.find((candidate) => candidate.task === address);
  if (task === undefined || task.resource === undefined) {
    return null;
  }
  return <OpenTakeover key={task.task} task={task} resource={task.resource} />;
}

type OpenTakeoverProps = {
  task: NasTask;
  /** What the task holds in Nas: a browser slot or a terminal id. */
  resource: string;
};

/** One open takeover: its header, body and footer, the hand-back dialog, and the state they share. */
function OpenTakeover({ task, resource }: OpenTakeoverProps) {
  const queryClient = useQueryClient();
  const agents = useQuery({ queryKey: AGENTS_QUERY_KEY, queryFn: async () => (await hath.listAgents()).agents });
  const [driven, setDriven] = useState(false);
  const [handingBack, setHandingBack] = useState(false);
  const [writingNote, setWritingNote] = useState(false);
  const [note, setNote] = useState("");
  const [command, setCommand] = useState("");
  const [leaving, setLeaving] = useState(false);
  const driving = driven || task.status === "paused";
  const current = agents.data?.find((agent) => agent.id === task.owner)?.sessions.tasks.find((row) => row.id === task.task)?.current ?? "";
  const { capture } = useTerminalCapture(resource, TERMINAL_LINES);

  const leave = () => {
    setLeaving(true);
    window.setTimeout(() => setTakeover(null), LEAVE_MS);
  };
  const requestClose = () => {
    if (driving) {
      setHandingBack(true);
    } else {
      leave();
    }
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
    if (handingBack) {
      if (e.key === "Escape") {
        e.preventDefault();
        setHandingBack(false);
        setWritingNote(false);
      }
      return;
    }
    if (driving && (e.metaKey || e.ctrlKey) && e.key === ".") {
      e.preventDefault();
      e.stopPropagation();
      setHandingBack(true);
    } else if (!driving && e.key === "Escape") {
      e.preventDefault();
      leave();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const info = { task: task.task, kind: task.kind, owner: task.owner, purpose: task.purpose, status: task.status, resource };
  return (
    <Modal label={`${task.kind === "browser" ? "Browser" : "Terminal"} ${task.id}`} width="min(1120px, calc(100% - 96px))" height="min(780px, calc(100% - 96px))" leaving={leaving}>
      <TakeoverHeader task={info} driving={driving} onClose={requestClose} />
      {driving ? <TakeoverBanner owner={task.owner} /> : null}
      {task.kind === "browser" ? (
        <TakeoverBrowser url={current} task={task.task} driving={driving} onBack={() => void navigate("back")} onReload={() => void navigate("reload")}>
          <BrowserFrame browserId={Number(resource)} variant="page" onDrive={() => setDriven(true)} />
        </TakeoverBrowser>
      ) : (
        <TakeoverTerminal
          output={capture.isError ? capture.error.message : (capture.data ?? "")}
          cwd={current.split(" · ")[0]!}
          driving={driving}
          command={command}
          onCommand={setCommand}
          onSubmit={() => {
            const typed = command;
            setCommand("");
            void send([typed], true).then(() => send(["Enter"], false));
          }}
        />
      )}
      <TakeoverFooter kind={task.kind} resource={resource} driving={driving} />
      {handingBack ? (
        <Dialog
          title="Hand it back?"
          subtitle={`${task.owner}’s helper is paused${current ? ` on ${current}` : ""}.`}
          zIndex={5}
          footer={
            <>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--ink-muted)", lineHeight: "16px" }}>Either way the helper first sees the page and its own last step, not your keystrokes.</span>
              <Button tone="quiet" onClick={() => setHandingBack(false)}>
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
                style={{ width: "100%", resize: "none", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--sage-line)", background: "var(--bone)", color: "var(--ink)", fontSize: 14, lineHeight: "20px" }}
              />
              <Button tone="fill" onClick={() => void settle(() => nas.resumeTask(task, note), "The helper did not resume")}>
                Hand back
              </Button>
            </>
          ) : (
            <>
              <DialogOption tone="fill" title="Resume the loop" detail="It continues from where it paused, with the page as it is now." onClick={() => void settle(() => nas.resumeTask(task), "The helper did not resume")} />
              <DialogOption tone="outline" title="Hand back with a note" detail="It is told what you did and where things stand, then continues." onClick={() => setWritingNote(true)} />
              <DialogOption tone="danger" title="Stop the task" detail={`It goes to sleep and ${task.owner} is told it was stopped.`} onClick={() => void settle(() => nas.stopTask(task), "The task did not stop")} />
            </>
          )}
        </Dialog>
      ) : null}
    </Modal>
  );
}

import { type KeyboardEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { nas } from "../../../shared/api";
import { readText } from "../../../shared/desktop/clipboard";
import { pushToast } from "../../../contexts/toasts";
import { useTerminalCapture } from "../terminalCapture";
import type { TerminalActivity } from "./activity";
import { createKeySender, type TerminalInput, terminalInputOf, terminalPasteOf } from "./terminalKeys";

/** Lines of the pane the modal reads. */
const LINES = 400;
/** How close to the bottom, in px, the pane counts as scrolled to the bottom and keeps following new output. */
const FOLLOW_PX = 24;

export type TerminalPaneProps = {
  /** The Nas terminal id the pane shows and types into. */
  terminalId: string;
  /** Keys typed in the focused pane go to the terminal and the pane is read every 250 ms; otherwise it only shows the output. */
  controlling: boolean;
  /** Called with each thing typed, for the hand-back summary. */
  onActivity: (activity: TerminalActivity) => void;
};

/**
 * A terminal you type into: the output pane is the only place to enter anything. While `controlling` it takes focus, a
 * cursor marks the end of the last line, and keys, chords and pastes go to the terminal in order. It follows the newest
 * line until Ankur scrolls up and again once he scrolls back to the bottom.
 */
export function TerminalPane({ terminalId, controlling, onActivity }: TerminalPaneProps) {
  const { capture, live } = useTerminalCapture(terminalId, LINES, controlling ? "control" : "watch");
  const paneRef = useRef<HTMLPreElement>(null);
  const following = useRef(true);
  const [focused, setFocused] = useState(false);
  const sender = useMemo(
    () =>
      createKeySender(
        (keys, literal) => nas.terminalKeys(terminalId, keys, literal),
        (message) => pushToast({ key: "takeover:keys", tone: "error", title: "The terminal did not take the keys", body: message }),
      ),
    [terminalId],
  );

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (pane && following.current) {
      pane.scrollTop = pane.scrollHeight;
    }
  }, [capture.data]);

  useLayoutEffect(() => {
    if (controlling) {
      paneRef.current?.focus();
    }
  }, [controlling]);

  const send = (input: TerminalInput) => {
    following.current = true;
    sender.push(input.batch);
    if (input.activity !== null) {
      onActivity(input.activity);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLPreElement>) => {
    if (!controlling || e.nativeEvent.isComposing) {
      return;
    }
    if (e.metaKey && e.key === "v") {
      e.preventDefault();
      readText()
        .then((text) => {
          const input = terminalPasteOf(text);
          if (input !== null) {
            send(input);
          }
        })
        .catch((err: unknown) => pushToast({ key: "takeover:paste", tone: "error", title: "The clipboard could not be read", body: err instanceof Error ? err.message : String(err) }));
      return;
    }
    const input = terminalInputOf(e);
    if (input !== null) {
      e.preventDefault();
      e.stopPropagation();
      send(input);
    }
  };

  const output = capture.isError ? capture.error.message : (capture.data ?? (live ? "Attaching…" : "Paused while hidden"));
  return (
    <pre
      ref={paneRef}
      data-selectable
      tabIndex={controlling ? 0 : -1}
      aria-label={controlling ? "Terminal, you are typing into it" : "Terminal output"}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onScroll={(e) => {
        const pane = e.currentTarget;
        following.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight <= FOLLOW_PX;
      }}
      className="scroll m-0 min-h-0 flex-1 cursor-text overflow-auto bg-[#23271f] px-4 py-3.5 font-numeric text-[13px] leading-[18px] break-words whitespace-pre-wrap text-[#dfe6d6] outline-none"
    >
      {output}
      {controlling && capture.isSuccess ? (
        <span aria-hidden="true" className={`ml-px inline-block h-[15px] w-[8px] translate-y-[2px] ${focused ? "animate-breath bg-[#9fc08a]" : "border border-[#9fc08a]"}`} />
      ) : null}
    </pre>
  );
}

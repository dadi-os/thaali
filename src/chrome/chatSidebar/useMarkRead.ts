import { useEffect, useRef, useState } from "react";
import { hath } from "../../shared/api";
import { applyThreadRead, seqToMark, type ChatMessage } from "../../store/chat";
import { failureTarget, pushToast } from "../../store/toasts";
import { logLine } from "../../shared/lib/platform/log";

function windowVisible(): boolean {
  return document.visibilityState === "visible";
}

/**
 * Mark the open thread read through Hath while the window is visible: when it opens, when
 * a reply lands in it, and when the window comes back into view. A failed mark is logged
 * and toasted, and the next change tries again.
 */
export function useMarkRead(
  agentId: string | null,
  messages: ChatMessage[],
  readSeq: number | null | undefined,
  connected: boolean,
): void {
  const [visible, setVisible] = useState(windowVisible);
  const asked = useRef<{ agentId: string; seq: number } | null>(null);

  useEffect(() => {
    const onChange = () => setVisible(windowVisible());
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  useEffect(() => {
    if (!connected || !agentId || !visible) {
      return;
    }
    const seq = seqToMark(messages, readSeq);
    if (seq === null) {
      return;
    }
    const prior = asked.current;
    if (prior && prior.agentId === agentId && prior.seq >= seq) {
      return;
    }
    const request = { agentId, seq };
    asked.current = request;
    hath
      .markThreadRead(agentId, seq)
      .then((mark) => applyThreadRead(mark.agent_id, mark.read_seq, mark.unread))
      .catch((err: unknown) => {
        if (asked.current === request) {
          asked.current = null;
        }
        const message = err instanceof Error ? err.message : String(err);
        logLine("error", message, "thread_read_failed");
        pushToast({
          key: "thread_read_failed",
          tone: "error",
          title: "Couldn't mark the chat read",
          body: message,
          target: failureTarget(err),
        });
      });
  }, [agentId, messages, readSeq, connected, visible]);
}

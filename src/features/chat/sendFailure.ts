import { copyText } from "../../shared/desktop/clipboard";
import { pushToast, type ToastTarget } from "../../contexts/toasts";

/** What a message that did not send needs reported. */
export type SendFailure = {
  /** Folds repeats of the same failure into one toast. */
  key: string;
  /** What the message said, kept on the clipboard so it is not lost. */
  text: string;
  /** Why it did not send, as the server said it. */
  message: string;
  /** Where clicking the toast goes: the router dock or the agent's thread. */
  target: ToastTarget;
};

/**
 * Reports a message that did not send: its text goes to the clipboard, a toast says so and says
 * why, and a click on the toast goes back to where it was written. When the clipboard cannot be
 * written, the toast says that instead of claiming the copy.
 */
export async function reportSendFailure({ key, text, message, target }: SendFailure): Promise<void> {
  try {
    await copyText(text);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    pushToast({ key, tone: "error", title: "Not sent", body: `${message}. Copying it to the clipboard failed: ${reason}`, target });
    return;
  }
  pushToast({ key, tone: "error", title: "Not sent, copied to your clipboard", body: message, target });
}

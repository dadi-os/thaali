/** Copying a Chaavi secret: it leaves the clipboard again after a while. */

import { readText, copyText } from "../../shared/lib/platform/clipboard";
import { pushToast } from "../../store/toasts";

/** How long a copied secret stays on the clipboard, in ms. */
export const CLIPBOARD_CLEAR_MS = 30_000;

/**
 * Put `value` on the clipboard and, after {@link CLIPBOARD_CLEAR_MS}, empty the clipboard if it still holds `value`.
 * A copy that fails rejects, and a clear that fails toasts, since a secret left on the clipboard is something to know.
 */
export async function copySecret(value: string): Promise<void> {
  await copyText(value);
  setTimeout(() => {
    readText()
      .then((current) => (current === value ? copyText("") : undefined))
      .catch((err: unknown) =>
        pushToast({ key: "chaavi-clipboard-clear", tone: "error", title: "Couldn't clear the clipboard", body: err instanceof Error ? err.message : String(err) }),
      );
  }, CLIPBOARD_CLEAR_MS);
}

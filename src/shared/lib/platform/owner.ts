/** The computer's owner check before a Chaavi secret is shown or copied. */

import { isTauriRuntime } from "../../api/runtime";

/** How long one confirmation covers further reveals, so opening a few secrets in a row asks once. */
const CONFIRMED_FOR_MS = 60_000;

let confirmedAt = 0;

/** Whether the owner confirmed within the last minute, so a refresh needs no new prompt. */
export function ownerConfirmedRecently(): boolean {
  return Date.now() - confirmedAt < CONFIRMED_FOR_MS;
}

/**
 * Resolve once the operating system has confirmed the person at the computer owns it: Touch ID
 * (or the account password) on macOS, Windows Hello on Windows, polkit on Linux, showing
 * `reason`. A confirmation in the last minute covers it. Rejects with the system's message when
 * the owner cancels or the check cannot run, and outside the desktop app, which is the only
 * place the check exists; callers show the message and keep the secret hidden.
 */
export async function confirmOwner(reason: string): Promise<void> {
  if (ownerConfirmedRecently()) {
    return;
  }
  if (!isTauriRuntime()) {
    throw new Error("Secrets open only in the dadi desktop app, which asks this computer to confirm it's you.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke("owner_authenticate", { reason });
  } catch (err) {
    throw new Error(String(err).replace(/^\w+: /, ""));
  }
  confirmedAt = Date.now();
}

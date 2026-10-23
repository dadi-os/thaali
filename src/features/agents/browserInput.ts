/**
 * Drive a Nas browser from its live view: translate DOM pointer, wheel and key events into
 * Nas input events, and send them in order, one request at a time, so a drag never
 * overtakes its own press.
 */

import type { PointerEvent as ReactPointerEvent } from "react";
import { nas } from "../../shared/api";
import type { NasBrowserInputEvent } from "../../shared/api/nas";

type Button = "none" | "left" | "middle" | "right";

/** DOM `MouseEvent.button` to Nas button name. */
const BUTTON_NAMES: Button[] = ["left", "middle", "right"];

/** Pointer position as fractions of the element the event landed on. */
function fractionIn(element: HTMLElement, e: { clientX: number; clientY: number }): { x: number; y: number } {
  const box = element.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
    y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
  };
}

/** Held-modifier bitmask in CDP's order: alt 1, ctrl 2, meta 4, shift 8. */
function modifiersOf(e: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): number {
  return (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
}

/** The button a move should report from the held-button bitmask. */
function heldButton(buttons: number): Button {
  if (buttons & 1) {
    return "left";
  }
  if (buttons & 4) {
    return "middle";
  }
  return buttons & 2 ? "right" : "none";
}

/** The fields of a DOM or React keyboard event that `keyInput` reads. */
type KeyEventFields = Pick<KeyboardEvent, "key" | "code" | "keyCode" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">;

/** Nas event for a pointer move, press or release on `element`. */
export function pointerInput(
  kind: "move" | "down" | "up",
  element: HTMLElement,
  e: ReactPointerEvent<HTMLElement>,
): NasBrowserInputEvent {
  const button = kind === "move" ? heldButton(e.buttons) : BUTTON_NAMES[e.button];
  return {
    type: kind,
    ...fractionIn(element, e),
    button,
    buttons: e.buttons,
    click_count: kind === "move" ? 0 : Math.max(1, e.detail),
    modifiers: modifiersOf(e),
  };
}

/** Nas event for a wheel turn on `element`. */
export function wheelInput(element: HTMLElement, e: WheelEvent): NasBrowserInputEvent {
  return {
    type: "wheel",
    ...fractionIn(element, e),
    button: "none",
    buttons: e.buttons,
    delta_x: e.deltaX,
    delta_y: e.deltaY,
    modifiers: modifiersOf(e),
  };
}

/**
 * Nas event for a key press or release, or null for keys the app keeps: Escape (closes the
 * expanded view) and any chord holding Cmd.
 */
export function keyInput(kind: "key_down" | "key_up", e: KeyEventFields): NasBrowserInputEvent | null {
  if (e.key === "Escape" || e.metaKey) {
    return null;
  }
  const types = e.key.length === 1 && !e.ctrlKey;
  return {
    type: kind,
    key: e.key,
    code: e.code,
    key_code: e.keyCode,
    text: e.key === "Enter" ? "\r" : types ? e.key : "",
    modifiers: modifiersOf(e),
  };
}

/**
 * Queue of input events for one browser. `push` sends immediately when idle, otherwise the
 * event waits and goes out with everything queued behind the request in flight. A move
 * queued right after another move replaces it, so a fast pointer sends where it is and not
 * every step on the way, which Nas could not replay as fast as it arrives. A failed
 * request drops its batch and reports through `onError`; there is no retry.
 */
export function createInputSender(browserId: number, onError: (message: string) => void) {
  let queue: NasBrowserInputEvent[] = [];
  let sending = false;

  async function flush(): Promise<void> {
    if (sending || queue.length === 0) {
      return;
    }
    const batch = queue;
    queue = [];
    sending = true;
    try {
      await nas.browserInput(browserId, batch);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      sending = false;
    }
    void flush();
  }

  return {
    push(event: NasBrowserInputEvent): void {
      if (event.type === "move" && queue[queue.length - 1]?.type === "move") {
        queue[queue.length - 1] = event;
      } else {
        queue.push(event);
      }
      void flush();
    },
  };
}

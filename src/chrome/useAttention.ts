import { useEffect } from "react";
import { noteInput } from "../store/attention";

/** Input that means you are actively doing something in the window. */
const INPUT_EVENTS = ["keydown", "pointerdown", "wheel"] as const;

/** Feed every key, click and scroll in the window to the attention store, so replies only switch chats while you are idle. */
export function useAttention(): void {
  useEffect(() => {
    const onInput = () => noteInput(Date.now());
    for (const type of INPUT_EVENTS) {
      window.addEventListener(type, onInput, { capture: true, passive: true });
    }
    return () => {
      for (const type of INPUT_EVENTS) {
        window.removeEventListener(type, onInput, { capture: true });
      }
    };
  }, []);
}

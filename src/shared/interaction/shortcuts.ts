import { useEffect, useRef } from "react";

/** Whether the key event is the combination `combo` names, such as "mod+k" or "mod+shift+/": `mod` is Command on a Mac and Control elsewhere. */
export function matchesShortcut(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const key = parts[parts.length - 1]!;
  const wantsMod = parts.includes("mod");
  const mod = navigator.platform.startsWith("Mac") ? event.metaKey : event.ctrlKey;
  return mod === wantsMod && event.shiftKey === parts.includes("shift") && event.altKey === parts.includes("alt") && event.key.toLowerCase() === key;
}

/**
 * Run `handler` when `combo` is pressed anywhere in the window. The one place a keyboard shortcut is bound: the
 * same combination is what an action's `shortcut` field shows in menus. The default action is prevented when it runs.
 */
export function useShortcut(combo: string, handler: () => void): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (matchesShortcut(event, combo)) {
        event.preventDefault();
        latest.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo]);
}

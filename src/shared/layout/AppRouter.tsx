import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

/**
 * The app's one router. React Router wraps every location change in `startTransition` unless told not to, which makes moving
 * between pages a low-priority update that React renders in slices and restarts whenever an urgent update lands. The rest of the
 * app is urgent: the chat rail reads its store with `useSyncExternalStore`, its push animations and live data tick the tree
 * constantly. So a page change waited for the rail to go quiet, and a thread opened while a page was loading made React throw the
 * page's half-built render away and redo it in one block. Moving in the rail and moving in the page held each other up. Page
 * changes commit at the same priority as everything else, so neither one waits for or interrupts the other.
 */
export function AppRouter({ children }: { children: ReactNode }) {
  return <BrowserRouter useTransitions={false}>{children}</BrowserRouter>;
}

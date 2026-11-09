/**
 * Who controls a helper task in its takeover modal. The modal opens watching: input does nothing and the helper keeps working.
 * Takeover pauses the task and lets input through; Return, closing the modal, or half an hour without input hands it back with
 * a summary of what Ankur did.
 */

import type { Activity } from "./activity";

/** `watching`; `pausing` while Takeover waits for Nas; `in-control`; `returning` while the hand back waits for Nas. */
export type ControlState = "watching" | "pausing" | "in-control" | "returning";

/**
 * How long Ankur may go without input before control is handed back for him. Nas resumes a paused task, with no summary, after
 * 30 minutes without input, so this is shorter and the helper hears what he did first.
 */
export const IDLE_RETURN_MS = 29 * 60_000;

/** What {@link createControl} needs. */
export type ControlOptions<E> = {
  /** Pauses the task in Nas. */
  pause: () => Promise<unknown>;
  /** Resumes the task in Nas with the summary as the note. */
  resume: (summary: string) => Promise<unknown>;
  /** What he does while in control, summarised on the way back. */
  activity: Activity<E>;
  /** A takeover or a hand back that failed, with what it was doing as the message. */
  onError: (message: string, err: unknown) => void;
};

/** One modal's control: its state, and the transitions between watching and in control. */
export type Control<E> = {
  getState: () => ControlState;
  subscribe: (listener: () => void) => () => void;
  /** Pauses the task and starts a fresh record; a failure leaves it watching. Does nothing unless watching. */
  takeOver: () => Promise<void>;
  /** Resumes the task with the summary and answers true once he is not in control; a failure is reported, leaves him in control and answers false. Does nothing unless in control. */
  handBack: () => Promise<boolean>;
  /** Records what he did and returns true while he is in control; while he is not, the input is dropped and this returns false. */
  record: (event: E) => boolean;
  /** Stops the idle timer when the modal goes away. */
  dispose: () => void;
};

/** A control that starts watching. */
export function createControl<E>({ pause, resume, activity, onError }: ControlOptions<E>): Control<E> {
  let state: ControlState = "watching";
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  function set(next: ControlState): void {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  }
  function stopTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }
  function startTimer(): void {
    stopTimer();
    timer = setTimeout(() => {
      void handBack();
    }, IDLE_RETURN_MS);
  }
  async function takeOver(): Promise<void> {
    if (state !== "watching") {
      return;
    }
    set("pausing");
    try {
      await pause();
    } catch (err) {
      set("watching");
      onError("The task did not pause", err);
      return;
    }
    activity.reset();
    set("in-control");
    startTimer();
  }
  async function handBack(): Promise<boolean> {
    if (state !== "in-control") {
      return state === "watching";
    }
    stopTimer();
    set("returning");
    try {
      await resume(activity.summary());
    } catch (err) {
      set("in-control");
      startTimer();
      onError("The task did not resume", err);
      return false;
    }
    set("watching");
    return true;
  }
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    takeOver,
    handBack,
    record(event) {
      if (state !== "in-control") {
        return false;
      }
      activity.record(event);
      startTimer();
      return true;
    },
    dispose: stopTimer,
  };
}

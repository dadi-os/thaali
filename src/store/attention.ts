import { getChatState, holdAgentMessage, openAgent, type ChatOpen } from "./chat";

/** Quiet time after your last key, click or scroll before a reply may switch the open chat. */
export const IDLE_MS = 10_000;
/** Reading pace (words per second) used to guess how long a reply that just landed holds you. */
const WORDS_PER_SECOND = 4;
/** Shortest and longest a reply is assumed to take to read. */
const MIN_READ_MS = 4_000;
const MAX_READ_MS = 45_000;

/** What you are doing right now, as far as switching chats is concerned. */
export type Attention = {
  /** The dadi window has focus. */
  focused: boolean;
  /** Milliseconds since your last key, click or scroll anywhere in the window. */
  sinceInputMs: number;
  /** The open pane's composer holds an unsent draft or attachments. */
  composing: boolean;
  /** A reply in the open chat landed recently enough that you are likely still reading it. */
  reading: boolean;
};

let lastInputAt = 0;
let composing = false;
let readingUntil = 0;

/** Record a key, click or scroll at `at` (ms since epoch). */
export function noteInput(at: number): void {
  lastInputAt = at;
}

/** Record whether the open pane's composer holds an unsent draft. */
export function setComposing(next: boolean): void {
  composing = next;
}

/** How long a message of this length takes to read, clamped to MIN_READ_MS..MAX_READ_MS. */
export function readingMs(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_READ_MS, Math.max(MIN_READ_MS, (words / WORDS_PER_SECOND) * 1000));
}

/**
 * Whether a reply from another agent may take over the chat sidebar. Never while you have
 * a draft going; always while you are away from the window, or on the Talk to Dadi pane
 * waiting for a hand-off to answer; otherwise only once you have finished reading the
 * last reply and been quiet for IDLE_MS.
 */
export function shouldSwitchChat(open: ChatOpen, attention: Attention): boolean {
  if (attention.composing) {
    return false;
  }
  if (!attention.focused || open.kind === "dadi") {
    return true;
  }
  return !attention.reading && attention.sinceInputMs >= IDLE_MS;
}

/**
 * Route an agent's message to you: in the open chat it starts a reading window; from
 * another agent it opens that chat when `shouldSwitchChat` allows, and otherwise is held
 * as unread with a bubble offering it.
 */
export function deliverAgentMessage(agentId: string, content: string, now: number): void {
  const open = getChatState().open;
  const here = open.kind === "agent" && open.agentId === agentId;
  const switching =
    !here &&
    shouldSwitchChat(open, {
      focused: document.hasFocus(),
      sinceInputMs: now - lastInputAt,
      composing,
      reading: now < readingUntil,
    });
  if (here || switching) {
    openAgent(agentId);
    readingUntil = now + readingMs(content);
    return;
  }
  holdAgentMessage(agentId);
}

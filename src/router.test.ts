import { beforeEach, describe, expect, it } from "vitest";
import { repliesTo } from "./chrome/chatSidebar/lanes";
import {
  clearRouterRuns,
  failRouterRun,
  finishRouterRun,
  getChatState,
  resetChatStore,
  startRouterRun,
} from "./store/chat";
import type { ChatMessage } from "./store/chat";

const msg = (seq: number, from_user: boolean, content: string): ChatMessage => ({
  seq,
  from_user,
  content,
  at: `2026-09-29T12:00:${String(seq).padStart(2, "0")}Z`,
});

describe("router replies", () => {
  it("collects agent replies after the routed message, up to your next one", () => {
    const thread = [
      msg(1, true, "earlier ask"),
      msg(2, false, "earlier answer"),
      msg(3, true, "routed ask"),
      msg(4, false, "on it"),
      msg(5, false, "done"),
      msg(6, true, "follow-up"),
      msg(7, false, "later answer"),
    ];
    expect(repliesTo(thread, 3).map((m) => m.content)).toEqual(["on it", "done"]);
  });

  it("is empty until the routed message is in the thread", () => {
    expect(repliesTo([msg(1, true, "other"), msg(2, false, "reply")], 9)).toEqual([]);
  });

  it("only anchors on a message you sent", () => {
    expect(repliesTo([msg(3, false, "agent row"), msg(4, false, "x")], 3)).toEqual([]);
  });
});

describe("router runs", () => {
  beforeEach(() => {
    resetChatStore();
  });

  it("records a run as routing, then every message sent as you", () => {
    const id = startRouterRun("book the escape room");
    expect(getChatState().routerRuns[0]).toMatchObject({
      id,
      content: "book the escape room",
      status: "routing",
      sent: [],
    });
    const sent = [
      {
        to_agent_id: "escape-room-booking",
        content: "Check I can afford it, then book it.",
        seq: 12,
        created_at: "2026-09-29T12:00:00Z",
      },
    ];
    finishRouterRun(id, sent);
    expect(getChatState().routerRuns[0]).toMatchObject({ status: "sent", sent });
  });

  it("keeps the server message when a run fails", () => {
    const id = startRouterRun("hello");
    failRouterRun(id, "dwar unreachable");
    expect(getChatState().routerRuns[0]).toMatchObject({
      status: "failed",
      error: "dwar unreachable",
    });
  });

  it("clears runs off the screen", () => {
    startRouterRun("one");
    startRouterRun("two");
    clearRouterRuns();
    expect(getChatState().routerRuns).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { focusSet } from "./shared/components/ForceGraph/focus";
import { inHoverZone } from "./shared/components/Popover/zone";
import {
  conversationBucket,
  formatListTime,
  formatMessageTime,
  formatRelative,
  groupConversations,
} from "./chrome/chatSidebar/format";
import {
  partitionByQueued,
  trackIncoming,
} from "./chrome/chatSidebar/lanes";
import { laneChipLabel } from "./chrome/chatSidebar/LaneChip";
import { formatToolSignature } from "./shared/lib/content/toolSignature";
import {
  addOptimistic,
  clearLiveChat,
  formatOutboundContent,
  getChatState,
  hydrateThreadMessages,
  ingestLiveMessage,
  isUserThreadMessage,
  holdAgentMessage,
  dismissNudge,
  mergeConversations,
  messageKey,
  openAgent,
  openList,
  resetChatStore,
  seedConversations,
  threadAgentId,
  upsertConversation,
} from "./store/chat";
import type { ChatMessage } from "./store/chat";
import { IDLE_MS, readingMs, shouldSwitchChat, type Attention } from "./store/attention";
import type { GharDevice } from "./types/ghar";
import type { DurableMessage, Lane, LogRecord } from "./types/hath";
import { searchHouse } from "./features/ghar/house/search";
import {
  agentGraph,
  createAgentSimulation,
  isLiveVisual,
  shellRadius,
  statusLabel,
  visualState,
} from "./features/agents/tree";
import {
  connectionsOf,
  createMemorySimulation,
  mergeGraph,
  type GraphData,
  type MemoryLink,
} from "./features/memory/graph";
import { syncForceSimulation } from "./shared/components/ForceGraph";
import { buildActivity, thoughtGist } from "./features/agents/activity/wakes";
import { revealSchedule } from "./shared/components/ForceGraph/reveal";
import {
  hasRememberedSessions,
  pickLiveBrowser,
  pickLiveTerminal,
} from "./features/agents/sessions";
import {
  addDays,
  isSameDay,
  startOfWeek,
  toIsoBounds,
} from "./features/timeline/dates";
import { consumeSseBuffer, joinUrl } from "./shared/api/sse";
import { createChaaviClient } from "./shared/api/chaavi";
import { createNasClient } from "./shared/api/nas";
import { YAAD, HATH, NAS, CHAAVI, CHAAVI_VAULT, GHAR } from "./shared/api/constants";
import type { Transport } from "./shared/api/transport";
import type { AgentRecord } from "./types/hath";

describe("formatRelative", () => {
  it("formats minutes ago", () => {
    const now = Date.parse("2026-01-01T12:00:00Z");
    const iso = new Date(now - 5 * 60_000).toISOString();
    expect(formatRelative(iso, now)).toMatch(/minute/);
  });
});

describe("formatOutboundContent", () => {
  it("joins text and image placeholders", () => {
    expect(
      formatOutboundContent("hi", [
        { media_type: "image/png", data: "abc", filename: "shot.png" },
      ]),
    ).toBe("hi\n[Image: shot.png]");
  });
});

describe("chatSidebar lanes", () => {
  it("partitions queued vs settled", () => {
    const messages: ChatMessage[] = [
      {
        seq: 1,
        from_user: true,
        content: "a",
        at: "2026-01-01T00:00:00Z",
      },
      {
        seq: -2,
        from_user: true,
        content: "b",
        at: "2026-01-01T00:00:01Z",
        queued: true,
      },
    ];
    const { settled, queued } = partitionByQueued(messages);
    expect(settled.map((m) => m.seq)).toEqual([1]);
    expect(queued.map((m) => m.seq)).toEqual([-2]);
  });

  it("treats only post-open non-historical rows as live", () => {
    const existing: ChatMessage = {
      seq: 1,
      from_user: true,
      content: "hi",
      at: "2026-01-01T00:00:00Z",
    };
    const known = new Set<string>();
    const live = new Set<string>();
    trackIncoming(known, live, [existing], true);
    expect(live.size).toBe(0);

    const incoming: ChatMessage = {
      seq: 2,
      from_user: false,
      content: "hello",
      at: "2026-01-01T00:00:01Z",
    };
    const historical: ChatMessage = {
      seq: 3,
      from_user: false,
      content: "old",
      at: "2026-01-01T00:00:02Z",
      historical: true,
    };
    trackIncoming(known, live, [existing, incoming, historical], false);
    expect(live.has(messageKey(incoming))).toBe(true);
    expect(live.has(messageKey(historical))).toBe(false);
    expect(live.has(messageKey(existing))).toBe(false);
  });
});

describe("lane chip and tool signature", () => {
  it("maps lane occupancy to chip labels", () => {
    expect(laneChipLabel(false, false)).toBeNull();
    expect(laneChipLabel(true, false)).toBe("thinking");
    expect(laneChipLabel(false, true)).toBe("working");
    expect(laneChipLabel(true, true)).toBe("thinking + working");
  });

  it("formats a compact tool signature", () => {
    expect(
      formatToolSignature("browser_navigate", { url: "https://x.test/path" }),
    ).toBe('browser_navigate(url: "https://x.test/path")');
    expect(formatToolSignature("noop", {})).toBe("noop()");
  });
});

describe("chat timestamps", () => {
  const now = new Date(2026, 9, 6, 15, 0, 0).getTime();
  const at = (y: number, m: number, d: number, h: number, min: number) =>
    new Date(y, m, d, h, min).toISOString();

  it("dates a message by how long ago it was sent", () => {
    expect(formatMessageTime(at(2026, 9, 6, 9, 5), now)).toBe("9:05 AM");
    expect(formatMessageTime(at(2026, 9, 5, 21, 30), now)).toBe("Yesterday 9:30 PM");
    expect(formatMessageTime(at(2026, 8, 2, 13, 0), now)).toBe("Sep 2, 1:00 PM");
    expect(formatMessageTime(at(2025, 11, 31, 8, 0), now)).toBe("Dec 31, 2025, 8:00 AM");
  });

  it("dates a list row by its last activity", () => {
    expect(formatListTime(at(2026, 9, 6, 14, 2), now)).toBe("2:02 PM");
    expect(formatListTime(at(2026, 9, 5, 8, 0), now)).toBe("Yesterday");
    expect(formatListTime(at(2026, 9, 2, 8, 0), now)).toBe("Fri");
    expect(formatListTime(at(2026, 8, 20, 8, 0), now)).toBe("Sep 20");
    expect(formatListTime(at(2025, 8, 20, 8, 0), now)).toBe("Sep 20, 2025");
  });
});

describe("conversation list refresh", () => {
  const row = (agent_id: string, last_at: string, last_message: string) => ({
    agent_id,
    agent_name: agent_id.toUpperCase(),
    last_message,
    last_at,
    from_user: false,
  });

  it("takes newer previews from Hath, keeps newer local ones, and follows Hath's membership", () => {
    resetChatStore();
    seedConversations([
      row("a", "2026-10-06T10:00:00.000Z", "old a"),
      row("b", "2026-10-06T12:00:00.000Z", "sse b"),
      row("gone", "2026-10-06T09:00:00.000Z", "retired"),
    ]);
    mergeConversations([
      row("a", "2026-10-06T11:00:00.000Z", "missed a"),
      row("b", "2026-10-06T11:30:00.000Z", "stale b"),
    ]);
    const byId = Object.fromEntries(getChatState().conversations.map((c) => [c.agent_id, c.last_message]));
    expect(byId).toEqual({ a: "missed a", b: "sse b" });
  });
});

describe("conversationBucket", () => {
  const now = new Date(2026, 2, 10, 15, 0, 0).getTime();
  const today = new Date(2026, 2, 10, 10, 0, 0).toISOString();
  const todayEarlier = new Date(2026, 2, 10, 8, 0, 0).toISOString();
  const yesterday = new Date(2026, 2, 9, 20, 0, 0).toISOString();
  const previous = new Date(2026, 2, 1, 0, 0, 0).toISOString();

  it("groups today, yesterday, and previous", () => {
    expect(conversationBucket(today, now)).toBe("Today");
    expect(conversationBucket(yesterday, now)).toBe("Yesterday");
    expect(conversationBucket(previous, now)).toBe("Previous");
  });

  it("preserves newest-first order inside groups", () => {
    const grouped = groupConversations(
      [
        { last_at: today, id: "a" },
        { last_at: todayEarlier, id: "b" },
        { last_at: previous, id: "c" },
      ],
      now,
    );
    expect(grouped.map((g) => g.bucket)).toEqual(["Today", "Previous"]);
    expect(grouped[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });
});

function durableMessage(partial: {
  id?: string;
  seq: number;
  from: string | null;
  to: string | null;
  content: string;
  at: string;
}): DurableMessage {
  return {
    id: partial.id ?? `msg-${partial.seq}`,
    seq: partial.seq,
    from_agent_id: partial.from,
    to_agent_id: partial.to,
    content: partial.content,
    created_at: partial.at,
  };
}

describe("user-thread history", () => {
  it("keys a user message on the recipient and an agent reply on the sender", () => {
    expect(isUserThreadMessage(null, "agent")).toBe(true);
    expect(isUserThreadMessage("agent", null)).toBe(true);
    expect(isUserThreadMessage("a", "b")).toBe(false);
    expect(threadAgentId(null, "agent")).toBe("agent");
    expect(threadAgentId("agent", null)).toBe("agent");
    expect(threadAgentId("a", "b")).toBeNull();
  });

  it("seeds conversations from GET /threads summaries", () => {
    resetChatStore();
    seedConversations([
      {
        agent_id: "planner",
        agent_name: "Planner",
        last_message: "on it",
        last_at: "2026-03-10T11:00:03Z",
        from_user: false,
      },
    ]);
    const snap = getChatState();
    expect(snap.conversations.map((c) => c.agent_id)).toEqual(["planner"]);
    expect(snap.conversations[0]!.last_message).toBe("on it");
    resetChatStore();
  });

  it("hydrates durable messages onto an agent thread", () => {
    resetChatStore();
    hydrateThreadMessages("planner", [
      durableMessage({
        from: null,
        to: "planner",
        content: "plan the week",
        seq: 2,
        at: "2026-03-10T11:00:02Z",
      }),
      durableMessage({
        from: "planner",
        to: null,
        content: "on it",
        seq: 3,
        at: "2026-03-10T11:00:03Z",
      }),
    ]);
    const snap = getChatState();
    expect(snap.threads.planner?.map((m) => m.content)).toEqual([
      "plan the week",
      "on it",
    ]);
    expect(snap.threads.planner?.every((m) => m.historical === true)).toBe(true);
    resetChatStore();
  });

  it("refresh keeps on-screen row keys and animates only missed rows", () => {
    resetChatStore();
    ingestLiveMessage("planner", {
      seq: 3,
      from_user: false,
      content: "on it",
      at: "2026-03-10T11:00:03Z",
    });
    const liveKey = messageKey(getChatState().threads.planner![0]!);
    hydrateThreadMessages(
      "planner",
      [
        durableMessage({ from: "planner", to: null, content: "on it", seq: 3, at: "2026-03-10T11:00:03Z" }),
        durableMessage({ from: "planner", to: null, content: "done", seq: 4, at: "2026-03-10T11:00:04Z" }),
      ],
      { live: true },
    );
    const thread = getChatState().threads.planner!;
    expect(thread.map((m) => m.content)).toEqual(["on it", "done"]);
    expect(messageKey(thread[0]!)).toBe(liveKey);
    expect(thread[1]!.historical).toBeUndefined();
    resetChatStore();
  });

  it("refresh adopts an in-flight send instead of duplicating it", () => {
    resetChatStore();
    addOptimistic("planner", "ship it");
    const pendingKey = messageKey(getChatState().threads.planner![0]!);
    hydrateThreadMessages(
      "planner",
      [durableMessage({ from: null, to: "planner", content: "ship it", seq: 7, at: "2026-03-10T11:00:07Z" })],
      { live: true },
    );
    const thread = getChatState().threads.planner!;
    expect(thread).toHaveLength(1);
    expect(thread[0]!.seq).toBe(7);
    expect(messageKey(thread[0]!)).toBe(pendingKey);
    resetChatStore();
  });

  it("clearLiveChat drops optimistic rows but keeps durable history", () => {
    resetChatStore();
    hydrateThreadMessages("planner", [
      durableMessage({
        from: null,
        to: "planner",
        content: "kept",
        seq: 1,
        at: "2026-03-10T11:00:00Z",
      }),
    ]);
    upsertConversation({
      agent_id: "planner",
      agent_name: "Planner",
      last_message: "kept",
      last_at: "2026-03-10T11:00:00Z",
      from_user: true,
    });
    addOptimistic("planner", "pending send");
    expect(getChatState().threads.planner?.some((m) => m.pending)).toBe(true);
    clearLiveChat();
    expect(getChatState().threads.planner?.map((m) => m.content)).toEqual(["kept"]);
    expect(getChatState().conversations).toHaveLength(1);
    resetChatStore();
  });

  it("merges durable hydrate with a live seq already present", () => {
    resetChatStore();
    ingestLiveMessage("planner", {
      seq: 2,
      from_user: true,
      content: "live first",
      at: "2026-03-10T15:00:00Z",
    });
    hydrateThreadMessages("planner", [
      durableMessage({
        from: null,
        to: "planner",
        content: "live first",
        seq: 2,
        at: "2026-03-10T15:00:00Z",
      }),
      durableMessage({
        from: "planner",
        to: null,
        content: "older durable",
        seq: 1,
        at: "2026-03-10T14:00:00Z",
      }),
    ]);
    const contents = getChatState().threads.planner?.map((m) => m.content);
    expect(contents).toEqual(["older durable", "live first"]);
    resetChatStore();
  });

  it("keeps a resolved agent name when a later upsert only has the id", () => {
    resetChatStore();
    upsertConversation({
      agent_id: "planner",
      agent_name: "Planner",
      last_message: "hi",
      last_at: "2026-03-10T11:00:00Z",
      from_user: true,
    });
    upsertConversation({
      agent_id: "planner",
      agent_name: "planner",
      last_message: "later",
      last_at: "2026-03-10T12:00:00Z",
      from_user: false,
    });
    expect(getChatState().conversations[0]!.agent_name).toBe("Planner");
    expect(getChatState().conversations[0]!.last_message).toBe("later");
    resetChatStore();
  });
});

describe("chat switching on agent replies", () => {
  const idle: Attention = { focused: true, sinceInputMs: IDLE_MS, composing: false, reading: false };
  const list = { kind: "list" } as const;

  it("switches only once you are idle and done reading", () => {
    expect(shouldSwitchChat(list, idle)).toBe(true);
    expect(shouldSwitchChat(list, { ...idle, sinceInputMs: IDLE_MS - 1 })).toBe(false);
    expect(shouldSwitchChat({ kind: "agent", agentId: "a" }, { ...idle, reading: true })).toBe(false);
  });

  it("never moves you while a draft is going, even away from the window", () => {
    expect(shouldSwitchChat(list, { ...idle, composing: true })).toBe(false);
    expect(shouldSwitchChat(list, { ...idle, composing: true, focused: false })).toBe(false);
  });

  it("switches while you are away or waiting on a Talk to Dadi hand-off", () => {
    expect(shouldSwitchChat(list, { ...idle, focused: false, sinceInputMs: 0, reading: true })).toBe(true);
    expect(shouldSwitchChat({ kind: "dadi" }, { ...idle, sinceInputMs: 0 })).toBe(true);
  });

  it("gives longer replies longer to read, within bounds", () => {
    expect(readingMs("ok")).toBe(4_000);
    expect(readingMs(Array(40).fill("word").join(" "))).toBe(10_000);
    expect(readingMs(Array(1000).fill("word").join(" "))).toBe(45_000);
  });

  it("holds messages as unread until their chat opens", () => {
    resetChatStore();
    holdAgentMessage("a");
    holdAgentMessage("a");
    holdAgentMessage("b");
    expect(getChatState().unread).toEqual({ a: 2, b: 1 });
    expect(getChatState().nudge).toBe("b");
    dismissNudge();
    expect(getChatState().nudge).toBeNull();
    expect(getChatState().unread.b).toBe(1);
    openAgent("a");
    expect(getChatState().unread).toEqual({ b: 1 });
    holdAgentMessage("b");
    openList();
    expect(getChatState().nudge).toBeNull();
    expect(getChatState().unread.b).toBe(2);
  });
});

describe("agent tree", () => {
  const planner: AgentRecord = {
    id: "planner",
    name: "Planner",
    system_prompt: "sys",
    parent_agent_id: null,
    active: true,
    running: { reasoning: false, conversation: false },
    sessions: { browsers: [], terminals: [] },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  it("roots null and dangling parents and links children to parents", () => {
    const child: AgentRecord = { ...planner, id: "child", parent_agent_id: "planner" };
    const grand: AgentRecord = { ...planner, id: "grand", parent_agent_id: "child" };
    const orphan: AgentRecord = { ...planner, id: "orphan", parent_agent_id: "missing" };
    const { nodes, edges } = agentGraph([grand, planner, child, orphan]);
    const depth = Object.fromEntries(nodes.map((n) => [n.id, n.depth]));
    expect(depth).toEqual({ planner: 0, child: 1, grand: 2, orphan: 0 });
    expect(edges.map((e) => [e.source, e.target])).toEqual([
      ["child", "grand"],
      ["planner", "child"],
    ]);
    expect(agentGraph([])).toEqual({ nodes: [], edges: [] });
  });

  it("rejects a parent cycle instead of drawing it", () => {
    const a: AgentRecord = { ...planner, id: "a", parent_agent_id: "b" };
    const b: AgentRecord = { ...planner, id: "b", parent_agent_id: "a" };
    expect(() => agentGraph([a, b])).toThrow(/cycle/);
  });

  it("marks running lanes by fill key", () => {
    expect(visualState(planner, { reasoning: true, conversation: false })).toBe(
      "reasoning",
    );
    expect(visualState(planner, { reasoning: false, conversation: true })).toBe(
      "conversation",
    );
    expect(visualState(planner, { reasoning: true, conversation: true })).toBe(
      "both",
    );
    expect(visualState({ ...planner, active: false }, undefined)).toBe("retired");
  });

  it("labels live fills and treats them as in-flight", () => {
    expect(isLiveVisual("reasoning")).toBe(true);
    expect(isLiveVisual("conversation")).toBe(true);
    expect(isLiveVisual("both")).toBe(true);
    expect(isLiveVisual("idle")).toBe(false);
    expect(isLiveVisual("retired")).toBe(false);
    expect(
      statusLabel("reasoning", { reasoning: true, conversation: false }),
    ).toMatch(/working/);
    expect(
      statusLabel("both", { reasoning: true, conversation: true }),
    ).toMatch(/thinking \+ working/);
    expect(
      statusLabel("idle", { reasoning: false, conversation: false }),
    ).toBe("Idle");
  });

  /** Nine top-level threads; one manager with six workers, like the live forest. */
  const forest = (): AgentRecord[] => {
    const roots = Array.from({ length: 9 }, (_, i) => ({ ...planner, id: `r${i}` }));
    const workers = Array.from({ length: 6 }, (_, i) => ({
      ...planner,
      id: `w${i}`,
      parent_agent_id: "r0",
    }));
    return [...roots, ...workers];
  };

  const settle = (sim: ReturnType<typeof createAgentSimulation>) => {
    for (let i = 0; i < 400; i++) {
      sim.tick();
    }
  };

  it("spreads roots over a sphere and puts workers on an outer shell", () => {
    const sim = createAgentSimulation();
    const { nodes: records, edges } = agentGraph(forest());
    const { nodes } = syncForceSimulation(sim, records, edges);
    settle(sim);
    const dist = (n: { x: number; y: number; z: number }) => Math.hypot(n.x, n.y, n.z);
    const roots = nodes.filter((n) => n.depth === 0);
    const workers = nodes.filter((n) => n.depth === 1);
    for (const r of roots) {
      expect(dist(r)).toBeGreaterThan(shellRadius(0) * 0.6);
      expect(dist(r)).toBeLessThan(shellRadius(1));
    }
    const meanRoot = roots.reduce((a, r) => a + dist(r), 0) / roots.length;
    for (const w of workers) {
      expect(dist(w)).toBeGreaterThan(meanRoot);
    }
    for (const axis of ["x", "y", "z"] as const) {
      const values = roots.map((r) => r[axis]);
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(shellRadius(0) * 0.5);
    }
    const manager = nodes.find((n) => n.id === "r0")!;
    const nearest = (w: (typeof nodes)[number]) =>
      roots.reduce((best, r) =>
        Math.hypot(w.x - r.x, w.y - r.y, w.z - r.z) <
        Math.hypot(w.x - best.x, w.y - best.y, w.z - best.z)
          ? r
          : best,
      );
    const underManager = workers.filter((w) => nearest(w) === manager).length;
    expect(underManager).toBeGreaterThanOrEqual(4);
  });

  it("grows a newly spawned worker out of its parent", () => {
    const sim = createAgentSimulation();
    const agents = forest();
    const first = agentGraph(agents);
    syncForceSimulation(sim, first.nodes, first.edges);
    settle(sim);
    const grown = agentGraph([...agents, { ...planner, id: "fresh", parent_agent_id: "r3" }]);
    const { nodes } = syncForceSimulation(sim, grown.nodes, grown.edges);
    const parent = nodes.find((n) => n.id === "r3")!;
    const fresh = nodes.find((n) => n.id === "fresh")!;
    expect(Math.hypot(fresh.x - parent.x, fresh.y - parent.y, fresh.z - parent.z)).toBeLessThan(7);
  });
});

describe("graph reveal schedule", () => {
  const node = (id: string, degree: number) => ({ id, degree });
  const link = (a: string, b: string) => ({ source: { id: a }, target: { id: b } });
  const nodes = [
    node("hub", 3),
    node("seed", 1),
    node("a", 2),
    node("b", 1),
    node("c", 2),
    node("leaf", 1),
    node("island", 0),
  ];
  const links = [
    link("hub", "a"),
    link("hub", "b"),
    link("hub", "c"),
    link("seed", "c"),
    link("a", "leaf"),
  ];

  it("opens with the seeds in place, most-connected first", () => {
    const schedule = revealSchedule(nodes, links, new Set(["seed", "hub"]));
    const order = [...schedule.keys()];
    expect(order.slice(0, 2)).toEqual(["hub", "seed"]);
    expect(schedule.get("hub")).toEqual({ delay: 0, anchor: null });
    expect(schedule.get("seed")!.anchor).toBeNull();
  });

  it("sprouts every other node from an earlier neighbor, after it", () => {
    const schedule = revealSchedule(nodes, links, new Set(["seed", "hub"]));
    const order = [...schedule.keys()];
    const adjacent = (x: string, y: string) =>
      links.some(
        (l) => (l.source.id === x && l.target.id === y) || (l.source.id === y && l.target.id === x),
      );
    for (const [id, step] of schedule) {
      if (step.anchor === null) {
        continue;
      }
      expect(adjacent(id, step.anchor)).toBe(true);
      expect(order.indexOf(step.anchor)).toBeLessThan(order.indexOf(id));
      expect(step.delay).toBeGreaterThan(schedule.get(step.anchor)!.delay);
    }
    expect(schedule.get("leaf")!.anchor).toBe("a");
  });

  it("still reveals disconnected nodes, in place, and keeps the bloom short", () => {
    const schedule = revealSchedule(nodes, links, new Set(["seed", "hub"]));
    expect(schedule.size).toBe(nodes.length);
    expect(schedule.get("island")!.anchor).toBeNull();
    expect(Math.max(...[...schedule.values()].map((s) => s.delay))).toBeLessThan(2);
  });
});

describe("memory network simulation", () => {
  const now = "2026-01-01T00:00:00Z";
  const record = (id: string, kind: "person" | "memory" | "place" | "plan") => ({
    id,
    kind,
    title: id,
    body: null,
    occurred_at: null,
    expires_at: null,
    access_count: 0,
    last_accessed_at: null,
    source: "manual" as const,
    agent_id: null,
    created_at: now,
    updated_at: now,
  });
  const edge = (id: string, source: string, target: string) => ({
    id,
    source,
    target,
    type: "about",
    confidence: 1,
  });

  /** Five people, each with six memories, some memories shared between people. */
  const community = (): GraphData => {
    const nodes = [];
    const edges = [];
    for (let p = 0; p < 5; p++) {
      nodes.push(record(`p${p}`, "person"));
      for (let m = 0; m < 6; m++) {
        nodes.push(record(`m${p}-${m}`, "memory"));
        edges.push(edge(`e${p}-${m}`, `p${p}`, `m${p}-${m}`));
      }
      edges.push(edge(`share${p}`, `p${p}`, `m${(p + 1) % 5}-0`));
    }
    return { nodes, edges };
  };

  const settle = (sim: ReturnType<typeof createMemorySimulation>) => {
    for (let i = 0; i < 300; i++) {
      sim.tick();
    }
  };

  it("spreads the network through all three axes, not a plane", () => {
    const sim = createMemorySimulation();
    const { nodes } = syncForceSimulation(sim, community().nodes, community().edges);
    settle(sim);
    const spread = (axis: "x" | "y" | "z") => {
      const values = nodes.map((n) => n[axis]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
    };
    const spreads = [spread("x"), spread("y"), spread("z")];
    for (const s of spreads) {
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThan(Math.max(...spreads) * 0.4);
    }
  });

  it("grows new nodes out of the node they attach to without moving the rest", () => {
    const sim = createMemorySimulation();
    const data = community();
    const { nodes: before } = syncForceSimulation(sim, data.nodes, data.edges);
    settle(sim);
    const snapshot = new Map(before.map((n) => [n.id, [n.x, n.y, n.z]]));
    const anchor = before.find((n) => n.id === "p2")!;

    const grown = mergeGraph(data, {
      nodes: [record("fresh", "memory")],
      edges: [
        {
          id: "e-fresh",
          src_id: "p2",
          dst_id: "fresh",
          type: "about",
          properties: {},
          confidence: 1,
          created_at: now,
          valid_from: now,
          valid_to: null,
        },
      ],
    });
    const { nodes: after } = syncForceSimulation(sim, grown.nodes, grown.edges);

    const fresh = after.find((n) => n.id === "fresh")!;
    expect(Math.hypot(fresh.x - anchor.x, fresh.y - anchor.y, fresh.z - anchor.z)).toBeLessThan(
      7,
    );
    for (const n of after) {
      if (n.id !== "fresh") {
        expect([n.x, n.y, n.z]).toEqual(snapshot.get(n.id));
      }
    }
    expect(sim.alpha()).toBeGreaterThanOrEqual(0.5);
  });

  it("keeps node identity across polls and drops edges to pruned nodes", () => {
    const sim = createMemorySimulation();
    const data = community();
    const { nodes: first } = syncForceSimulation(sim, data.nodes, data.edges);
    settle(sim);
    const alphaSettled = sim.alpha();

    const { nodes: again } = syncForceSimulation(sim, data.nodes, data.edges);
    expect(again.find((n) => n.id === "p0")).toBe(first.find((n) => n.id === "p0"));
    expect(sim.alpha()).toBe(alphaSettled);

    const pruned = mergeGraph(
      { nodes: data.nodes.filter((n) => n.id !== "m0-1"), edges: data.edges },
      { nodes: [], edges: [] },
    );
    expect(pruned.edges.some((e) => e.target === "m0-1")).toBe(false);
  });
});

describe("agent host sessions", () => {
  it("picks the newest live browser and terminal", () => {
    expect(pickLiveBrowser([10, 12, 11], [{ id: 10 }, { id: 11 }])).toBe(11);
    expect(pickLiveBrowser([10], [{ id: 12 }])).toBeNull();
    expect(
      pickLiveTerminal(
        [
          { id: "t1", last_command: "ls" },
          { id: "t2", last_command: "pwd" },
        ],
        [{ id: "t2" }],
      ),
    ).toEqual({ id: "t2", last_command: "pwd" });
    expect(
      hasRememberedSessions({ browsers: [], terminals: [] }),
    ).toBe(false);
    expect(
      hasRememberedSessions({
        browsers: [10],
        terminals: [],
      }),
    ).toBe(true);
  });
});

describe("timeline dates", () => {
  it("weeks start Monday", () => {
    const wednesday = new Date(2026, 0, 7);
    const monday = startOfWeek(wednesday);
    expect(monday.getDay()).toBe(1);
    expect(isSameDay(addDays(monday, 2), wednesday)).toBe(true);
  });

  it("iso bounds are UTC strings", () => {
    const from = new Date(2026, 0, 1);
    const to = new Date(2026, 0, 2);
    const bounds = toIsoBounds(from, to);
    expect(bounds.occurred_from).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(bounds.occurred_to).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("sse helpers", () => {
  it("parses data events and keeps remainder", () => {
    const events: unknown[] = [];
    const rest = consumeSseBuffer(
      'data: {"type":"message"}\n\ndata: {"type":"x"',
      (data: unknown) => events.push(data),
    );
    expect(events).toEqual([{ type: "message" }]);
    expect(rest).toBe('data: {"type":"x"');
  });

  it("throws on a malformed payload instead of skipping it", () => {
    const events: unknown[] = [];
    expect(() =>
      consumeSseBuffer('data: {"ok":true}\n\ndata: not-json\n\n', (data: unknown) =>
        events.push(data),
      ),
    ).toThrow(SyntaxError);
    expect(events).toEqual([{ ok: true }]);
  });

  it("joins urls", () => {
    expect(joinUrl("http://hath.dadi/", "/events")).toBe(
      "http://hath.dadi/events",
    );
  });
});

describe("mesh constants", () => {
  it("are fixed .dadi names without env fallbacks", () => {
    expect(YAAD).toBe("http://yaad.dadi");
    expect(HATH).toBe("http://hath.dadi");
    expect(NAS).toBe("http://nas.dadi");
    expect(CHAAVI).toBe("http://chaavi.dadi");
    expect(CHAAVI_VAULT).toBe("https://chaavi.dadi");
    expect(GHAR).toBe("http://ghar.dadi");
  });
});

describe("nas log services", () => {
  it("calls GET /logs/services", async () => {
    const calls: Array<{ path: string; method: string }> = [];
    const transport = {
      request: async (opts: { path: string; method: string }) => {
        calls.push({ path: opts.path, method: opts.method });
        return { services: ["chaavi", "nas"] };
      },
    } as unknown as Transport;
    const client = createNasClient(transport, NAS);
    const got = await client.listLogServices();
    expect(got.services).toEqual(["chaavi", "nas"]);
    expect(calls).toEqual([{ path: "/logs/services", method: "GET" }]);
  });
});

describe("chaavi client", () => {
  it("calls health, catalog, CRUD, and reveal routes", async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = [];
    const transport = {
      request: async (opts: {
        path: string;
        method: string;
        body?: unknown;
      }) => {
        calls.push({
          path: opts.path,
          method: opts.method,
          body: opts.body,
        });
        if (opts.path === "/health") {
          return { status: "ok", vault: "ready" };
        }
        if (opts.path.endsWith("/login")) {
          return { username: "ada", password: "secret" };
        }
        if (opts.method === "DELETE") {
          return undefined;
        }
        return {
          id: "11111111-1111-1111-1111-111111111111",
          name: "GitHub",
          kind: "login",
          username: "octocat",
          uris: ["https://github.com"],
          hasPasskey: false,
        };
      },
    } as unknown as Transport;
    const client = createChaaviClient(transport, CHAAVI);
    await client.getHealth();
    await client.listItems({ q: "bank", uri: "https://ex.test", kind: "login" });
    await client.listItems();
    await client.getItem("11111111-1111-1111-1111-111111111111");
    await client.createLogin({
      name: "X",
      username: "u",
      password: "p",
    });
    await client.updateLogin("11111111-1111-1111-1111-111111111111", {
      name: "Y",
    });
    await client.revealLogin("11111111-1111-1111-1111-111111111111");
    await client.deleteItem("11111111-1111-1111-1111-111111111111");
    expect(calls).toEqual([
      { path: "/health", method: "GET", body: undefined },
      {
        path: "/v1/items?q=bank&uri=https%3A%2F%2Fex.test&kind=login",
        method: "GET",
        body: undefined,
      },
      { path: "/v1/items", method: "GET", body: undefined },
      {
        path: "/v1/items/11111111-1111-1111-1111-111111111111",
        method: "GET",
        body: undefined,
      },
      {
        path: "/v1/logins",
        method: "POST",
        body: { name: "X", username: "u", password: "p" },
      },
      {
        path: "/v1/items/11111111-1111-1111-1111-111111111111",
        method: "PATCH",
        body: { name: "Y" },
      },
      {
        path: "/v1/items/11111111-1111-1111-1111-111111111111/login",
        method: "POST",
        body: undefined,
      },
      {
        path: "/v1/items/11111111-1111-1111-1111-111111111111",
        method: "DELETE",
        body: undefined,
      },
    ]);
  });
});

describe("ghar client", () => {
  it("lists devices and posts switch toggles", async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = [];
    const transport = {
      request: async (opts: {
        path: string;
        method: string;
        body?: unknown;
      }) => {
        calls.push({
          path: opts.path,
          method: opts.method,
          body: opts.body,
        });
        if (opts.path === "/devices") {
          return { devices: [] };
        }
        return undefined;
      },
    } as unknown as Transport;
    const { createGharClient } = await import("./shared/api/ghar");
    const client = createGharClient(transport, GHAR);
    await client.listDevices();
    await client.toggleSwitch("dev-1");
    expect(calls).toEqual([
      { path: "/devices", method: "GET", body: undefined },
      {
        path: "/devices/dev-1/command",
        method: "POST",
        body: {
          capability: "switchable",
          params: { state: "toggle" },
          cause: "user",
        },
      },
    ]);
  });

  it("lists rooms, moves a device, and starts commissioning", async () => {
    const calls: Array<{ path: string; method: string; body?: unknown }> = [];
    const transport = {
      request: async (opts: {
        path: string;
        method: string;
        body?: unknown;
      }) => {
        calls.push({
          path: opts.path,
          method: opts.method,
          body: opts.body,
        });
        if (opts.path === "/rooms" && opts.method === "GET") {
          return { rooms: [] };
        }
        if (opts.path === "/rooms") {
          return { id: "room-1", name: "kitchen" };
        }
        if (opts.path === "/commission") {
          return { job_id: "job-1" };
        }
        if (opts.path.startsWith("/commission/")) {
          return {
            id: "job-1",
            status: "pending",
            node_id: null,
            device_ids: null,
            error: null,
            started_at: "2026-01-01T00:00:00.000Z",
            finished_at: null,
          };
        }
        return { id: "dev-1" };
      },
    } as unknown as Transport;
    const { createGharClient } = await import("./shared/api/ghar");
    const client = createGharClient(transport, GHAR);
    await client.listRooms();
    await client.createRoom("kitchen");
    await client.moveDevice("dev-1", "room-1");
    await client.renameDevice("dev-1", "Desk lamp");
    await client.startCommission({
      code: "34970112332",
      room_id: "room-1",
      radio: "network",
    });
    await client.getCommission("job-1");
    await client.setBrightness("dev-1", 40);
    await client.setHue("dev-1", 20, 200);
    await client.setColorTemp("dev-1", 250);
    await client.identify("dev-1");
    expect(calls.map((call) => [call.method, call.path, call.body])).toEqual([
      ["GET", "/rooms", undefined],
      ["POST", "/rooms", { name: "kitchen" }],
      ["PATCH", "/devices/dev-1", { room: "room-1" }],
      ["PATCH", "/devices/dev-1", { name: "Desk lamp" }],
      [
        "POST",
        "/commission",
        { code: "34970112332", room_id: "room-1", radio: "network" },
      ],
      ["GET", "/commission/job-1", undefined],
      [
        "POST",
        "/devices/dev-1/command",
        { capability: "dimmable", params: { level: 40 }, cause: "user" },
      ],
      [
        "POST",
        "/devices/dev-1/command",
        {
          capability: "colorable",
          params: { hue: 20, saturation: 200 },
          cause: "user",
        },
      ],
      [
        "POST",
        "/devices/dev-1/command",
        {
          capability: "colorable",
          params: { color_temp: 250 },
          cause: "user",
        },
      ],
      ["POST", "/devices/dev-1/identify", undefined],
    ]);
  });
});

describe("runtime outside Tauri", () => {
  it("selects browser transport", async () => {
    const { isTauriRuntime, selectTransportKind } = await import(
      "./shared/api/runtime"
    );
    expect(isTauriRuntime()).toBe(false);
    expect(selectTransportKind()).toBe("browser");
  });

  it("detectDesktopOs is null outside Tauri", async () => {
    const { detectDesktopOs } = await import("./target");
    expect(detectDesktopOs()).toBeNull();
  });
});

describe("transport selection", () => {
  it("initApi wires BrowserTransport outside Tauri", async () => {
    const api = await import("./shared/api");
    await api.initApi();
    expect(api.usingMesh).toBe(false);
    expect(api.selectTransportKind()).toBe("browser");
    expect(api.transport.connectionState()).toBe("disconnected");
    expect(typeof api.chaavi.getHealth).toBe("function");
    expect(typeof api.ghar.listDevices).toBe("function");
  });

  it("selects the mesh transport when Tauri globals are present", async () => {
    const g = globalThis as typeof globalThis & { isTauri?: boolean };
    g.isTauri = true;
    try {
      const { selectTransportKind, isTauriRuntime } = await import(
        "./shared/api/runtime"
      );
      expect(isTauriRuntime()).toBe(true);
      expect(selectTransportKind()).toBe("mesh");
    } finally {
      delete g.isTauri;
    }
  });
});

describe("countNoun", () => {
  it("uses singular only when count is 1", async () => {
    const { countNoun } = await import("./shared/lib/ux/plural");
    expect(countNoun(1, "PASSWORD")).toBe("PASSWORD");
    expect(countNoun(0, "PASSWORD")).toBe("PASSWORDS");
    expect(countNoun(2, "PASSWORD")).toBe("PASSWORDS");
    expect(countNoun(1, "MEMORY", "MEMORIES")).toBe("MEMORY");
    expect(countNoun(3, "MEMORY", "MEMORIES")).toBe("MEMORIES");
    expect(countNoun(1, "PERSON", "PEOPLE")).toBe("PERSON");
    expect(countNoun(0, "PERSON", "PEOPLE")).toBe("PEOPLE");
  });
});

describe("searchHouse", () => {
  const bedroom = { id: "r1", name: "Ankur's Room" };
  const kitchen = { id: "r2", name: "Kitchen" };
  const unplaced = { id: "r0", name: "unassigned" };
  const device = (id: string, name: string, room: { id: string; name: string }, product: string | null = null): GharDevice => ({
    id,
    name,
    product_name: product,
    room,
    capabilities: [],
    online: true,
    last_seen_at: null,
    state: {},
  });
  const desk = device("d1", "Desk Lamp", bedroom, "Smart RGBTW Bulb");
  const nightstand = device("d2", "Left Nightstand Lamp", bedroom);
  const kettle = device("d3", "Kettle Plug", kitchen, "Smart Plug");
  const rooms = [unplaced, bedroom, kitchen];
  const devices = [desk, nightstand, kettle];

  it("shows every room and device with no match count while the query is blank", () => {
    const result = searchHouse("  ", rooms, devices);
    expect(result.rooms.map((r) => r.room.id)).toEqual(["r0", "r1", "r2"]);
    expect(result.rooms[1]?.listed).toEqual([desk, nightstand]);
    expect(result.matches).toBeNull();
    expect(result.lonelyDevice).toBeNull();
  });

  it("keeps only rooms holding a matching device, listing just those devices", () => {
    const result = searchHouse("desk", rooms, devices);
    expect(result.rooms).toEqual([{ room: bedroom, listed: [desk] }]);
    expect(result.matches).toBe(1);
    expect(result.lonelyDevice).toBe(desk);
  });

  it("matches product names case-insensitively", () => {
    const result = searchHouse("SMART PLUG", rooms, devices);
    expect(result.rooms).toEqual([{ room: kitchen, listed: [kettle] }]);
  });

  it("keeps all devices in a room whose name matches and never offers a room to Enter", () => {
    const result = searchHouse("kitchen", rooms, devices);
    expect(result.rooms).toEqual([{ room: kitchen, listed: [kettle] }]);
    expect(result.matches).toBe(1);
    expect(result.lonelyDevice).toBeNull();
  });

  it("finds the unassigned room by its shown title", () => {
    const result = searchHouse("unplaced", rooms, devices);
    expect(result.rooms).toEqual([{ room: unplaced, listed: [] }]);
  });

  it("returns no rooms and a zero count when nothing matches", () => {
    const result = searchHouse("toaster", rooms, devices);
    expect(result.rooms).toEqual([]);
    expect(result.matches).toBe(0);
  });
});

describe("buildActivity", () => {
  const log = (
    partial: Partial<LogRecord> & Pick<LogRecord, "id" | "event" | "payload" | "created_at">,
  ): LogRecord => ({ agent_id: "coding-manager", lane: "conversation", ...partial });
  const at = (seconds: number) => new Date(Date.UTC(2026, 9, 2, 17, 40, 0) + seconds * 1000).toISOString();
  const response = (id: string, lane: Lane, seconds: number, content: unknown[], stop = "tool_use") =>
    log({ id, lane, event: "response", payload: { content, stop_reason: stop }, created_at: at(seconds) });
  const result = (id: string, lane: Lane, seconds: number, toolUseId: string, name: string, isError = false) =>
    log({ id, lane, event: "tool_result", payload: { tool_use_id: toolUseId, name, content: "ok", is_error: isError }, created_at: at(seconds) });
  const message = (id: string, seconds: number, payload: Record<string, unknown>) =>
    log({ id, event: "message", payload: { content: "hi", ...payload }, created_at: at(seconds) });
  const tool = (id: string, name: string, input: Record<string, unknown> = {}) => ({ type: "tool_use", id, name, input });

  it("keeps a wake's interleaved lanes in one timeline, hiding yield and delivered dispatches", () => {
    const logs = [
      message("m-in", 0, { direction: "receive", from_agent_id: null }),
      response("c1", "conversation", 1, [{ type: "thinking", thinking: "Okay.\n\n**Steering Reasoning**\n\nIt should close t5." }, tool("s1", "steer_reasoning")]),
      result("c1r", "conversation", 1.1, "s1", "steer_reasoning"),
      response("r1", "reasoning", 2, [{ type: "thinking", thinking: "Close the terminal." }, tool("t1", "terminal_close", { terminal_id: "t5" })]),
      result("r1r", "reasoning", 2.1, "t1", "terminal_close", true),
      response("c2", "conversation", 3, [{ type: "thinking", thinking: "Reply." }, tool("d1", "dispatch_message"), tool("y1", "yield")]),
      message("m-out", 3.1, { direction: "send", to_agent_id: null }),
      result("c2r", "conversation", 3.2, "d1", "dispatch_message"),
      result("c2y", "conversation", 3.3, "y1", "yield"),
      response("r2", "reasoning", 4, [{ type: "text", text: "Done." }, tool("y2", "yield")]),
    ].reverse();

    const wakes = buildActivity(logs);

    expect(wakes).toHaveLength(1);
    const [wake] = wakes;
    expect(wake!.key).toBe("m-in");
    expect(wake!.lanes).toEqual(["conversation", "reasoning"]);
    expect(wake!.toolCount).toBe(3);
    expect(wake!.errorCount).toBe(1);
    expect(wake!.steps.map((step) => step.key)).toEqual(["m-in", "c1", "r1", "m-out", "r2"]);
    const [, steer, close] = wake!.steps;
    expect(steer).toMatchObject({ kind: "turn", lane: "conversation", thought: { gist: "Steering Reasoning" } });
    expect(close).toMatchObject({ kind: "turn", lane: "reasoning", thought: { gist: "Close the terminal." } });
    expect(close!.kind === "turn" && close!.parts[0]).toMatchObject({
      kind: "tool",
      tool: { name: "terminal_close", result: { isError: true } },
    });
  });

  it("starts a new wake when a message or call arrives after both lanes stopped, or after a long gap", () => {
    const logs = [
      message("a", 0, { direction: "receive", from_agent_id: "browser-manager" }),
      response("a1", "conversation", 1, [{ type: "text", text: "on it" }], "end_turn"),
      response("b1", "reasoning", 30, [tool("b1t", "terminal_list")]),
      message("c", 40, { direction: "receive", from_agent_id: "career-manager", schedule_id: "s-1" }),
      response("d1", "reasoning", 40 + 11 * 60, [{ type: "text", text: "later" }]),
    ].reverse();

    const wakes = buildActivity(logs);

    expect(wakes.map((wake) => wake.key)).toEqual(["d1", "b1", "a"]);
    expect(wakes[1]!.steps.map((step) => step.key)).toEqual(["b1", "c"]);
    expect(wakes[1]!.steps[1]).toMatchObject({ kind: "message", peer: "career-manager", scheduled: true });
  });

  it("keeps the lane a handoff wakes in the wake that handed off", () => {
    const logs = [
      message("in", 0, { direction: "receive", from_agent_id: "cse-431-specialist" }),
      response("c1", "conversation", 1, [tool("s1", "steer_reasoning", { instruction: "spawn it" }), tool("y1", "yield")]),
      result("c1r", "conversation", 1.1, "s1", "steer_reasoning"),
      response("r1", "reasoning", 8, [tool("l1", "list_tools")]),
    ].reverse();

    expect(buildActivity(logs).map((wake) => wake.steps.map((step) => step.key))).toEqual([["in", "c1", "r1"]]);
  });

  it("starts a new wake when a steered lane failed instead of running", () => {
    const logs = [
      message("ask", 0, { direction: "receive", from_agent_id: null }),
      response("c1", "conversation", 1, [tool("s1", "steer_reasoning"), tool("y1", "yield")]),
      result("c1r", "conversation", 1.1, "s1", "steer_reasoning"),
      message("dead", 3, {
        direction: "send",
        to_agent_id: null,
        content: "[runtime] My reasoning lane failed and this wake stopped before finishing: credit balance too low.",
      }),
      message("again", 60, { direction: "receive", from_agent_id: null }),
    ].reverse();

    const wakes = buildActivity(logs);

    expect(wakes.map((wake) => wake.key)).toEqual(["again", "ask"]);
    expect(wakes[1]!.steps[2]).toMatchObject({ key: "dead", wakeStopped: true });
  });

  it("drops calls that only yield and wakes with nothing left to show", () => {
    const wakes = buildActivity([
      response("y", "conversation", 0, [{ type: "thinking", thinking: "nothing to do" }, tool("y1", "yield")]),
    ]);

    expect(wakes).toEqual([]);
  });
});

describe("thoughtGist", () => {
  it("takes a summary's bold heading over its filler opening", () => {
    expect(thoughtGist("Okay, here's my take.\n\n**Message Handling Complete**\n\nAll sent.")).toBe("Message Handling Complete");
  });

  it("takes plain thinking's first line", () => {
    expect(thoughtGist("Let me check the terminal list.\nThen report.")).toBe("Let me check the terminal list.");
  });
});

describe("focusSet", () => {
  const link = (source: string, target: string) => ({ source: { id: source }, target: { id: target } });
  const tree = [
    link("root", "a"),
    link("a", "a1"),
    link("a", "a2"),
    link("a1", "a1x"),
    link("root", "b"),
  ];

  it("lights nothing without a focus", () => {
    const set = focusSet(tree, null, "lineage");
    expect(set.nodes.size).toBe(0);
    expect(set.links.size).toBe(0);
  });

  it("lineage lights the parent link and everything downstream, not siblings", () => {
    const set = focusSet(tree, "a", "lineage");
    expect([...set.nodes].sort()).toEqual(["a", "a1", "a1x", "a2", "root"]);
    expect([...set.links.keys()].sort()).toEqual([0, 1, 2, 3]);
  });

  it("lineage sweeps each generation after the one above it", () => {
    const set = focusSet(tree, "a", "lineage");
    expect(set.links.get(0)!.after).toBe(-1);
    expect(set.links.get(1)!.after).toBe(-1);
    expect(set.links.get(3)!.after).toBe(set.links.get(1)!.far);
  });

  it("lineage sweeps from the focus toward the parent", () => {
    const set = focusSet(tree, "a", "lineage");
    expect(set.links.get(0)).toMatchObject({ near: 1, far: 0 });
  });

  it("neighbors lights every touching link in either direction, one hop only", () => {
    const set = focusSet(tree, "a", "neighbors");
    expect([...set.nodes].sort()).toEqual(["a", "a1", "a2", "root"]);
    expect([...set.links.values()].every((l) => l.after === -1)).toBe(true);
  });
});

describe("inHoverZone", () => {
  const panel = { left: 200, top: 80, right: 500, bottom: 480 };
  const node = { x: 150, y: 100 };
  const radius = 12;

  it("counts the node, the panel, and the whole path between them as inside", () => {
    expect(inHoverZone(150, 100, panel, node, radius)).toBe(true);
    expect(inHoverZone(300, 400, panel, node, radius)).toBe(true);
    expect(inHoverZone(175, 110, panel, node, radius)).toBe(true);
    expect(inHoverZone(190, 300, panel, node, radius)).toBe(true);
  });

  it("counts points away from the node and panel as outside", () => {
    expect(inHoverZone(150, 300, panel, node, radius)).toBe(false);
    expect(inHoverZone(100, 100, panel, node, radius)).toBe(false);
    expect(inHoverZone(600, 100, panel, node, radius)).toBe(false);
  });

  it("works with the panel flipped to the node's left", () => {
    const left = { left: 0, top: 80, right: 300, bottom: 480 };
    const at = { x: 360, y: 100 };
    expect(inHoverZone(330, 250, left, at, radius)).toBe(true);
    expect(inHoverZone(380, 250, left, at, radius)).toBe(false);
  });
});

describe("connectionsOf", () => {
  const node = (id: string, kind: "person" | "place" | "memory" | "plan", title: string) =>
    ({ id, kind, title }) as MemoryLink["source"];
  const me = node("me", "memory", "Dinner");
  const link = (id: string, source: MemoryLink["source"], target: MemoryLink["source"], type: string) =>
    ({ id, source, target, type, confidence: 1 }) as MemoryLink;
  const links = [
    link("e1", me, node("p2", "place", "Cafe"), "happened_at"),
    link("e2", node("b", "person", "Bea"), me, "attended"),
    link("e3", me, node("a", "person", "Arun"), "with"),
    link("e4", node("x", "person", "Xi"), node("y", "place", "Park"), "visited"),
  ];

  it("lists every neighbor in either direction and nothing else", () => {
    expect(connectionsOf("me", links).map((c) => c.node.id).sort()).toEqual(["a", "b", "p2"]);
  });

  it("orders people first, then by title, and records direction", () => {
    const listed = connectionsOf("me", links);
    expect(listed.map((c) => c.node.title)).toEqual(["Arun", "Bea", "Cafe"]);
    expect(listed.map((c) => c.outgoing)).toEqual([true, false, true]);
  });
});

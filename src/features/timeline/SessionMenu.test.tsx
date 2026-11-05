// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionGlobalConfig } from "motion/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timeline as fixtureTimeline } from "../../dev/fixtures/timeline";
import { timeline } from "../../shared/api";
import type { Action } from "../../shared/interaction/actions";
import type { AgentRecord } from "../../types/hath";
import type { TimelineItem } from "../../types/timeline";
import { planActions, type PlanActionDeps } from "./planActions";
import { SessionMenu } from "./SessionMenu";

vi.mock("../../shared/api", () => ({
  timeline: { setOutcome: vi.fn(() => Promise.resolve({})) },
}));
vi.mock("../../shared/hooks/useEvents", () => ({
  AGENTS_QUERY_KEY: ["hath", "agents"],
}));
vi.mock("../../store/chat", () => ({ openAgent: vi.fn() }));
vi.mock("../../store/dock", () => ({ requestDock: vi.fn() }));
vi.mock("../../store/toasts", () => ({
  pushToast: vi.fn(),
  failureTarget: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

let root: Root;
let host: HTMLElement;
let client: QueryClient;
let item: TimelineItem;

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  item = fixtureTimeline("normal", {
    from: new Date(2026, 9, 28).toISOString(),
    to: new Date(2026, 9, 29).toISOString(),
    view: "planner",
  }).items[0]!;
});

afterEach(() => {
  act(() => root.unmount());
  client.clear();
  host.remove();
});

/** The actions of a session with every dependency a spy. */
function actionsOf(session: TimelineItem, overrides: Partial<PlanActionDeps> = {}) {
  const deps: PlanActionDeps = {
    keeper: null,
    setDone: vi.fn(() => Promise.resolve()),
    message: vi.fn(),
    tellDadi: vi.fn(),
    showInYaad: vi.fn(),
    ...overrides,
  };
  const rows = planActions(session, deps).filter((row): row is Action => row !== "separator");
  return { rows, deps, byId: (id: string) => rows.find((row) => row.id === id) };
}

describe("plan actions", () => {
  it("marks only the selected occurrence done, and takes the mark back", () => {
    const open = actionsOf({ ...item, outcome: null });
    void open.byId("mark-done")!.run();
    expect(open.deps.setDone).toHaveBeenCalledWith(expect.objectContaining({ id: item.id }), true);

    const done = actionsOf({ ...item, outcome: "done" });
    expect(done.byId("mark-done")!.label).toBe("Take back done");
    void done.byId("mark-done")!.run();
    expect(done.deps.setDone).toHaveBeenCalledWith(expect.objectContaining({ id: item.id }), false);
  });

  it("offers no outcome write for a cancelled session", () => {
    const { byId } = actionsOf({ ...item, state: "cancelled" });
    expect(byId("mark-done")).toBeUndefined();
  });

  it("messages the keeper, or Dadi when none still runs", () => {
    const dadi = actionsOf(item);
    expect(dadi.byId("message")!.label).toBe("Tell Dadi");
    void dadi.byId("message")!.run();
    expect(dadi.deps.tellDadi).toHaveBeenCalledOnce();

    const keeper = { id: "a1", name: "Career Manager" } as AgentRecord;
    const kept = actionsOf(item, { keeper });
    expect(kept.byId("message")!.label).toBe("Message Career Manager");
    void kept.byId("message")!.run();
    expect(kept.deps.message).toHaveBeenCalledWith("a1");
  });

  it("shows the session in Yaad and offers details only where a card exists", () => {
    const plain = actionsOf(item);
    void plain.byId("show-in-yaad")!.run();
    expect(plain.deps.showInYaad).toHaveBeenCalledWith(item.id);
    expect(plain.byId("details")).toBeUndefined();

    const details = vi.fn();
    const carded = actionsOf(item, { details });
    void carded.byId("details")!.run();
    expect(details).toHaveBeenCalledOnce();
  });
});

describe("session menu", () => {
  function mount(session = item) {
    const onClose = vi.fn();
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <SessionMenu item={session} anchor={new DOMRect(50, 50, 100, 30)} onClose={onClose} />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    return onClose;
  }

  it("marks the occurrence done from its first row and closes", async () => {
    const onClose = mount({ ...item, outcome: null });
    await act(async () => (document.querySelector("[role=menuitem]") as HTMLButtonElement).click());
    expect(timeline.setOutcome).toHaveBeenCalledWith({ plan_id: item.id, occurrence_date: item.occurrence_date, outcome: "done" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("dismisses with Escape", () => {
    const onClose = mount();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

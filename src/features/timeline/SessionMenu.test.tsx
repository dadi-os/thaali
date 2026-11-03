// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timeline as fixtureTimeline } from "../../dev/fixtures/timeline";
import { timeline } from "../../shared/api";
import type { TimelineItem } from "../../types/timeline";
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

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
let client: QueryClient;
let item: TimelineItem;

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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

function mount(session = item) {
  const onClose = vi.fn();
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SessionMenu
            item={session}
            anchor={new DOMRect(50, 50, 100, 30)}
            onClose={onClose}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return onClose;
}

describe("session menu", () => {
  it("marks only the selected occurrence and closes", async () => {
    const onClose = mount({ ...item, outcome: null });
    await act(async () =>
      (document.querySelector("[role=menuitem]") as HTMLButtonElement).click(),
    );
    expect(timeline.setOutcome).toHaveBeenCalledWith({
      plan_id: item.id,
      occurrence_date: item.occurrence_date,
      outcome: "done",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("takes back a completed occurrence", async () => {
    mount({ ...item, outcome: "done" });
    await act(async () =>
      (document.querySelector("[role=menuitem]") as HTMLButtonElement).click(),
    );
    expect(timeline.setOutcome).toHaveBeenCalledWith({
      plan_id: item.id,
      occurrence_date: item.occurrence_date,
      outcome: null,
    });
  });

  it("does not offer an outcome write for a cancelled session", () => {
    mount({ ...item, state: "cancelled" });
    expect(document.querySelectorAll("[role=menuitem]")).toHaveLength(2);
    expect(timeline.setOutcome).not.toHaveBeenCalled();
  });

  it("focuses its first choice, moves with arrows, and dismisses with Escape", () => {
    const onClose = mount();
    const choices =
      document.querySelectorAll<HTMLButtonElement>("[role=menuitem]");
    expect(document.activeElement).toBe(choices[0]);
    act(() =>
      choices[0]!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      ),
    );
    expect(document.activeElement).toBe(choices[2]);
    act(() =>
      choices[2]!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});

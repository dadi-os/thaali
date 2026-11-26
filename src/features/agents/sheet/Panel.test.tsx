// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agents, routines } from "../../../dev/fixtures/hath";
import { nasTasks } from "../../../dev/fixtures/tasks";
import { wakeDetail, wakeList } from "../../../dev/fixtures/wakes";
import type { WakeCursor } from "../../../types/hath";
import { AgentSheetPanel } from "./Panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const api = vi.hoisted(() => ({ listWakes: vi.fn(), getWake: vi.fn(), getLog: vi.fn() }));
vi.mock("../../../shared/api", () => ({ hath: api }));

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  api.listWakes.mockImplementation((agentId: string, query?: { limit?: number; before?: WakeCursor }) => Promise.resolve(wakeList("normal", agentId, query?.limit ?? 20, query?.before ?? null)));
  api.getWake.mockImplementation((agentId: string, wakeId: string) => Promise.resolve(wakeDetail("normal", agentId, wakeId)));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

async function mount(agentId: string, standing: Parameters<typeof AgentSheetPanel>[0]["standing"] = null) {
  const agent = agents("normal").find((candidate) => candidate.id === agentId)!;
  const tasks = agent.sessions.tasks.map((task) => ({ task: { ...task, status: nasTasks("normal").find((candidate) => candidate.task === task.id)!.status }, question: "" }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <AgentSheetPanel
          agent={agent}
          standing={standing}
          live={undefined}
          stop={{ pending: false, result: null, error: null }}
          onStop={() => undefined}
          tasks={tasks}
          onHaltTask={() => Promise.resolve()}
          routines={{ kind: "ready", items: routines(agentId) }}
          onCancelRoutine={() => Promise.resolve()}
          onCancelReminder={() => Promise.resolve()}
          parent={null}
          onSelectAgent={() => undefined}
          nameOf={(id) => id ?? "Ankur"}
          connected
          onOpenThread={() => undefined}
          now={Date.now()}
        />
      </QueryClientProvider>,
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
}

describe("AgentSheetPanel", () => {
  it("keeps one order: header, facts, helper tasks, routines, wakes, then the charter at the foot, with no About section", async () => {
    await mount("finance-specialist");
    const text = host.textContent ?? "";
    const order = ["Last active", "Created", "Helper tasks", "Routines & reminders", "Wakes", "Charter"].map((word) => text.indexOf(word));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text).not.toContain("About");
  });

  it("puts the primary action in the header, before the close control, and keeps Stop out of it", async () => {
    await mount("finance-specialist");
    const buttons = [...host.querySelectorAll("button")];
    const open = buttons.findIndex((button) => button.textContent === "Open thread");
    const close = buttons.findIndex((button) => button.getAttribute("aria-label") === "Close");
    const stop = buttons.findIndex((button) => button.getAttribute("aria-label") === "Stop finance-specialist");
    expect(open).toBeGreaterThanOrEqual(0);
    expect(host.querySelector("header")!.contains(buttons[open]!)).toBe(true);
    expect(stop).toBeGreaterThan(open);
    expect(host.querySelector("header")!.contains(buttons[stop]!)).toBe(false);
    expect(close === -1 || close > open).toBe(true);
  });

  it("says Reply in the header, as the one action, when the thread waits on Ankur", async () => {
    await mount("health-specialist", { status: "needs_input", content: "Move gym?", at: new Date().toISOString() });
    expect([...host.querySelectorAll("header button")].map((button) => button.textContent)).toContain("Reply");
    expect(host.textContent).not.toContain("Open thread");
    expect(host.textContent).toContain("Asked you");
  });

  it("draws no actions row at all for an agent with nothing to stop", async () => {
    await mount("career-manager");
    expect(host.querySelector("button[aria-label^='Stop ']")).toBeNull();
  });

  it("shows routines as cards: collapsed they say when, opened they show the procedure and Cancel", async () => {
    await mount("finance-specialist");
    expect(host.textContent).toContain("Morning money check");
    expect(host.textContent).toContain("Every day at 7:30 AM");
    expect(host.textContent).not.toContain("compare them with the budget");
    const toggle = [...host.querySelectorAll<HTMLElement>("button[aria-expanded][aria-labelledby]")].find((button) => host.querySelector(`#${CSS.escape(button.getAttribute("aria-labelledby")!)}`)?.textContent === "Morning money check")!;
    act(() => toggle.click());
    expect(host.textContent).toContain("compare them with the budget");
    expect(host.querySelector("button[aria-label='Cancel Morning money check']")).not.toBeNull();
  });
});

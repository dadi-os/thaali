// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logRow, wakeDetail, wakeList } from "../../../dev/fixtures/wakes";
import { ROUTINE_MORNING } from "../../../dev/fixtures/hath";
import type { Routine, WakeCursor } from "../../../types/hath";
import { Activity } from "./Activity";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const AGENT = "finance-specialist";

/** The routine the fixtures' scheduled wakes name. */
const SCHEDULES = { routines: [{ id: ROUTINE_MORNING(AGENT), title: "Morning money check" } as Routine], reminders: [] };

const api = vi.hoisted(() => ({
  listWakes: vi.fn(),
  getWake: vi.fn(),
  getLog: vi.fn(),
}));

vi.mock("../../../shared/api", () => ({ hath: api }));

let host: HTMLElement;
let root: Root;
let failList = false;

beforeEach(() => {
  failList = false;
  api.listWakes.mockImplementation((agentId: string, query?: { limit?: number; before?: WakeCursor }) =>
    failList ? Promise.reject(new Error("hath is down")) : Promise.resolve(wakeList("normal", agentId, query?.limit ?? 20, query?.before ?? null)),
  );
  api.getWake.mockImplementation((agentId: string, wakeId: string) => Promise.resolve(wakeDetail("normal", agentId, wakeId)));
  api.getLog.mockImplementation((agentId: string, logId: string) => Promise.resolve(logRow("normal", agentId, logId)));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

/** Draws the activity section of the fixtures' working agent and lets its reads settle. */
async function render(onSelectAgent: (agentId: string) => void = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Activity agentId={AGENT} connected nameOf={(id) => id ?? "Ankur"} schedules={SCHEDULES} onSelectAgent={onSelectAgent} now={Date.now()} />
      </QueryClientProvider>,
    ),
  );
  await settle();
}

/** Waits for reads and animations to settle inside act. */
async function settle() {
  const STEP_MS = 60;
  const GIVE_UP_MS = 3000;
  let previous = "";
  let stable = 0;
  for (let waited = 0; waited < GIVE_UP_MS && stable < 3; waited += STEP_MS) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, STEP_MS));
    });
    stable = host.textContent === previous ? stable + 1 : 0;
    previous = host.textContent ?? "";
  }
}

/** The button whose text is `text`. */
function button(text: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === text);
  if (found === undefined) {
    throw new Error(`no button ${text}`);
  }
  return found;
}

describe("Activity", () => {
  it("opens the running wake with its current call and lists the rest collapsed", async () => {
    await render();
    expect(host.textContent).toContain("Current call");
    expect(host.textContent).toContain("recall");
    expect(host.textContent).toContain("gym membership monthly charge");
    expect(host.textContent).toContain("Running");
    expect(host.textContent).toContain("Failed");
    expect(host.textContent).toContain("The run stopped: the prompt reached the 96000-token ceiling");
    expect(host.textContent).toContain("Routine Morning money check");
  });

  it("has no lane filter: one loop, one list of entries", async () => {
    await render();
    expect(host.querySelectorAll('[role="radiogroup"]')).toHaveLength(0);
    expect(host.textContent).not.toMatch(/\b(Process|Work)\b/);
  });

  it("shows a skeleton until the whole wake is read, then every entry at once", async () => {
    let release: (value: unknown) => void = () => undefined;
    api.getWake.mockImplementation((agentId: string, wakeId: string) => new Promise((resolve) => (release = () => resolve(wakeDetail("normal", agentId, wakeId)))));
    await render();
    expect(host.querySelector('[aria-label="Loading wake"]')).not.toBeNull();
    expect(host.textContent).not.toContain("searched the receipts folder directly");
    release(null);
    await settle();
    expect(host.querySelector('[aria-label="Loading wake"]')).toBeNull();
    expect(host.textContent).toContain("Reconcile the October statement");
    expect(host.textContent).toContain("searched the receipts folder directly");
  });

  it("opens the popover of the agent a wake's reason names", async () => {
    const onSelectAgent = vi.fn();
    await render(onSelectAgent);
    const link = [...host.querySelectorAll("button[title^='Show ']")][0] as HTMLButtonElement | undefined;
    expect(link).toBeDefined();
    act(() => link!.click());
    expect(onSelectAgent).toHaveBeenCalledTimes(1);
  });

  it("pages earlier wakes with the cursor Hath gave, until it gives none", async () => {
    await render();
    expect(api.listWakes).toHaveBeenCalledTimes(1);
    act(() => button("Load earlier").click());
    await settle();
    expect(api.listWakes).toHaveBeenCalledTimes(2);
    expect(api.listWakes.mock.calls[1]![1].before).toEqual(expect.objectContaining({ id: expect.any(String), started_at: expect.any(String) }));
    expect([...host.querySelectorAll("button")].some((candidate) => candidate.textContent === "Load earlier")).toBe(false);
  });

  it("shows hath's note to the agent as a note, apart from what anyone said", async () => {
    await render();
    const failed = [...host.querySelectorAll("[class*='cursor-pointer']")].find((row) => row.textContent?.includes("Failed")) as HTMLElement;
    act(() => failed.click());
    await settle();
    expect(host.textContent).toContain("Note from hath");
    expect(host.textContent).toContain("The run failed: the prompt reached the 96000-token ceiling.");
  });

  it("fetches the raw row for a result the wake cut short", async () => {
    await render();
    const readFile = [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.startsWith("read_file"))!;
    act(() => readFile.click());
    await settle();
    act(() => button("Show full result").click());
    await settle();
    expect(api.getLog).toHaveBeenCalledWith(AGENT, expect.stringMatching(/^a1f0c0de/));
    expect(host.textContent).toContain("row 120:");
  });

  it("says details expired for an aged-out wake but still lists its messages", async () => {
    await render();
    act(() => button("Load earlier").click());
    await settle();
    const rows = [...host.querySelectorAll("[class*='cursor-pointer']")] as HTMLElement[];
    const trimmed = rows[rows.length - 1]!;
    act(() => trimmed.click());
    await settle();
    expect(host.textContent).toContain("Details expired");
    expect(host.textContent).toContain("Morning money check: balances and anything pending.");
  });

  it("shows the error with a retry when the wakes cannot be read", async () => {
    failList = true;
    await render();
    expect(host.textContent).toContain("hath is down");
    failList = false;
    act(() => button("Retry").click());
    await settle();
    expect(host.textContent).toContain("Running");
  });
});

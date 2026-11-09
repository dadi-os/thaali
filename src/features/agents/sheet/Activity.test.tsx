// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logRow, wakeDetail, wakeList } from "../../../dev/fixtures/wakes";
import type { WakeCursor } from "../../../types/hath";
import { Activity } from "./Activity";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
MotionGlobalConfig.skipAnimations = true;

const AGENT = "finance-specialist";

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
async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <Activity agentId={AGENT} connected nameOf={(id) => id ?? "Ankur"} onSelectAgent={vi.fn()} now={Date.now()} />
      </QueryClientProvider>,
    ),
  );
  await settle();
}

/** Waits for reads and animations to settle inside act. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
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
  it("opens the running wake with its Now line and lists the rest collapsed", async () => {
    await render();
    expect(host.textContent).toContain("Now");
    expect(host.textContent).toContain("recall");
    expect(host.textContent).toContain("gym membership monthly charge");
    expect(host.textContent).toContain("Running");
    expect(host.textContent).toContain("Failed");
    expect(host.textContent).toContain("work lane stopped: prompt reached the 96000-token ceiling");
    expect(host.querySelectorAll('[role="radiogroup"]')).toHaveLength(1);
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

  it("filters an open wake's turns by lane and keeps its messages", async () => {
    await render();
    const turnTags = () => [...host.querySelectorAll(".ui-label")].map((label) => label.textContent).filter((text) => text === "Work" || text === "Process");
    expect(turnTags()).toContain("Process");
    const radios = [...host.querySelectorAll('[role="radio"]')] as HTMLButtonElement[];
    act(() => radios.find((radio) => radio.textContent === "Work")!.click());
    await settle();
    expect(turnTags()).not.toContain("Process");
    expect(host.textContent).toContain("Reconcile the October statement");
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
    expect(host.textContent).toContain("Reconcile the October statement");
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

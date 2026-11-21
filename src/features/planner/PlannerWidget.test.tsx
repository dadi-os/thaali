// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installContextMenu, type ContextRequest } from "../../shared/interaction/contextMenu";
import type { Plan } from "../../types/planner";

const setAttended = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("../../shared/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../shared/api")>();
  return { ...original, planner: { ...original.planner, setAttended } };
});

import { PlanRow } from "./PlannerWidget";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const now = new Date();
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000).toISOString();
const plan: Plan = { id: "p1", title: "CSE 300 lecture", body: null, rsvp: "yes", start_at: hours(-2), end_at: hours(-1), all_day: false, time_zone: null, attended: null, place: null, hub: null, owner: "manual", notes: [] };

let host: HTMLElement;
let root: Root;
let opened: ContextRequest[];
let stop: () => void;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  opened = [];
  stop = installContextMenu((request) => opened.push(request));
  setAttended.mockClear();
});
afterEach(() => {
  stop();
  act(() => root.unmount());
  host.remove();
});

function render(over: Partial<Plan> = {}) {
  const client = new QueryClient();
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PlanRow row={{ kind: "plan", plan: { ...plan, ...over }, current: false }} now={now} state="past" wide={false} first last />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return host.querySelector<HTMLElement>("[data-plan]")!;
}

describe("a plan row in the Planner widget", () => {
  it("is focusable and opens the plan's actions on a right-click, as a block in Day does", () => {
    const row = render();
    expect(row.tabIndex).toBe(0);
    act(() => {
      row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    });
    const ids = opened[0]!.actions.flatMap((action) => (action === "separator" ? [] : [action.id]));
    expect(ids).toEqual(expect.arrayContaining(["attended-yes", "attended-no", "show-in-yaad"]));
  });

  it("writes the attendance the menu is asked for", async () => {
    const row = render();
    act(() => {
      row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });
    const attended = opened[0]!.actions.find((action) => action !== "separator" && action.id === "attended-yes");
    await act(async () => {
      if (attended !== undefined && attended !== "separator") await attended.run();
    });
    expect(setAttended).toHaveBeenCalledWith({ plan_id: "p1", attended: true });
  });

  it("still offers its actions for a declined plan", () => {
    const row = render({ rsvp: "no" });
    act(() => {
      row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });
    const ids = opened[0]!.actions.flatMap((action) => (action === "separator" ? [] : [action.id]));
    expect(ids).toContain("show-in-yaad");
  });
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "../../types/planner";
import { WeekBlock, type WeekBlockProps } from "./WeekBlock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const plan: Plan = {
  id: "p1",
  title: "Study block",
  body: null,
  rsvp: "yes",
  start_at: "2026-11-27T19:00:00Z",
  end_at: "2026-11-27T20:30:00Z",
  all_day: false,
  time_zone: null,
  attended: null,
  place: null,
  hub: null,
  owner: "manual",
  notes: [],
};

const client = new QueryClient();
let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(over: Partial<WeekBlockProps>): void {
  const props: WeekBlockProps = {
    segment: { block: plan, startMin: 600, endMin: 690, lane: 0, lanes: 1 },
    state: "later",
    zone: "America/Detroit",
    top: 0,
    height: 90,
    narrow: false,
    selected: false,
    more: [],
    onOpen: vi.fn(),
    onMore: vi.fn(),
    ...over,
  };
  act(() =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <WeekBlock {...props} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}

describe("WeekBlock border", () => {
  it("states its border in the one shorthand, so closing its details cannot clear the color", () => {
    const spy = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
    for (const selected of [false, true, false]) {
      render({ selected });
    }
    const longhands = spy.mock.calls.map(([name]) => name).filter((name) => /^border(-top|-right|-bottom|-left)?-color$/.test(name));
    spy.mockRestore();
    expect(longhands).toEqual([]);
  });
});

// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../../types/timeline";
import { formatSince, relativeToSession } from "../dates";
import { SessionCard } from "./SessionCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const now = new Date("2026-11-09T15:00:00Z");

function session(over: Partial<TimelineItem>): TimelineItem {
  return {
    id: "p1",
    occurrence_date: "2026-11-09",
    title: "Short title",
    body: null,
    kind: "class",
    status: "confirmed",
    start_at: "2026-11-09T16:00:00Z",
    end_at: "2026-11-09T17:00:00Z",
    due_at: null,
    opens_at: null,
    all_day: false,
    time_zone: null,
    hide_from_planner: false,
    state: "scheduled",
    outcome: null,
    outcome_at: null,
    actual_start: null,
    actual_end: null,
    recurrence: null,
    series: null,
    place: null,
    owner: "schedule-specialist",
    notes: [],
    ...over,
  };
}

async function render(block: TimelineItem): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host).render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SessionCard block={block} now={now} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return host;
}

describe("SessionCard", () => {
  it("wraps and clamps a very long title to two lines, with the whole title on hover", async () => {
    const title = `${"Extraordinarily".repeat(12)} ${"long title ".repeat(30)}`.trim();
    const host = await render(session({ title }));
    const heading = host.querySelector("h3")!;
    expect(heading.className).toContain("line-clamp-2");
    expect(heading.className).toContain("break-words");
    expect(heading.getAttribute("title")).toBe(title);
  });

  it("keeps long notes inside a bounded scrolling region and never lets text run sideways", async () => {
    const notes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, title: `Note line ${i} ${"word".repeat(40)}`, body: null }));
    const host = await render(session({ body: "Bring the lab notebook", notes }));
    const region = host.querySelector<HTMLElement>("[data-top]")!;
    expect(region.style.maxHeight).toBe("176px");
    expect(region.style.overflowY).toBe("auto");
    expect(region.style.overflowX).toBe("hidden");
    expect(region.querySelectorAll("p").length).toBe(41);
    expect([...region.querySelectorAll("p")].every((p) => p.className.includes("break-words"))).toBe(true);
  });

  it("truncates a long place to one line and keeps its full text on hover", async () => {
    const place = { title: "A very long building name ".repeat(12), room: "204", address: "1 Long Street" } as TimelineItem["place"];
    const host = await render(session({ place }));
    const line = [...host.querySelectorAll<HTMLElement>("span.truncate")].find((el) => el.textContent!.includes("room 204"))!;
    expect(line.className).toContain("truncate");
    expect(line.getAttribute("title")).toBe(line.textContent);
  });

  it("offers Mark done, Show in Yaad and Message in one footer row, and says how near the session is", async () => {
    const host = await render(session({}));
    const labels = [...host.querySelectorAll("button")].map((button) => button.textContent);
    expect(labels).toEqual(expect.arrayContaining(["Mark done", "Show in Yaad"]));
    expect(labels.some((label) => label!.startsWith("Tell Dadi") || label!.startsWith("Message"))).toBe(true);
    expect(host.textContent).toContain("in 1h");
  });

  it("says when a plan that is only due is due", async () => {
    const host = await render(session({ start_at: null, end_at: null, due_at: "2026-11-09T14:00:00Z" }));
    expect(host.textContent).toContain("Due ");
    expect(host.textContent).toContain("1h ago");
  });
});

describe("relative hints", () => {
  const at = (iso: string) => new Date(iso);
  it("count down to a session, say now while it runs and count up after it", () => {
    expect(relativeToSession(now, at("2026-11-09T15:30:00Z"), at("2026-11-09T16:00:00Z"))).toBe("in 30m");
    expect(relativeToSession(now, at("2026-11-09T14:30:00Z"), at("2026-11-09T15:30:00Z"))).toBe("now");
    expect(relativeToSession(now, at("2026-11-09T12:00:00Z"), at("2026-11-09T13:00:00Z"))).toBe("2h ago");
  });

  it("counts whole days back", () => {
    expect(formatSince(now, at("2026-11-08T10:00:00Z"))).toMatch(/yesterday/i);
  });
});

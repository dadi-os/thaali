import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";

const stream = vi.fn();

vi.mock("../api", () => ({
  YAAD_URL: "http://yaad.dadi",
  isMeshOnline: () => true,
  transport: { stream: (opts: unknown) => stream(opts) },
}));

import { follow, type LiveSource } from "./useLiveQueries";

const source: LiveSource = { name: "yaad", baseUrl: "http://yaad.dadi", keys: [["yaad"], ["planner"]] };

type StreamOpts = { baseUrl: string; path: string; onEvent: (data: unknown) => void; onClose: () => void };

describe("follow", () => {
  const invalidateQueries = vi.fn();
  const queryClient = { invalidateQueries } as unknown as QueryClient;
  const visibility = new EventTarget();

  beforeEach(() => {
    vi.useFakeTimers();
    stream.mockReset();
    stream.mockReturnValue(() => {});
    invalidateQueries.mockReset();
    vi.stubGlobal("document", Object.assign(visibility, { visibilityState: "visible" }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const lastStream = () => stream.mock.lastCall![0] as StreamOpts;

  it("refetches every key it owns on open, then once for a burst of changes", () => {
    const stop = follow(source, queryClient);
    expect(lastStream()).toMatchObject({ baseUrl: "http://yaad.dadi", path: "/events" });
    expect(invalidateQueries.mock.calls.map(([arg]) => arg.queryKey)).toEqual([["yaad"], ["planner"]]);

    invalidateQueries.mockClear();
    lastStream().onEvent({ type: "changed" });
    lastStream().onEvent({ type: "changed" });
    expect(invalidateQueries).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    stop();
  });

  it("reopens a closed stream with doubling backoff and refetches on each reopen", () => {
    const stop = follow(source, queryClient);
    lastStream().onClose();
    expect(stream).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(stream).toHaveBeenCalledTimes(2);
    lastStream().onClose();
    vi.advanceTimersByTime(1999);
    expect(stream).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(stream).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenCalledTimes(6);
    stop();
  });

  it("reopens when the window becomes visible again and stops reopening once stopped", () => {
    const stop = follow(source, queryClient);
    visibility.dispatchEvent(new Event("visibilitychange"));
    expect(stream).toHaveBeenCalledTimes(2);

    const closed = lastStream();
    stop();
    closed.onClose();
    vi.advanceTimersByTime(60_000);
    expect(stream).toHaveBeenCalledTimes(2);
  });
});

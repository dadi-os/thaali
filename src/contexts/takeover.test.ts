import { describe, expect, it } from "vitest";
import { getTakeover, setTakeover, subscribeTakeover } from "./takeover";

describe("takeover store", () => {
  it("tells every listener when a task's modal opens and closes, and stops telling one that unsubscribed", () => {
    const seen: Array<string | null> = [];
    const stop = subscribeTakeover(() => seen.push(getTakeover()));
    setTakeover("task/browser/3f2a91");
    setTakeover(null);
    stop();
    setTakeover("task/terminal/c5728f");
    expect(seen).toEqual(["task/browser/3f2a91", null]);
    expect(getTakeover()).toBe("task/terminal/c5728f");
    setTakeover(null);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const openUrl = vi.hoisted(() => vi.fn());
vi.mock("./runtime", () => ({ isTauriRuntime: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

import { openExternal } from "./open";

afterEach(() => openUrl.mockClear());

describe("the desktop opener", () => {
  it("never receives a box:// link, which names a file on the box and not on this computer", async () => {
    await expect(openExternal("box:///var/home/dadi/msu/hw3.pdf")).rejects.toThrow(/box/);
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("still opens web links", async () => {
    await openExternal("https://example.com");
    expect(openUrl).toHaveBeenCalledWith("https://example.com");
  });
});

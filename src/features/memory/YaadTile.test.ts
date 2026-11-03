import { describe, expect, it, vi } from "vitest";
import type { NodeRecord } from "../../types/yaad";

const query = vi.hoisted(() => vi.fn());
vi.mock("../../shared/api", () => ({ yaad: { query }, isMeshOnline: () => true }));

import { countKind } from "./YaadTile";

const node = (createdAt: string) => ({ created_at: createdAt }) as NodeRecord;

describe("countKind", () => {
  it("reads every page until one comes back short and counts the nodes new since the instant", async () => {
    const full = Array.from({ length: 200 }, () => node("2026-10-01T00:00:00.000Z"));
    query.mockResolvedValueOnce({ nodes: full }).mockResolvedValueOnce({ nodes: [node("2026-10-27T00:00:00.000Z"), node("2026-10-20T00:00:00.000Z")] });
    expect(await countKind("memory", Date.parse("2026-10-26T00:00:00.000Z"))).toEqual({ total: 202, fresh: 1 });
    expect(query).toHaveBeenNthCalledWith(1, { kind: "memory", limit: 200, offset: 0 });
    expect(query).toHaveBeenNthCalledWith(2, { kind: "memory", limit: 200, offset: 200 });
  });

  it("stops at the first page when it is short", async () => {
    query.mockReset().mockResolvedValueOnce({ nodes: [] });
    expect(await countKind("person", 0)).toEqual({ total: 0, fresh: 0 });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

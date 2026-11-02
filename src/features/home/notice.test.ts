import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/errors";
import { tileNotice, type TileCopy } from "./notice";

const copy: TileCopy = { name: "Yaad", request: "POST /graph", empty: ["Nothing remembered yet", "Memories appear here as agents learn them."] };

describe("tileNotice", () => {
  it("says nothing while a tile loads or has content", () => {
    expect(tileNotice({ kind: "loading" }, copy, vi.fn())).toBeNull();
    expect(tileNotice({ kind: "ready", data: [], stale: null }, copy, vi.fn())).toBeNull();
  });

  it("says dadi is unreachable, with no way to retry, when the mesh is out of reach", () => {
    const notice = tileNotice({ kind: "offline" }, copy, vi.fn());
    expect(notice).toEqual({ kind: "offline", title: "dadi is unreachable", detail: "Waiting for the mesh to reconnect" });
  });

  it("names the request and status of a failure and lets the person ask again", () => {
    const retry = vi.fn();
    const notice = tileNotice({ kind: "error", error: new ApiError("HTTP 500: yaad failed", "http://yaad.dadi", "req_1", 500) }, copy, retry);
    expect(notice).toMatchObject({ kind: "error", title: "Yaad failed to answer", detail: "POST /graph · HTTP 500" });
    notice?.retry?.();
    expect(retry).toHaveBeenCalledOnce();
  });

  it("gives the failure's own words when it is not a service's answer", () => {
    const notice = tileNotice({ kind: "error", error: new Error("Network error: the mesh is reconnecting") }, copy, vi.fn());
    expect(notice).toMatchObject({ kind: "error", detail: "Network error: the mesh is reconnecting" });
  });

  it("names the host and status of a service that is not answering", () => {
    const notice = tileNotice({ kind: "module-offline", error: new ApiError("HTTP 502: bad gateway", "http://ghar.dadi", "req_2", 502) }, { ...copy, name: "Ghar" }, vi.fn());
    expect(notice).toMatchObject({ kind: "module-offline", title: "Ghar isn’t answering", detail: "ghar.dadi · HTTP 502" });
    expect(notice?.retry).toBeTypeOf("function");
  });

  it("says what an empty answer means", () => {
    expect(tileNotice({ kind: "empty" }, copy, vi.fn())).toEqual({ kind: "empty", title: "Nothing remembered yet", detail: "Memories appear here as agents learn them." });
  });
});

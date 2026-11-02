import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/errors";
import { failureProps, moduleState } from "./moduleState";

const options = { connected: true, isEmpty: (rows: string[]) => rows.length === 0 };

/** The query fields moduleState reads, as a query result. */
function query(fields: Partial<Pick<UseQueryResult<string[]>, "data" | "isError" | "error" | "dataUpdatedAt">>): UseQueryResult<string[]> {
  return { data: undefined, isError: false, error: null, dataUpdatedAt: 0, ...fields } as UseQueryResult<string[]>;
}

describe("moduleState", () => {
  it("waits for the first answer while connected and says offline when the mesh is down", () => {
    expect(moduleState(query({}), options)).toEqual({ kind: "loading" });
    expect(moduleState(query({}), { ...options, connected: false })).toEqual({ kind: "offline" });
  });

  it("keeps the last answer when the mesh drops or a refetch fails, marking the failure as stale", () => {
    expect(moduleState(query({ data: ["a"] }), { ...options, connected: false })).toEqual({ kind: "ready", data: ["a"], stale: null });
    expect(moduleState(query({ data: ["a"], isError: true, error: new Error("x"), dataUpdatedAt: 7 }), options)).toEqual({
      kind: "ready",
      data: ["a"],
      stale: { since: 7 },
    });
  });

  it("tells a module that is down from a request that failed", () => {
    const down = new ApiError("bad gateway", "http://yaad.dadi", "req", 502);
    const failed = new ApiError("server error", "http://yaad.dadi", "req", 500);
    expect(moduleState(query({ isError: true, error: down }), options)).toEqual({ kind: "module-offline", error: down });
    expect(moduleState(query({ isError: true, error: failed }), options)).toEqual({ kind: "error", error: failed });
  });

  it("reports an answer with nothing in it as empty", () => {
    expect(moduleState(query({ data: [] }), options)).toEqual({ kind: "empty" });
  });
});

describe("failureProps", () => {
  it("names the service, status and request of a failure a service answered, without the status its client put before the message", () => {
    const failed = new ApiError("HTTP 500: nas failed while handling GET /status", "http://nas.dadi", "7be0c2d4", 500);
    expect(failureProps(failed)).toEqual({ detail: "nas failed while handling GET /status", service: "nas", status: 500, requestId: "7be0c2d4" });
  });

  it("gives only the words of any other thrown value", () => {
    expect(failureProps(new Error("Network error"))).toEqual({ detail: "Network error" });
    expect(failureProps("boom")).toEqual({ detail: "boom" });
  });
});

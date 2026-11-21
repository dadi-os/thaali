/**
 * The live mode of the visual loop reads the real Yaad and Hath and never writes to them. A request is allowed when it is
 * a GET, or a POST to one of the read-only queries Yaad answers by POST; everything else (every PUT, PATCH and DELETE, and
 * any other POST) is refused, both here and again by the dev server's proxy.
 */

/** The services live mode reads through. */
export const LIVE_HOSTS = ["yaad", "hath"] as const;

/** A live service. */
export type LiveHost = (typeof LIVE_HOSTS)[number];

/** Yaad's POST routes that only read. */
const YAAD_READS = new Set(["/planner/plans", "/planner/tasks", "/query", "/graph", "/recall", "/history/search"]);

/** Whether live mode may send `method` `path` to `host`. */
export function liveAllowed(host: string, method: string, path: string): boolean {
  if (method === "GET") {
    return true;
  }
  return method === "POST" && host === "yaad" && YAAD_READS.has(path.split("?")[0]!);
}

/** The path the dev server proxies to a live service: `/__live/<host>/…`. */
export function liveProxyPath(host: LiveHost, path: string): string {
  return `/__live/${host}${path}`;
}

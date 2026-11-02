import { ApiError } from "../../shared/api/errors";
import type { ModuleState } from "../../shared/lib/ux/moduleState";
import type { TileNotice } from "./Tile";

/** What a tile says about the service behind it when it has nothing to show. */
export type TileCopy = {
  /** The service's name as a person says it: `Hath`, `Yaad`, `Nas`. */
  name: string;
  /** The request the tile makes, as an error names it: `GET /agents`. */
  request: string;
  /** The title and line of the tile's empty state. */
  empty: readonly [title: string, detail: string];
};

/**
 * The notice a tile shows in place of its body: that dadi is out of reach, that the service failed (with the request
 * and status that failed) or is not answering (with the host and status), or that it holds nothing. Null while the
 * tile loads or has content.
 * @param retry asks the service again; the failure notices offer it
 */
export function tileNotice(state: ModuleState<unknown>, copy: TileCopy, retry: () => void): TileNotice | null {
  switch (state.kind) {
    case "loading":
    case "ready":
      return null;
    case "offline":
      return { kind: "offline", title: "dadi is unreachable", detail: "Waiting for the mesh to reconnect" };
    case "empty":
      return { kind: "empty", title: copy.empty[0], detail: copy.empty[1] };
    case "module-offline":
      return { kind: "module-offline", title: `${copy.name} isn’t answering`, detail: `${state.error.service}.dadi · HTTP ${state.error.status}`, retry };
    case "error":
      return {
        kind: "error",
        title: `${copy.name} failed to answer`,
        detail: state.error instanceof ApiError ? `${copy.request} · HTTP ${state.error.status}` : state.error instanceof Error ? state.error.message : String(state.error),
        retry,
      };
  }
}

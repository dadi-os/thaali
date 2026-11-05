import { createChaaviClient, type ChaaviClient } from "./chaavi";
import { createHathClient, type HathClient } from "./hath";
import { createGharClient, type GharClient } from "./ghar";
import { createNasClient, type NasClient } from "./nas";
import { CHAAVI, HATH, GHAR, NAS, YAAD } from "./constants";
import { isTauriRuntime } from "../desktop/runtime";
import type { Transport } from "./transport";
import { createTimelineClient, type TimelineClient } from "./timeline";
import { createYaadClient, type YaadClient } from "./yaad";

export { createChaaviClient, type ChaaviClient } from "./chaavi";
export { createGharClient, type GharClient } from "./ghar";
export { createTimelineClient, type TimelineClient } from "./timeline";
export {
  CHAAVI as CHAAVI_URL,
  CHAAVI_VAULT as CHAAVI_VAULT_URL,
  HATH as HATH_URL,
  YAAD as YAAD_URL,
  NAS as NAS_URL,
  GHAR as GHAR_URL,
} from "./constants";
export { CHAAVI, CHAAVI_VAULT, HATH, YAAD, NAS, GHAR } from "./constants";
export { isTauriRuntime } from "../desktop/runtime";
export type { Transport, ConnectionState } from "./transport";
export { isMeshOnline } from "./transport";

/** Singleton transport — set by {@link initApi} before the app mounts. */
export let transport!: Transport;

/** True when the mesh (Tauri) transport is active. */
export let usingMesh = false;

/** Shared Hath client bound to {@link HATH} and {@link transport}. */
export let hath!: HathClient;

/** Shared Yaad client bound to {@link YAAD} and {@link transport}. */
export let yaad!: YaadClient;

/** Shared timeline client bound to {@link YAAD} and {@link transport}. */
export let timeline!: TimelineClient;

/** Shared Nas client bound to {@link NAS} and {@link transport}. */
export let nas!: NasClient;

/** Shared Chaavi client bound to {@link CHAAVI} and {@link transport}. */
export let chaavi!: ChaaviClient;

/** Shared Ghar client bound to {@link GHAR} and {@link transport}. */
export let ghar!: GharClient;

/**
 * Select and wire the Transport + domain clients.
 * Tauri loads MeshTransport. A dev server URL with `?fixtures=<scenario>` wires the fixture
 * transport instead (dev builds in a window only; production bundles drop the branch, and
 * a test environment without a window has no URL to read).
 */
export async function initApi(): Promise<void> {
  const fixtures =
    import.meta.env.DEV && typeof window !== "undefined"
      ? (await import("../../dev/scenario")).readScenario(window.location.search)
      : null;
  if (fixtures !== null) {
    const { FixtureTransport } = await import("../../dev/fixtureTransport");
    transport = new FixtureTransport(fixtures);
    usingMesh = false;
  } else if (isTauriRuntime()) {
    const { MeshTransport } = await import("./mesh-transport");
    transport = new MeshTransport();
    usingMesh = true;
  } else {
    throw new Error("Thaali runs in the dadi desktop app; for development open the dev server with ?fixtures=<scenario>");
  }
  hath = createHathClient(transport, HATH);
  yaad = createYaadClient(transport, YAAD);
  timeline = createTimelineClient(transport, YAAD);
  nas = createNasClient(transport, NAS);
  chaavi = createChaaviClient(transport, CHAAVI);
  ghar = createGharClient(transport, GHAR);
}

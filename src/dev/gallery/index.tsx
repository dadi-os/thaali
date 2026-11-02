import { CASES } from "./cases";
import "./chaavi";
import "./ghar";
import "./shell";
import "./sheet";
import "./takeover";

/**
 * The fidelity gate's side of the app: `?gallery=<case id>` on a dev-server URL renders one primitive in one
 * state inside `[data-ds-case]`, the same case id the design generator (gen/gate.mjs) renders from its own markup.
 * See README "Fidelity gate".
 */

/** The case id the `gallery` query parameter names, or null when it is absent. */
export function readGalleryCase(search: string): string | null {
  return new URLSearchParams(search).get("gallery");
}

export type GalleryProps = {
  /** One of the ids in {@link CASES}. */
  id: string;
};

/** One gallery case, mounted for the gate to compare with the design's. */
export function Gallery({ id }: GalleryProps) {
  const render = CASES[id];
  if (render === undefined) {
    throw new Error(`no gallery case "${id}"`);
  }
  return <div data-ds-case={id}>{render()}</div>;
}

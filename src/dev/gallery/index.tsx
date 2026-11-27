import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CASES } from "./cases";
import "./chaavi";
import "./files";
import "./ghar";
import "./onboarding";
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

/** The data client cases that read through react-query share, as the app provides one; a gallery case never retries. */
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** One gallery case, mounted for the gate to compare with the design's. */
export function Gallery({ id }: GalleryProps) {
  const render = CASES[id];
  if (render === undefined) {
    throw new Error(`no gallery case "${id}"`);
  }
  return (
    <QueryClientProvider client={queryClient}>
      <div data-ds-case={id}>{render()}</div>
    </QueryClientProvider>
  );
}

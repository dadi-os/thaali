/**
 * What a focused node lights up.
 * - `neighbors`: every link touching it, in either direction, and the nodes at their far ends.
 * - `lineage`: the link from its parent (a link whose target is the focus) and, following
 *   links from source to target, everything downstream of it. The sweep cascades down the
 *   lineage one generation at a time.
 */
export type ForceGraphFocusScope = "neighbors" | "lineage";

/**
 * Link lit by the focus. `near` and `far` are its vertex indices in the edge buffer,
 * nearest the focus first; `after` is the far vertex of the lit link feeding it, which
 * must brighten before this one starts, or -1 when it starts at once.
 */
export type LitLink = { near: number; far: number; after: number };

/** Nodes and links a focused node lights up, keyed by node id and link index. */
export type FocusSet = { nodes: Set<string>; links: Map<number, LitLink> };

/** Everything `focusId` lights up under `scope` (see `ForceGraphFocusScope`). */
export function focusSet(
  links: Array<{ source: { id: string }; target: { id: string } }>,
  focusId: string | null,
  scope: ForceGraphFocusScope,
): FocusSet {
  const set: FocusSet = { nodes: new Set(), links: new Map() };
  if (focusId === null) {
    return set;
  }
  set.nodes.add(focusId);
  const light = (i: number, from: string, after: number) => {
    const fromSource = links[i]!.source.id === from;
    set.links.set(i, {
      near: fromSource ? i * 2 : i * 2 + 1,
      far: fromSource ? i * 2 + 1 : i * 2,
      after,
    });
  };
  if (scope === "neighbors") {
    links.forEach((l, i) => {
      if (l.source.id === focusId || l.target.id === focusId) {
        light(i, focusId, -1);
        set.nodes.add(l.source.id === focusId ? l.target.id : l.source.id);
      }
    });
    return set;
  }
  const downstream = new Map<string, number[]>();
  links.forEach((l, i) => {
    if (l.target.id === focusId) {
      light(i, focusId, -1);
      set.nodes.add(l.source.id);
    }
    downstream.set(l.source.id, [...(downstream.get(l.source.id) ?? []), i]);
  });
  const queue: { id: string; after: number }[] = [{ id: focusId, after: -1 }];
  for (let next = queue.shift(); next; next = queue.shift()) {
    for (const i of downstream.get(next.id) ?? []) {
      const child = links[i]!.target.id;
      if (set.nodes.has(child)) {
        continue;
      }
      set.nodes.add(child);
      light(i, next.id, next.after);
      queue.push({ id: child, after: set.links.get(i)!.far });
    }
  }
  return set;
}

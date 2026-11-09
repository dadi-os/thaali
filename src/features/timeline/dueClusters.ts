/** Height in px of one due tag in the day's due lane. */
export const DUE_TAG_HEIGHT = 24;
/** Vertical distance in px under which two due items share a pill: one tag height plus a 4 px gap. */
export const DUE_CLUSTER_GAP = DUE_TAG_HEIGHT + 4;

/** One due item and where its time falls on the day's axis. */
export type DuePosition<T> = {
  item: T;
  /** Distance in px from the top of the axis. */
  y: number;
};

/** Items drawn as one tag (one member) or one `<N> due` pill (several). */
export type DueCluster<T> = {
  /** Position in px of the earliest member, where the tag or pill sits. */
  y: number;
  /** The members, earliest first; equal positions keep their input order. */
  items: T[];
};

/**
 * Groups due items whose positions would collide. Items are taken earliest first and one joins the open cluster while it lies
 * less than `gap` px below that cluster's first member; otherwise it opens the next cluster. Items at the same position always
 * share a cluster.
 */
export function clusterDues<T>(positions: ReadonlyArray<DuePosition<T>>, gap: number = DUE_CLUSTER_GAP): DueCluster<T>[] {
  const ordered = [...positions].sort((a, b) => a.y - b.y);
  const clusters: DueCluster<T>[] = [];
  for (const { item, y } of ordered) {
    const open = clusters[clusters.length - 1];
    if (open !== undefined && y - open.y < gap) {
      open.items.push(item);
    } else {
      clusters.push({ y, items: [item] });
    }
  }
  return clusters;
}

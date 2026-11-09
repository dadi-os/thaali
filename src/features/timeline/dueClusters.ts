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

/** Vertical extent in px of a drawn element on the day's axis. */
export type Extent = { top: number; bottom: number };

/** Margin in px added above and below each due tag or pill when deciding whether a session needs room. */
export const DUE_ROOM_MARGIN = 4;

/**
 * Which sessions must leave the due lane free. A session needs room when its extent overlaps a tag's extent padded by
 * `margin`; sessions that overlap one another form a group, and a group needs room as a whole so its columns stay aligned.
 * `sessions` must be ordered by `top`; the answer follows the same order.
 */
export function sessionsNeedingRoom(sessions: ReadonlyArray<Extent>, tags: ReadonlyArray<Extent>, margin: number = DUE_ROOM_MARGIN): boolean[] {
  const needs = sessions.map((s) => tags.some((t) => s.top < t.bottom + margin && s.bottom > t.top - margin));
  let start = 0;
  let reach = -Infinity;
  const close = (end: number) => {
    if (needs.slice(start, end).some(Boolean)) {
      needs.fill(true, start, end);
    }
    start = end;
  };
  sessions.forEach((s, i) => {
    if (i > start && s.top >= reach) {
      close(i);
      reach = -Infinity;
    }
    reach = Math.max(reach, s.bottom);
  });
  close(sessions.length);
  return needs;
}

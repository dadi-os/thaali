/** Margin kept between a popover and the window's edges, in px. */
export const EDGE_PAD = 12;

/** What {@link placePanel} needs to know about the anchor, the panel and the window. */
export type PlaceInput = {
  /** The anchor's centre in viewport coordinates. */
  originX: number;
  originY: number;
  /** Space between the anchor's centre and the panel's near edge. */
  clearance: number;
  /** How far above the anchor the panel's top sits. */
  lift: number;
  /** The panel's measured size. */
  width: number;
  height: number;
  /** Hold the room the panel may grow to (true) instead of only the room it takes now (false). */
  reserve: boolean;
  /** The tallest the panel may be by its own rule, before the window limits it. */
  maxHeight: number;
  viewportW: number;
  viewportH: number;
};

/** Where a panel goes, which side of the anchor it took, and the height it may not exceed. */
export type Placed = {
  left: number;
  top: number;
  /** `left` when the anchor is at the panel's left edge (the panel is right of it), `right` when it is at the right edge. */
  side: "left" | "right";
  /** Height the panel is limited to so it fits the window: its own maximum or the window less its margins, whichever is smaller. */
  limit: number;
};

/**
 * Places a panel beside its anchor inside the window. It goes right of the anchor when it fits there, else left of it, and
 * when it fits on neither side takes the side with more room and is shifted into the window. Its height is limited to the
 * window less the margins, and its top is held so that the room it reserves (its limit, or just its current height) stays on screen.
 */
export function placePanel(input: PlaceInput): Placed {
  const { originX, originY, clearance, lift, width, height, reserve, maxHeight, viewportW, viewportH } = input;
  const roomRight = viewportW - EDGE_PAD - (originX + clearance);
  const roomLeft = originX - clearance - EDGE_PAD;
  const rightFits = roomRight >= width;
  const leftFits = roomLeft >= width;
  const side: Placed["side"] = rightFits || (!leftFits && roomRight >= roomLeft) ? "left" : "right";
  const wanted = side === "left" ? originX + clearance : originX - clearance - width;
  const left = Math.max(EDGE_PAD, Math.min(wanted, viewportW - width - EDGE_PAD));
  const limit = Math.max(0, Math.min(maxHeight, viewportH - 2 * EDGE_PAD));
  const held = reserve ? limit : Math.min(height, limit);
  const top = Math.max(EDGE_PAD, Math.min(originY - lift, viewportH - held - EDGE_PAD));
  return { left, top, side, limit };
}

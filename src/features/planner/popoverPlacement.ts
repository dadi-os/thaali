/** Where a details popover sits so it never covers what it describes: beside, below or above that thing, inside the window. */

/** The popover's clearance from its anchor, and how far above the anchor point its top sits: the shared Popover's own constants, which this mirrors. */
const OFFSET = 22;
const LIFT = 26;
/** The room kept between the popover and the thing it describes, and from the window's edges and the title bar, in px. */
const GAP = 12;
const EDGE = 16;
const TOP = 64;

/** A rectangle in window coordinates. */
export type Box = { left: number; top: number; right: number; bottom: number };

/** The window's size. */
export type View = { width: number; height: number };

/**
 * The point to hand the shared Popover (with radius 0) so its panel of `width` by `height` lands beside `box` (to the right,
 * else the left), else below it, else above it, wherever it fits whole inside `view`. Null when it fits nowhere, which leaves
 * the caller to open at the pointer instead.
 */
export function placeAround(box: Box, width: number, height: number, view: View): { x: number; y: number } | null {
  const alignTop = Math.min(Math.max(box.top, TOP), view.height - EDGE - height);
  const sideY = alignTop + LIFT;
  if (box.right + GAP + width <= view.width - EDGE) return { x: box.right + GAP - OFFSET, y: sideY };
  if (box.left - GAP - width >= EDGE) return { x: box.left - GAP - width - OFFSET, y: sideY };
  const left = Math.min(Math.max(box.left, EDGE), view.width - EDGE - width);
  if (box.bottom + GAP + height <= view.height - EDGE) return { x: left - OFFSET, y: box.bottom + GAP + LIFT };
  if (box.top - GAP - height >= TOP) return { x: left - OFFSET, y: box.top - GAP - height + LIFT };
  return null;
}

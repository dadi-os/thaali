/** Slack (px) around the panel and anchor that still counts as inside the hover zone. */
const ZONE_SLACK = 10;

/**
 * Whether a viewport point is in a hover popover's zone: the panel, the anchor's
 * circle, or the band that joins the circle to the panel's near edge (all with
 * `ZONE_SLACK`).
 */
export function inHoverZone(
  x: number,
  y: number,
  panel: Pick<DOMRect, "left" | "top" | "right" | "bottom">,
  anchor: { x: number; y: number },
  radius: number,
): boolean {
  const m = ZONE_SLACK;
  if (x >= panel.left - m && x <= panel.right + m && y >= panel.top - m && y <= panel.bottom + m) {
    return true;
  }
  if (Math.hypot(x - anchor.x, y - anchor.y) <= radius + m) {
    return true;
  }
  const edgeX = anchor.x < panel.left ? panel.left : panel.right;
  if (edgeX === anchor.x || (x - anchor.x) * (edgeX - x) < 0) {
    return false;
  }
  const t = (x - anchor.x) / (edgeX - anchor.x);
  const top = anchor.y - radius - m + t * (panel.top - (anchor.y - radius));
  const bottom = anchor.y + radius + m + t * (panel.bottom - (anchor.y + radius));
  return y >= top && y <= bottom;
}

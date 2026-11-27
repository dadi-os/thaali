/** Props of {@link ScrollEdge}. */
export type ScrollEdgeProps = {
  /** The edge of the nearest positioned ancestor it sits against. */
  edge: "top" | "bottom";
  /** Height of the strip in px: the floating elements' height plus the room the effect needs to dissolve in. */
  size: number;
};

/** Blur layers stacked in a strip, each stronger and shorter than the last (steps live in tokens.css). */
const LAYERS = [1, 2, 3, 4, 5] as const;

/**
 * The scroll-edge effect behind floating glass: content scrolling toward the edge is blurred progressively and
 * dissolves into the surface, with no line where the effect ends. It takes no pointer input and sits under the
 * floating elements, which keep their own glass.
 */
export function ScrollEdge({ edge, size }: ScrollEdgeProps) {
  return (
    <div aria-hidden className={`scroll-edge scroll-edge--${edge}`} style={{ height: size }}>
      {LAYERS.map((layer) => (
        <span key={layer} className="scroll-edge__blur" />
      ))}
    </div>
  );
}

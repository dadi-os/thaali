import type { CSSProperties, ReactNode } from "react";
import { useSize, type Size } from "../hooks/useSize";

/** Props of {@link Measured}. */
export type MeasuredProps = {
  /** Drawn once the box has a size; given the size in px. */
  children: (size: Size) => ReactNode;
  /** Styles of the box itself; it takes the room its parent leaves by default. */
  style?: CSSProperties;
};

/**
 * A box that takes the room its parent leaves and tells its content how big that is, so a canvas, a graph or a
 * chart is sized from the space it was actually given and never from numbers its page subtracts by hand.
 */
export function Measured({ children, style }: MeasuredProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  return (
    <div ref={ref} style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0, ...style }}>
      {size.width === 0 || size.height === 0 ? null : children(size)}
    </div>
  );
}

import type { ReactNode } from "react";
import { useSize } from "../hooks/useSize";

/** The fixed size in px a frame's content is laid out at. */
export type SourceSize = { width: number; height: number };

/**
 * The uniform scale that fits `source` to `containerWidth`, and the height the scaled frame takes, rounded to a
 * whole device pixel so its bottom edge stays crisp. Zero until the container has a width.
 */
export function fitToWidth(containerWidth: number, source: SourceSize, pixelRatio = 1): { scale: number; height: number } {
  const scale = containerWidth > 0 ? containerWidth / source.width : 0;
  return { scale, height: Math.round(source.height * scale * pixelRatio) / pixelRatio };
}

export type ScaledFrameProps = {
  /** The size the children are laid out at, such as a browser's viewport or a terminal's cols by rows. */
  source: SourceSize;
  children: ReactNode;
};

/**
 * Draws its children at one fixed `source` size and scales them uniformly to the container's width, pinned top left,
 * so the aspect ratio holds and nothing is stretched or cropped as the container resizes. The frame's height follows
 * the scaled height.
 */
export function ScaledFrame({ source, children }: ScaledFrameProps) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const { scale, height } = fitToWidth(width, source, window.devicePixelRatio);
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height }}>
      <div className="absolute top-0 left-0" style={{ width: source.width, height: source.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}

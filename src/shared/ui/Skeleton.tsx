import type { CSSProperties } from "react";

export type SkeletonProps = {
  /** Width in px, or any CSS width. */
  width: number | string;
  /** Height in px, or any CSS height. */
  height: number | string;
  /** Corner radius in px when it differs from the 6 px default. */
  radius?: number;
  style?: CSSProperties;
};

/** A loading placeholder in the shape of what is coming. Size it to the content's final size so nothing shifts when it arrives. */
export function Skeleton({ width, height, radius, style }: SkeletonProps) {
  return <span className="sk" style={{ width, height, borderRadius: radius, ...style }} />;
}

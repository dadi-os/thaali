import type { ComponentProps } from "react";

export type CardProps = ComponentProps<"div">;

/** A bone-glass surface: translucent veil, hairline border, soft shadow, 18 px corners, content clipped to them. */
export function Card({ className, ...rest }: CardProps) {
  return <div className={["card", className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}

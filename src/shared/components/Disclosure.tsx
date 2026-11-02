import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** The chevron of a disclosure: it turns a quarter when an ancestor has the `open` class. */
export function Chevron() {
  return (
    <span className="chev" style={{ display: "flex" }}>
      <Icon name="chevron" size={14} />
    </span>
  );
}

export type RevealProps = {
  children: ReactNode;
};

/** A region whose height eases open when an ancestor has the `open` class; the content stays mounted so it can ease shut again. */
export function Reveal({ children }: RevealProps) {
  return (
    <div className="reveal">
      <div>{children}</div>
    </div>
  );
}

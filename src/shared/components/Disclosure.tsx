import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Truncate } from "./Truncate";

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

export type DisclosureProps = {
  title: string;
  /** What the section holds, in a few words, shown at the right while it is shut and open. */
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A titled section of a sheet that eases open to its content: a hairline above, a 40 px bar with a turning chevron, the title and its summary, and the content under it. */
export function Disclosure({ title, summary, open, onToggle, children }: DisclosureProps) {
  return (
    <div className={open ? "dsc open" : "dsc"} style={{ borderTop: "1px solid var(--rule)" }}>
      <button
        type="button"
        className="ui-trans ui-hover-fill"
        aria-expanded={open}
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 40, padding: "0 4px", borderRadius: 9 }}
      >
        <span style={{ display: "flex", color: "var(--ink-muted)" }}>
          <Chevron />
        </span>
        <span className="ui-label">{title}</span>
        <div style={{ flex: 1 }} />
        <Truncate text={summary} style={{ fontSize: 12.5, color: "var(--ink-muted)", maxWidth: 190, textAlign: "right" }} />
      </button>
      <Reveal>
        <div style={{ padding: "2px 4px 12px 26px" }}>{children}</div>
      </Reveal>
    </div>
  );
}

import type { CSSProperties } from "react";

export type TruncateProps = {
  text: string;
  className?: string;
  style?: CSSProperties;
};

/** One line of text that ends in an ellipsis when it does not fit, with the whole text in `title`. */
export function Truncate({ text, className, style }: TruncateProps) {
  return (
    <span className={["truncate-line", className ?? ""].filter(Boolean).join(" ")} title={text} style={style}>
      {text}
    </span>
  );
}

export type ClampProps = {
  text: string;
  /** How many lines show before the text is cut. */
  lines: number;
  style?: CSSProperties;
};

/** Text cut after `lines` lines, with the whole text in `title`. */
export function Clamp({ text, lines, style }: ClampProps) {
  return (
    <span className="clamp-lines" title={text} style={{ WebkitLineClamp: lines, ...style }}>
      {text}
    </span>
  );
}

/** Roles an agent id can end in; the role stays visible when the name is cut. */
const ROLE_SUFFIX = /-(manager|specialist|worker|bot)(-[\w-]*)?$/;

/** Splits an agent id into the part that may be cut and the role suffix (with any trailing id) that must stay. */
export function splitRole(name: string): { head: string; tail: string } {
  const match = name.match(ROLE_SUFFIX);
  const cut = match ? name.length - match[0].length : Math.max(0, name.length - 6);
  return { head: name.slice(0, cut), tail: name.slice(cut) };
}

export type NameTruncateProps = {
  /** An agent id such as `networking-specialist`. */
  name: string;
  style?: CSSProperties;
};

/** An agent name that never loses its role: when it does not fit, the front is cut and the role suffix stays, with the whole name in `title`. */
export function NameTruncate({ name, style }: NameTruncateProps) {
  const { head, tail } = splitRole(name);
  return (
    <span title={name} style={{ display: "flex", minWidth: 0, whiteSpace: "nowrap", ...style }}>
      {head ? <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{head}</span> : null}
      <span style={{ flex: "none" }}>{tail}</span>
    </span>
  );
}

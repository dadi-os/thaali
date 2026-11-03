import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** The monospace stack the feed draws tool calls and code in. */
export const MONO = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

/** The inline markdown the feed shows: `**bold**` and `code`; anything else is text. */
function inline(source: string): ReactNode[] {
  return source
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter((part) => part !== "")
    .map((part, index) => {
      if (part.startsWith("**")) {
        return (
          <strong key={index} style={{ fontWeight: 600 }}>
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`")) {
        return (
          <code key={index} style={{ fontFamily: MONO, fontSize: "0.92em" }}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
}

export type RichProps = {
  /** Markdown: paragraphs, `- ` bullets, `**bold**` and `code`; nothing else is interpreted. */
  source: string;
  size?: number;
  lineHeight?: number;
  color?: string;
};

/** Agent-written text as the activity feed draws it. */
export function Rich({ source, size = 12.5, lineHeight = 18, color = "var(--ink)" }: RichProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {source
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line, index) =>
          line.startsWith("- ") ? (
            <div key={index} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: size, lineHeight: `${lineHeight}px`, color }}>
              <span className="dot" style={{ width: 4, height: 4, background: "var(--sage)", marginTop: Math.round((lineHeight - 4) / 2) }} />
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{inline(line.slice(2))}</span>
            </div>
          ) : (
            <span key={index} style={{ display: "block", fontSize: size, lineHeight: `${lineHeight}px`, color, overflowWrap: "anywhere" }}>
              {inline(line)}
            </span>
          ),
        )}
    </div>
  );
}

export type ExpandProps = {
  /** Lines shown before the content is cut. */
  lines: number;
  lineHeight: number;
  /** The expansion is held by the caller so it survives the feed's re-renders. */
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** Content cut after `lines` lines with a fade, and a Show all toggle once it is taller than that. */
export function Expand({ lines, lineHeight, open, onToggle, children }: ExpandProps) {
  const inner = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const node = inner.current;
    if (node === null) {
      return undefined;
    }
    const measure = () => setOverflows(node.offsetHeight > lines * lineHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [lines, lineHeight]);
  const cut = overflows && !open;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={cut ? { maxHeight: lines * lineHeight, overflow: "hidden", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent)" } : {}}>
        <div ref={inner}>{children}</div>
      </div>
      {overflows ? (
        <button type="button" className="ui-trans" aria-expanded={open} onClick={onToggle} style={{ alignSelf: "flex-start", fontSize: 11.5, fontWeight: 600, color: "var(--sage-text)" }}>
          {open ? "Show less" : "Show all"}
        </button>
      ) : null}
    </div>
  );
}

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** The inline markdown the feed shows: `**bold**` and `code`; anything else is text. */
function inline(source: string): ReactNode[] {
  return source
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    .filter((part) => part !== "")
    .map((part, index) => {
      if (part.startsWith("**")) {
        return (
          <strong key={index} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`")) {
        return (
          <code key={index} className="font-numeric text-[0.92em]">
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
  /** Type size in px: one of the type scale. */
  size?: 11 | 12 | 13 | 14;
  /** Line height in px. */
  lineHeight?: number;
  /** A CSS colour. */
  color?: string;
};

/** Agent-written text as the activity feed draws it. */
export function Rich({ source, size = 12, lineHeight = 18, color = "var(--ink)" }: RichProps) {
  return (
    <div data-selectable className="flex flex-col gap-0.5">
      {source
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line, index) =>
          line.startsWith("- ") ? (
            <div key={index} className="flex items-start gap-2" style={{ fontSize: size, lineHeight: `${lineHeight}px`, color }}>
              <span className="dot size-1 bg-sage" style={{ marginTop: Math.round((lineHeight - 4) / 2) }} />
              <span className="min-w-0 [overflow-wrap:anywhere]">{inline(line.slice(2))}</span>
            </div>
          ) : (
            <span key={index} className="block [overflow-wrap:anywhere]" style={{ fontSize: size, lineHeight: `${lineHeight}px`, color }}>
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
    <div className="flex flex-col gap-0.5">
      <div className={cut ? "overflow-hidden [-webkit-mask-image:linear-gradient(to_bottom,black_60%,transparent)]" : ""} style={cut ? { maxHeight: lines * lineHeight } : undefined}>
        <div ref={inner}>{children}</div>
      </div>
      {overflows ? (
        <button type="button" className="ui-trans self-start text-[12px] font-semibold text-sage-text" aria-expanded={open} onClick={onToggle}>
          {open ? "Show less" : "Show all"}
        </button>
      ) : null}
    </div>
  );
}

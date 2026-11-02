import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { StateView } from "../../shared/components/ModuleState";
import { Truncate } from "../../shared/components/Truncate";

/** The pixels a tile's frame takes around its body: 16 px of padding and a 1 px border on each side. */
const FRAME = 34;
/** The title row and the gap under it. */
const HEADER = 24 + 12;
/** A tile's body this short gets the dense state view. */
const DENSE_BELOW = 170;

/** The room a tile's body has: the tile's width inside its frame, and the height under its title row. */
export type TileGeometry = {
  /** The tile's whole width. */
  tw: number;
  /** The tile's whole height. */
  th: number;
  /** Width inside the frame. */
  iw: number;
  /** Height of the body. */
  bh: number;
};

/** What a tile that cannot show content says: its icon, a title, and a line under it. */
export type TileNotice = {
  kind: "error" | "module-offline" | "offline" | "empty";
  title: string;
  detail: string;
  /** Asks again; a notice with one shows a Retry button. */
  retry?: () => void;
};

export type TileProps = {
  /** The tile's name, and the name of its grid area. */
  area: "hath" | "yaad" | "timeline" | "ghar" | "chaavi" | "system";
  title: string;
  /** The page the tile opens. */
  to: string;
  /** Where the tile stands in the grid's entrance: each tile rises 60 ms after the one before. */
  order: number;
  /** One line about the tile's content, opposite its title; absent while it loads or cannot show content. */
  summary?: string;
  /** A control at the far end of the title row. */
  right?: ReactNode;
  /** The body, given the room it has. */
  children: (geometry: TileGeometry) => ReactNode;
  /** The body's loading shape, given the room it has; drawn in place of `children` while the first answer is on its way. */
  skeleton: (geometry: TileGeometry) => ReactNode;
  /** True until the first answer. */
  loading: boolean;
  /** What to say instead of the body when it cannot be shown. */
  notice: TileNotice | null;
};

/** The tile's size and the body's room from its border box, floored as the design floors them. */
function geometryOf(width: number, height: number): TileGeometry {
  const tw = Math.floor(width);
  const th = Math.floor(height);
  return { tw, th, iw: tw - FRAME, bh: th - FRAME - HEADER };
}

/**
 * One tile of the Home grid: a glass link to the tile's page with a title row and a body that is given the room it
 * has. The body is measured, not guessed: it is not drawn until the tile has a size, and it is drawn again when the
 * window changes it, so a tile shows as many rows, rooms and bars as fit.
 */
export function Tile({ area, title, to, order, summary, right, children, skeleton, loading, notice }: TileProps) {
  const frame = useRef<HTMLAnchorElement>(null);
  const [geometry, setGeometry] = useState<TileGeometry | null>(null);

  useLayoutEffect(() => {
    const element = frame.current;
    if (element === null) {
      return;
    }
    const measure = (width: number, height: number) => {
      const next = geometryOf(width, height);
      setGeometry((current) => (current !== null && current.tw === next.tw && current.th === next.th ? current : next));
    };
    const box = element.getBoundingClientRect();
    measure(box.width, box.height);
    const observer = new ResizeObserver((entries) => {
      const size = entries[0]!.borderBoxSize[0]!;
      measure(size.inlineSize, size.blockSize);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 16,
    textDecoration: "none",
    color: "var(--ink)",
    background: "var(--glass-veil)",
    border: "1px solid var(--glass-border)",
    borderRadius: 18,
    boxShadow: "var(--shadow-card)",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    animation: "rise 550ms var(--ease) both",
    animationDelay: `${order * 60}ms`,
    gridArea: area,
  };
  let body: ReactNode = null;
  if (geometry !== null) {
    if (notice !== null) {
      body = <StateView kind={notice.kind} title={notice.title} detail={notice.detail} onRetry={notice.retry} dense={geometry.bh < DENSE_BELOW} />;
    } else if (loading) {
      body = skeleton(geometry);
    } else {
      body = children(geometry);
    }
  }
  const showSummary = summary !== undefined && summary !== "" && notice === null && !loading;
  return (
    <Link ref={frame} to={to} aria-label={title} className="ui-hover-card ui-trans" style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, height: 24, flex: "none", padding: "0 2px" }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--sage-text)", letterSpacing: "-0.005em", flex: "none" }}>{title}</span>
        <div style={{ flex: 1 }} />
        {showSummary ? <Truncate text={summary} style={{ fontSize: 13.5, color: "var(--ink-muted)", maxWidth: "68%" }} /> : null}
        {right}
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>{body}</div>
    </Link>
  );
}

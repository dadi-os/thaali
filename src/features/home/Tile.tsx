import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { FADE } from "../../shared/motion";
import { StateView } from "../../shared/states/ModuleState";
import { Truncate } from "../../shared/ui/Truncate";

/** The tile's frame as a link that animates: it rises into the grid like any arriving card. */
/** How long after the tile before it each tile's entrance starts, in seconds. */
const ENTRANCE_STEP_S = 0.06;

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

  let body: ReactNode = null;
  let phase = "content";
  if (geometry !== null) {
    if (notice !== null) {
      phase = "notice";
      body = <StateView kind={notice.kind} title={notice.title} detail={notice.detail} onRetry={notice.retry} dense={geometry.bh < DENSE_BELOW} />;
    } else if (loading) {
      phase = "skeleton";
      body = skeleton(geometry);
    } else {
      body = children(geometry);
    }
  }
  const showSummary = summary !== undefined && summary !== "" && notice === null && !loading;
  const placement = useMemo(() => ({ gridArea: area, animationDelay: `${order * ENTRANCE_STEP_S}s` }), [area, order]);
  return (
    <Link ref={frame} to={to} draggable={false} aria-label={title} className="tile-enter ui-hover-card ui-trans flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden rounded-[20px] border border-glass-border bg-glass-veil p-4 text-ink no-underline shadow-[var(--shadow-card)]" style={placement}>
      <div className="flex h-6 flex-none items-center gap-3 px-0.5">
        <span className="flex-none text-[17px] font-semibold tracking-[-0.005em] text-sage-text">{title}</span>
        <div className="flex-1" />
        {showSummary ? <Truncate text={summary} className="max-w-[68%] text-[14px] text-ink-muted tabular-nums" /> : null}
        {right}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={phase} className="flex min-h-0 min-w-0 flex-1 flex-col" {...FADE}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </Link>
  );
}

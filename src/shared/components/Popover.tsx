import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { EASE, SLOW_S } from "../lib/ux/motion";

export type PopoverAnchor = {
  x: number;
  y: number;
  /** Radius (px) of the round thing at the anchor (e.g. a graph node), 0 for a point; the panel and leader clear it. */
  radius: number;
};

export type PopoverProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Position relative to `containerRef` when provided, otherwise treated as
   * viewport coordinates.
   */
  anchor: PopoverAnchor;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  widthPx?: number;
  "aria-label"?: string;
  /** Element that owns the coordinate space for `anchor`. */
  containerRef?: RefObject<HTMLElement | null>;
  /**
   * Hairline tether from the anchor's edge to the panel, over an invisible bridge that
   * keeps the pointer "inside" the panel while it travels there from the anchor.
   */
  leader?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

const PAD = 12;
/** Space between the anchor's edge and the panel, which the leader spans. */
const OFFSET = 26;
/** Where the leader meets the panel, from its top, so it points at the header. */
const LEADER_FROM_TOP = 22;
/** Closest the leader may meet the panel to its top or bottom corner. */
const LEADER_INSET = 16;

type Placement = {
  left: number;
  top: number;
  width: number;
  height: number;
  side: "left" | "right";
};

/**
 * Anchored floating glass panel portaled to document.body.
 * Sits beside the anchor, flips and clamps to stay in the viewport, and re-places
 * only when the anchor moves or the panel resizes. Clicks stay on the panel so they
 * do not activate the widget that opened it.
 */
export function Popover({
  open,
  onClose,
  anchor,
  children,
  className,
  style,
  widthPx = 340,
  "aria-label": ariaLabel,
  containerRef,
  leader = false,
  onMouseEnter,
  onMouseLeave,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Placement | null>(null);
  const clearance = anchor.radius + OFFSET;
  const origin = (() => {
    const rect = containerRef?.current?.getBoundingClientRect();
    return rect ? { x: rect.left + anchor.x, y: rect.top + anchor.y } : anchor;
  })();

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const place = () => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const rect = containerRef?.current?.getBoundingClientRect();
      const originX = rect ? rect.left + anchor.x : anchor.x;
      const originY = rect ? rect.top + anchor.y : anchor.y;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      let side: Placement["side"] = "left";
      let left = originX + clearance;
      if (left + width > window.innerWidth - PAD) {
        left = originX - clearance - width;
        side = "right";
      }
      left = Math.max(PAD, Math.min(left, window.innerWidth - width - PAD));
      const top = Math.max(
        PAD,
        Math.min(originY - LEADER_FROM_TOP, window.innerHeight - height - PAD),
      );
      setPos((prev) =>
        prev &&
        prev.left === left &&
        prev.top === top &&
        prev.width === width &&
        prev.height === height &&
        prev.side === side
          ? prev
          : { left, top, width, height, side },
      );
    };

    place();
    const panel = panelRef.current;
    const observer = new ResizeObserver(place);
    if (panel) {
      observer.observe(panel);
    }
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [open, anchor.x, anchor.y, clearance, containerRef, widthPx]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  const tether = (() => {
    if (!leader || !pos) {
      return null;
    }
    const radius = anchor.radius;
    const cx = origin.x - pos.left;
    const cy = origin.y - pos.top;
    const edgeX = pos.side === "left" ? 0 : pos.width;
    const edgeY = Math.max(
      LEADER_INSET,
      Math.min(cy, pos.height - LEADER_INSET),
    );
    const dx = edgeX - cx;
    const dy = edgeY - cy;
    const length = Math.hypot(dx, dy);
    if (length <= radius) {
      return null;
    }
    const ux = dx / length;
    const uy = dy / length;
    const startX = cx + ux * (radius + 3);
    const startY = cy + uy * (radius + 3);
    const reach = Math.max(radius, 6);
    const bridge = [
      `${cx + ux * radius - uy * reach},${cy + uy * radius + ux * reach}`,
      `${cx + ux * radius + uy * reach},${cy + uy * radius - ux * reach}`,
      `${edgeX},0`,
      `${edgeX},${pos.height}`,
    ].join(" ");
    return { startX, startY, edgeX, edgeY, bridge };
  })();

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel}
          className={`popover-glass fixed z-[60] flex max-h-[min(70vh,520px)] flex-col ${className ?? ""}`}
          style={{
            left: pos ? pos.left : origin.x + clearance,
            top: pos ? pos.top : origin.y - LEADER_FROM_TOP,
            width: `min(${widthPx}px, calc(100vw - 24px))`,
            visibility: pos ? "visible" : "hidden",
            transformOrigin: `${pos?.side === "right" ? "right" : "left"} ${LEADER_FROM_TOP}px`,
            ...style,
          }}
          initial={{ opacity: 0, scale: 0.97, x: pos?.side === "right" ? 6 : -6 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: SLOW_S / 2, ease: EASE } }}
          transition={{ duration: SLOW_S, ease: EASE }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {tether ? (
            <svg aria-hidden className="pointer-events-none absolute top-0 left-0 size-px overflow-visible">
              <polygon points={tether.bridge} fill="transparent" pointerEvents="all" />
              <motion.line
                x1={tether.startX}
                y1={tether.startY}
                x2={tether.edgeX}
                y2={tether.edgeY}
                stroke="var(--sage-deep)"
                strokeOpacity={0.55}
                strokeWidth={1}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: SLOW_S, ease: EASE }}
              />
              <circle cx={tether.startX} cy={tether.startY} r={2.25} fill="var(--sage-deep)" />
            </svg>
          ) : null}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
            {children}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

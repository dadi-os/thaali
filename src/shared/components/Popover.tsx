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
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { EASE, SLOW_S } from "../lib/ux/motion";

export type PopoverAnchor = {
  x: number;
  y: number;
  /** Radius (px) of the round thing at the anchor (e.g. a graph node), 0 for a point; the panel clears it. */
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
   * CSS color the glass is tinted with (glow, border sheen, shadow), usually the
   * color of the thing it describes. Omit for an untinted sheet.
   */
  accent?: string;
  /**
   * Identity of what the panel shows. When it changes while open, the panel glides to
   * the new anchor and its content rises in again.
   */
  contentKey?: string;
  /**
   * Invisible bridge from the anchor's edge to the panel, so the pointer stays "inside"
   * the panel while it travels there from the anchor. For hover-opened panels.
   */
  hoverBridge?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

const PAD = 12;
/** Space between the anchor's edge and the panel. */
const OFFSET = 22;
/** How far above the anchor the panel's top sits, so its header lines up with it. */
const HEADER_LIFT = 26;
/** Spring for gliding between anchors. */
const GLIDE = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;

/** Where the panel sits in the viewport, its measured size, and which side of the anchor it is on. */
type Placement = {
  left: number;
  top: number;
  width: number;
  height: number;
  side: "left" | "right";
};

/**
 * Anchored floating glass panel portaled to document.body.
 * Sits beside the anchor without touching it, flips and clamps to stay in the
 * viewport, glides when the anchor moves, and re-places only when the anchor moves or
 * the panel resizes. Opens with a blur-in, a single light sheen, and content that
 * rises in one block at a time. Clicks stay on the panel so they do not activate the
 * widget that opened it.
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
  accent,
  contentKey,
  hoverBridge = false,
  onMouseEnter,
  onMouseLeave,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Placement | null>(null);
  const placed = useRef<Placement | null>(null);
  const glideX = useMotionValue(0);
  const glideY = useMotionValue(0);
  const clearance = anchor.radius + OFFSET;
  /** The anchor in viewport coordinates. */
  const originOf = () => {
    const rect = containerRef?.current?.getBoundingClientRect();
    return rect ? { x: rect.left + anchor.x, y: rect.top + anchor.y } : { x: anchor.x, y: anchor.y };
  };
  const origin = originOf();

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }
      const { x: originX, y: originY } = originOf();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      let side: Placement["side"] = "left";
      let left = originX + clearance;
      if (left + width > window.innerWidth - PAD) {
        left = originX - clearance - width;
        side = "right";
      }
      left = Math.max(PAD, Math.min(left, window.innerWidth - width - PAD));
      const top = Math.max(PAD, Math.min(originY - HEADER_LIFT, window.innerHeight - height - PAD));
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

  useLayoutEffect(() => {
    const prev = placed.current;
    placed.current = pos;
    if (!prev || !pos) {
      glideX.set(0);
      glideY.set(0);
      return;
    }
    const dx = prev.left - pos.left;
    const dy = prev.top - pos.top;
    if (dx === 0 && dy === 0) {
      return;
    }
    glideX.set(glideX.get() + dx);
    glideY.set(glideY.get() + dy);
    const x = animate(glideX, 0, GLIDE);
    const y = animate(glideY, 0, GLIDE);
    return () => {
      x.stop();
      y.stop();
    };
  }, [pos, glideX, glideY]);

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

  const bridge = (() => {
    if (!hoverBridge || !pos) {
      return null;
    }
    const cx = origin.x - pos.left;
    const cy = origin.y - pos.top;
    const edgeX = pos.side === "left" ? 0 : pos.width;
    const edgeY = Math.max(0, Math.min(cy, pos.height));
    const dx = edgeX - cx;
    const dy = edgeY - cy;
    const length = Math.hypot(dx, dy);
    if (length <= anchor.radius) {
      return null;
    }
    const ux = dx / length;
    const uy = dy / length;
    const sx = cx + ux * anchor.radius;
    const sy = cy + uy * anchor.radius;
    const reach = Math.max(anchor.radius, 6);
    return [
      `${sx - uy * reach},${sy + ux * reach}`,
      `${sx + uy * reach},${sy - ux * reach}`,
      `${edgeX},0`,
      `${edgeX},${pos.height}`,
    ].join(" ");
  })();

  const tint = accent ? ({ "--popover-accent": accent } as CSSProperties) : undefined;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label={ariaLabel}
          className={`popover-glass fixed z-[60] flex max-h-[min(70vh,520px)] flex-col ${className ?? ""}`}
          style={{
            ...tint,
            left: pos ? pos.left : origin.x + clearance,
            top: pos ? pos.top : origin.y - HEADER_LIFT,
            width: `min(${widthPx}px, calc(100vw - 24px))`,
            visibility: pos ? "visible" : "hidden",
            transformOrigin: `${pos?.side === "right" ? "right" : "left"} ${HEADER_LIFT}px`,
            x: glideX,
            y: glideY,
            ...style,
          }}
          initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{
            opacity: 0,
            scale: 0.985,
            filter: "blur(6px)",
            transition: { duration: SLOW_S * 0.6, ease: EASE },
          }}
          transition={{ duration: SLOW_S * 1.2, ease: EASE }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {bridge ? (
            <svg aria-hidden className="pointer-events-none absolute top-0 left-0 size-px overflow-visible">
              <polygon points={bridge} fill="transparent" pointerEvents="all" />
            </svg>
          ) : null}
          <span aria-hidden key={`sheen-${contentKey}`} className="popover-glass__sheen" />
          <div
            key={`body-${contentKey}`}
            className="popover-glass__body relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]"
          >
            {children}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

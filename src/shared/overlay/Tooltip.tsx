import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { EASE, FAST_S } from "../motion";

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
  /** Wait this long in ms after the pointer arrives before showing; focus shows at once. */
  delayMs?: number;
  /** Wrap long content, such as a URL, inside a bounded width instead of one line. */
  wrap?: boolean;
};

const PAD = 10;

export type TooltipBubbleProps = {
  children: ReactNode;
  style?: CSSProperties;
};

/** A tooltip's bubble: dark ink on bone, fading in. {@link Tooltip} places it; position it with `style` to show one alone. */
export function TooltipBubble({ children, style }: TooltipBubbleProps) {
  return (
    <div className="tooltip-bubble" style={style}>
      {children}
    </div>
  );
}

/**
 * Portaled tooltip — floats above chrome, flips when near viewport edges.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
  delayMs = 0,
  wrap = false,
}: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState({ left: 0, top: 0, placed: side });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }
    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tipRef.current?.getBoundingClientRect();
    const tipW = tip?.width ?? 120;
    const tipH = tip?.height ?? 28;

    let placed = side;
    let top =
      placed === "top" ? trigger.top - tipH - 8 : trigger.bottom + 8;
    if (placed === "top" && top < PAD) {
      placed = "bottom";
      top = trigger.bottom + 8;
    } else if (placed === "bottom" && top + tipH > window.innerHeight - PAD) {
      placed = "top";
      top = trigger.top - tipH - 8;
    }

    let left = trigger.left + trigger.width / 2 - tipW / 2;
    left = Math.max(PAD, Math.min(left, window.innerWidth - tipW - PAD));
    top = Math.max(PAD, Math.min(top, window.innerHeight - tipH - PAD));
    setPos({ left, top, placed });
  }, [open, side, content]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const show = (after: number) => {
    window.clearTimeout(timerRef.current);
    if (after > 0) {
      timerRef.current = window.setTimeout(() => setOpen(true), after);
    } else {
      setOpen(true);
    }
  };
  const hide = () => {
    window.clearTimeout(timerRef.current);
    setOpen(false);
  };

  return (
    <span
      ref={triggerRef}
      className={`inline-flex ${className ?? ""}`}
      onMouseEnter={() => show(delayMs)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {createPortal(
        <AnimatePresence>
          {open ? (
            <motion.div
              ref={tipRef}
              id={id}
              role="tooltip"
              className="tooltip-bubble pointer-events-none fixed"
              style={{
                left: pos.left,
                top: pos.top,
                zIndex: "var(--z-tooltip)",
                ...(wrap ? { whiteSpace: "normal", maxWidth: "min(420px, calc(100vw - 20px))", overflowWrap: "anywhere" } : {}),
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: FAST_S, ease: EASE }}
            >
              {content}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}

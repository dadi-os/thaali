import {
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
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
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
}: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
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

  return (
    <span
      ref={triggerRef}
      className={`inline-flex ${className ?? ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
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
              style={{ left: pos.left, top: pos.top, zIndex: "var(--z-tooltip)" }}
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

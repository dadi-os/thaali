import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  MAIN_MIN_PX,
  RAIL_DEFAULT_PX,
  RAIL_DEFAULT_SHARE,
  RAIL_KEY_STEP_PX,
  RAIL_KEY_STEP_SHIFT_PX,
  RAIL_MAX_PX,
  RAIL_MIN_PX,
  RAIL_WIDTH_KEY,
} from "./constants";

/**
 * The rail's width in a window: the width the user chose, or before any choice the default
 * share of the window up to 300 px, held between 260 and 560 px and never so wide that the main
 * area keeps less than 640 px.
 */
export function railWidthFor(windowWidth: number, chosen: number | null): number {
  const wanted = chosen ?? Math.min(RAIL_DEFAULT_PX, Math.round(windowWidth * RAIL_DEFAULT_SHARE));
  return Math.max(RAIL_MIN_PX, Math.min(wanted, windowWidth - MAIN_MIN_PX, RAIL_MAX_PX));
}

/** The width saved on this device, or null when the rail was never dragged. */
function loadChosen(): number | null {
  const saved = localStorage.getItem(RAIL_WIDTH_KEY);
  return saved === null ? null : Number(saved);
}

export type RailWidth = {
  /** The rail's width in px for this window. */
  width: number;
  /** The edge is being dragged. */
  dragging: boolean;
  /** Set the width while dragging, or save it when the drag ends. */
  choose: (width: number, save: boolean) => void;
  setDragging: (dragging: boolean) => void;
  /** Go back to the default width and forget the saved one. */
  reset: () => void;
};

/** The conversation rail's width: the saved choice held to the window, which it follows as the window resizes. */
export function useRailWidth(): RailWidth {
  const [chosen, setChosen] = useState<number | null>(loadChosen);
  const [dragging, setDragging] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => document.documentElement.clientWidth);

  useEffect(() => {
    const onResize = () => setWindowWidth(document.documentElement.clientWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return {
    width: railWidthFor(windowWidth, chosen),
    dragging,
    choose: (next, save) => {
      const held = Math.max(RAIL_MIN_PX, Math.min(next, RAIL_MAX_PX));
      setChosen(held);
      if (save) {
        localStorage.setItem(RAIL_WIDTH_KEY, String(Math.round(held)));
      }
    },
    setDragging,
    reset: () => {
      setChosen(null);
      localStorage.removeItem(RAIL_WIDTH_KEY);
    },
  };
}

export type ResizeHandleProps = {
  rail: RailWidth;
  /** The rail's name for assistive technology. */
  label?: string;
};

/**
 * The draggable edge of the rail: a 14 px hit area whose line and grip show on hover, focus and drag.
 * It is a separator: pointer drag, ← and → (with Shift, further), Home and End move it, and a double
 * click resets it.
 */
export function ResizeHandle({ rail, label = "Resize conversation list" }: ResizeHandleProps) {
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    rail.setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (rail.dragging) {
      rail.choose(e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left, false);
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!rail.dragging) {
      return;
    }
    e.currentTarget.releasePointerCapture(e.pointerId);
    rail.setDragging(false);
    rail.choose(rail.width, true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? RAIL_KEY_STEP_SHIFT_PX : RAIL_KEY_STEP_PX;
    const next =
      e.key === "ArrowLeft" ? rail.width - step : e.key === "ArrowRight" ? rail.width + step : e.key === "Home" ? RAIL_MIN_PX : e.key === "End" ? RAIL_MAX_PX : null;
    if (next !== null) {
      e.preventDefault();
      rail.choose(next, true);
    }
  };
  return (
    <div
      className={rail.dragging ? "rz drag" : "rz"}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={RAIL_MIN_PX}
      aria-valuemax={RAIL_MAX_PX}
      aria-valuenow={Math.round(rail.width)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={rail.reset}
    >
      <span className="rz-l" />
      <span className="rz-g" />
    </div>
  );
}

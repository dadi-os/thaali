import type { ReactNode, Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSize, type Size } from "../hooks/useSize";
import { useDismiss } from "../interaction/dismiss";
import { SCRIM, sheetMotion } from "../motion";

/** What a page body is told about the room it has. */
export type PageRoom = Size & {
  /** The side panel sits beside the main column; false means it floats over it as a drawer. */
  docked: boolean;
};

/** Props of {@link Page}. */
export type PageProps = {
  /** The page's name, on the root as `data-page`, for tests and the visual loop. */
  name: string;
  /** The frame element, for a page whose gestures (a drag) are measured against it. */
  ref?: Ref<HTMLDivElement>;
  /** The main column: usually a header, then the page's content. Give a function to be told the room. */
  children: ReactNode | ((room: PageRoom) => ReactNode);
  /** The side panel's content, shown while `asideOpen`; it plays an enter and exit as it comes and goes. */
  aside?: ReactNode;
  /** Whether the side panel is showing. */
  asideOpen?: boolean;
  /** Called when the drawer form of the side panel is dismissed (Escape or a press outside it). */
  onAsideClose?: () => void;
  /** The side panel's width in px. */
  asideWidth?: number;
  /** The page is this wide, or wider, before the side panel sits beside the main column; narrower, it is a drawer over it. */
  dockAbove?: number;
};

/** The page's edge padding and the gap between its columns, in px. */
const PAD = { top: 18, side: 20, bottom: 20 };
const GAP = 16;

/**
 * The frame every full page sits in: the same edge padding, a main column that takes the room, and an optional
 * side panel that docks beside it on a wide window and floats over it as a drawer on a narrow one. The frame
 * measures itself, so a page sizes its content from the room it is given and never from numbers it subtracts by hand.
 */
export function Page({ name, ref: outer, children, aside, asideOpen = false, onAsideClose, asideWidth = 400, dockAbove = 800 }: PageProps) {
  const [ref, size] = useSize<HTMLDivElement>();
  const frame = (el: HTMLDivElement | null) => {
    ref.current = el;
    if (typeof outer === "function") {
      outer(el);
    } else if (outer) {
      outer.current = el;
    }
  };
  const docked = size.width > dockAbove;
  const shown = aside !== undefined && asideOpen;
  useDismiss({ open: shown && !docked, onDismiss: () => onAsideClose?.() });
  const mainWidth = size.width - PAD.side * 2 - (shown && docked ? asideWidth + GAP : 0);
  const room: PageRoom = { width: mainWidth, height: size.height - PAD.top - PAD.bottom, docked };

  return (
    <div
      ref={frame}
      data-page={name}
      style={{ position: "relative", display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, minHeight: 0, gap: GAP, padding: `${PAD.top}px ${PAD.side}px ${PAD.bottom}px` }}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0, gap: 12 }}>
        {size.width === 0 ? null : typeof children === "function" ? children(room) : children}
      </div>
      <AnimatePresence>
        {shown && docked ? (
          <motion.div key="docked" style={{ display: "flex", width: asideWidth, flex: "none", minHeight: 0 }} {...sheetMotion("right")}>
            {aside}
          </motion.div>
        ) : null}
        {shown && !docked ? (
          <motion.div
            key="drawer"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                onAsideClose?.();
              }
            }}
            style={{ position: "absolute", inset: 0, zIndex: "var(--z-scrim)" }}
            {...SCRIM}
          >
            <motion.div style={{ position: "absolute", top: PAD.top, right: PAD.side, bottom: PAD.bottom, display: "flex", width: asideWidth, maxWidth: `calc(100% - ${PAD.side * 2}px)` }} {...sheetMotion("right")}>
              {aside}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

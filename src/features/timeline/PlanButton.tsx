import { createContext, useContext, useRef, type ButtonHTMLAttributes } from "react";
import { useContextActions } from "../../shared/interaction/contextMenu";
import type { TimelineItem } from "../../types/timeline";
import { usePlanActions } from "./planActions";

/** How a page opens a session's card from a menu: given the session and where it is drawn. Absent where there is no card. */
export const PlanDetailsContext = createContext<((item: TimelineItem, anchor: DOMRect) => void) | null>(null);

/** Props of {@link PlanButton}. */
export type PlanButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** The session the button stands for; a right-click on it offers that session's actions. */
  item: TimelineItem;
};

/** A session drawn as a button: it takes every button attribute, and a right-click on it opens the session's {@link planActions}. */
export function PlanButton({ item, type = "button", ...rest }: PlanButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const details = useContext(PlanDetailsContext);
  const actionsFor = usePlanActions(details === null ? undefined : (target) => details(target, ref.current!.getBoundingClientRect()));
  const context = useContextActions(() => actionsFor(item));
  return <button ref={ref} type={type} {...context} {...rest} />;
}

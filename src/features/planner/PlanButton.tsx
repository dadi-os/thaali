import { createContext, useContext, useRef, type ButtonHTMLAttributes } from "react";
import { useContextActions } from "../../shared/interaction/contextMenu";
import type { Plan } from "../../types/planner";
import { usePlanActions } from "./planActions";

/** How a page opens a plan's card from a menu: given the plan and where it is drawn. Absent where there is no card. */
export const PlanDetailsContext = createContext<((plan: Plan, anchor: DOMRect) => void) | null>(null);

/** Props of {@link PlanButton}. */
export type PlanButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** The plan the button stands for; a right-click on it offers that plan's actions. */
  plan: Plan;
};

/** A plan drawn as a button: it takes every button attribute, and a right-click on it opens the plan's {@link planActions}. */
export function PlanButton({ plan, type = "button", ...rest }: PlanButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const details = useContext(PlanDetailsContext);
  const actionsFor = usePlanActions(details === null ? undefined : (target) => details(target, ref.current!.getBoundingClientRect()));
  const context = useContextActions(() => actionsFor(plan));
  return <button ref={ref} type={type} {...context} {...rest} />;
}

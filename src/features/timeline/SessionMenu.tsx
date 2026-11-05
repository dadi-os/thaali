import { AnchoredMenu } from "../../shared/overlay/AnchoredMenu";
import { Truncate } from "../../shared/ui/Truncate";
import { useRetained } from "../../shared/hooks/useRetained";
import { formatClock, formatZone } from "../../shared/lib/ux/time";
import type { TimelineItem } from "../../types/timeline";
import { usePlanActions } from "./planActions";

/** When a session is, with the zone: "2:00 PM – 3:30 PM EDT", or "Due 5:00 PM EDT" for a deadline with no time set aside. */
export function sessionWhen(item: TimelineItem): string {
  if (item.start_at !== null) {
    return `${formatClock(item.start_at)} – ${formatClock(item.end_at ?? item.start_at)} ${formatZone(item.start_at)}`;
  }
  return `Due ${formatClock(item.due_at!)} ${formatZone(item.due_at!)}`;
}

/** How a session stands: Completed, Missed, or Not marked. */
export function sessionStanding(item: TimelineItem): string {
  return item.outcome === "done" ? "Completed" : item.outcome === "missed" ? "Missed" : "Not marked";
}

/** Props of {@link SessionMenu}. */
export type SessionMenuProps = {
  /** The session the menu is for; `null` keeps the menu shut. */
  item: TimelineItem | null;
  /** Where the session is drawn, in window coordinates. */
  anchor: DOMRect | null;
  onClose: () => void;
  /** Opens the full session card without losing place, notes, recurrence or connections. */
  onDetails?: () => void;
};

/**
 * The click form of a session's actions: when it is and how it stands, then the same list the right-click menu
 * offers ({@link planActions}), opened under the session. It closes on a press outside, Escape or any choice.
 */
export function SessionMenu({ item, anchor, onClose, onDetails }: SessionMenuProps) {
  const actionsFor = usePlanActions(onDetails === undefined ? undefined : () => onDetails());
  const shown = useRetained(item);
  if (shown === null) {
    return null;
  }
  return (
    <AnchoredMenu
      anchor={item === null ? null : anchor}
      actions={actionsFor(shown)}
      onClose={onClose}
      header={
        <>
          <Truncate text={shown.title} />
          <Truncate text={sessionWhen(shown)} className="ui-mono" style={{ color: "var(--ink)" }} />
          <Truncate text={sessionStanding(shown)} />
        </>
      }
    />
  );
}

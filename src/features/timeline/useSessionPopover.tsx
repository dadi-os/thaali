import { useState, type ReactNode } from "react";
import { Button } from "../../shared/ui/Button";
import { Popover } from "../../shared/overlay/Popover";
import { useRetained } from "../../shared/hooks/useRetained";
import type { TimelineItem } from "../../types/timeline";
import { NodePopover } from "./NodePopover";
import { itemKey } from "./plans";
import { isSettled } from "./planner/blocks";
import { SessionCard } from "./planner/SessionCard";

/** A session and where it was drawn when it was clicked. */
type Shown = { item: TimelineItem; anchor: DOMRect };

/** The node whose connections the second popover lists, with the session it came from when it did. */
type Connected = { id: string; anchor: DOMRect; session?: TimelineItem };

/** What {@link useSessionPopover} gives back. */
export type SessionPopover = {
  /** Open the details popover of `item`, under `anchor` (where the item is drawn, in window coordinates). */
  show: (item: TimelineItem, anchor: DOMRect) => void;
  /** Open the connections popover of a node. */
  showNode: (id: string, anchor: DOMRect, session?: TimelineItem) => void;
  /** Key of the session whose details are open, or null. */
  openKey: string | null;
  /** The popovers; render them once, anywhere in the page. */
  popovers: ReactNode;
};

/**
 * A session's click popover: its card (kind, time, place, notes, status and the same actions the right-click menu
 * offers) under the session, with a button that goes on to the plan's connections. Both popovers close on Escape, a
 * press outside and when the page that owns them goes away.
 */
export function useSessionPopover(now: Date): SessionPopover {
  const [details, setDetails] = useState<Shown | null>(null);
  const [node, setNode] = useState<Connected | null>(null);
  const shownDetails = useRetained(details);
  const shownNode = useRetained(node);
  const popovers = (
    <>
      {shownDetails === null ? null : (
        <Popover
          open={details !== null}
          anchor={{ x: shownDetails.anchor.left, y: shownDetails.anchor.bottom, radius: 0 }}
          aria-label={`${shownDetails.item.title} details`}
          widthPx={300}
          onClose={() => setDetails(null)}
        >
          <SessionCard block={shownDetails.item} settled={isSettled(shownDetails.item, now)} />
          <Button
            tone="quiet"
            onClick={() => {
              setNode({ id: shownDetails.item.id, session: shownDetails.item, anchor: shownDetails.anchor });
              setDetails(null);
            }}
          >
            Connections
          </Button>
        </Popover>
      )}
      {shownNode === null ? null : (
        <NodePopover
          open={node !== null}
          nodeId={shownNode.id}
          session={shownNode.session}
          anchor={{ x: shownNode.anchor.left, y: shownNode.anchor.bottom, radius: 0 }}
          onClose={() => setNode(null)}
          onSelect={(id) => setNode({ id, anchor: shownNode.anchor })}
        />
      )}
    </>
  );
  return {
    show: (item, anchor) => {
      setNode(null);
      setDetails({ item, anchor });
    },
    showNode: (id, anchor, session) => {
      setDetails(null);
      setNode({ id, anchor, session });
    },
    openKey: details === null ? null : itemKey(details.item),
    popovers,
  };
}

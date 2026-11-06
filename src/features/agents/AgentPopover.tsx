import { Popover } from "../../shared/overlay/Popover";
import { useRetained } from "../../shared/hooks/useRetained";
import { AgentSheet } from "./sheet";

/** The tallest the popover grows, in px, before its content scrolls. */
const MAX_HEIGHT = 620;

/** Props of {@link AgentPopover}. */
export type AgentPopoverProps = {
  /** The agent to show; null keeps the popover shut and lets a shown one play its exit. */
  agentId: string | null;
  /** Where the agent was clicked, in window coordinates. */
  anchor: DOMRect | null;
  /** The popover's parent link was pressed: show that agent instead. */
  onSelect: (agentId: string) => void;
  onClose: () => void;
};

/**
 * An agent's details in a popover beside whatever was clicked (a graph node, a list row, the name over a thread): what
 * it is doing now, its helper tasks, calls, queue, schedule, charter and activity, with Open thread for its chat. It
 * replaces going to the Hath page to look at an agent, so a thread or the Home tile can show one in place.
 */
export function AgentPopover({ agentId, anchor, onSelect, onClose }: AgentPopoverProps) {
  const shownId = useRetained(agentId);
  const shownAnchor = useRetained(anchor);
  if (shownId === null || shownAnchor === null) {
    return null;
  }
  return (
    <Popover
      open={agentId !== null}
      anchor={{ x: shownAnchor.left + shownAnchor.width / 2, y: shownAnchor.top + shownAnchor.height / 2, radius: Math.max(shownAnchor.width, shownAnchor.height) / 2 }}
      aria-label="Agent details"
      widthPx={400}
      contentKey={shownId}
      style={{ height: `min(${MAX_HEIGHT}px, calc(100vh - 32px))`, maxHeight: "none", padding: 0, outline: "none" }}
      onClose={onClose}
    >
      <AgentSheet agentId={shownId} onSelect={onSelect} />
    </Popover>
  );
}

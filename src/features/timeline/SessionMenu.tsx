import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { timeline } from "../../shared/api";
import { MenuItem, MenuPanel } from "../../shared/overlay/Floating";
import { Truncate } from "../../shared/ui/Truncate";
import { AGENTS_QUERY_KEY } from "../../shared/hooks/useEvents";
import { formatClock, formatZone } from "../../shared/lib/ux/time";
import { openAgent } from "../../store/chat";
import { requestDock } from "../../store/dock";
import { failureTarget, pushToast } from "../../store/toasts";
import type { AgentRecord } from "../../types/hath";
import type { TimelineItem } from "../../types/timeline";
import { keeperOf } from "./plans";

/** The menu's width, and the gap between it and the session it opens from. */
const WIDTH = 220;
const GAP = 6;
/** The room the menu keeps from the window's edge. */
const EDGE = 8;

/** Where a menu of `size` sits for a session drawn at `anchor`: under it, flush with its left, moved in from the window's edge and above it when there is no room under. */
export function menuPosition(
  anchor: { left: number; top: number; bottom: number },
  size: { width: number; height: number },
  view: { width: number; height: number },
): { left: number; top: number } {
  const left = Math.max(
    EDGE,
    Math.min(anchor.left, view.width - size.width - EDGE),
  );
  const below = anchor.bottom + GAP;
  const top =
    below + size.height > view.height - EDGE
      ? Math.max(EDGE, anchor.top - GAP - size.height)
      : below;
  return { left: Math.round(left), top: Math.round(top) };
}

/** When a session is, with the zone: "2:00 PM – 3:30 PM EDT", or "Due 5:00 PM EDT" for a deadline with no time set aside. */
export function sessionWhen(item: TimelineItem): string {
  if (item.start_at !== null) {
    return `${formatClock(item.start_at)} – ${formatClock(item.end_at ?? item.start_at)} ${formatZone(item.start_at)}`;
  }
  return `Due ${formatClock(item.due_at!)} ${formatZone(item.due_at!)}`;
}

/** How a session stands: Completed, Missed, or Not marked. */
export function sessionStanding(item: TimelineItem): string {
  return item.outcome === "done"
    ? "Completed"
    : item.outcome === "missed"
      ? "Missed"
      : "Not marked";
}

export type SessionMenuProps = {
  /** The session the menu is for. */
  item: TimelineItem;
  /** Where the session is drawn, in window coordinates. */
  anchor: DOMRect;
  onClose: () => void;
  /** Opens the full session card without losing place, notes, recurrence or connections. */
  onDetails?: () => void;
};

/**
 * What Ankur can do with a session from a Home tile: see when it is and how it stands, mark it Completed or take the
 * mark back, message the agent that keeps it (Dadi when none still runs) or show it in Yaad. It closes on a click
 * outside it, Esc, or any choice; nothing here edits the plan.
 */
export function SessionMenu({
  item,
  anchor,
  onClose,
  onDetails,
}: SessionMenuProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(
    null,
  );
  const agents = useQuery<AgentRecord[]>({
    queryKey: AGENTS_QUERY_KEY,
    enabled: false,
  });
  const keeper = keeperOf(item, agents.data);
  const completed = item.outcome === "done";
  const mark = useMutation({
    mutationFn: () =>
      timeline.setOutcome({
        plan_id: item.id,
        occurrence_date: item.occurrence_date!,
        outcome: completed ? null : "done",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["yaad", "timeline"] }),
    onError: (error) =>
      pushToast({
        key: "timeline:outcome",
        tone: "error",
        title: "Yaad",
        body: error.message,
        target: failureTarget(error),
      }),
  });

  useLayoutEffect(() => {
    const box = panel.current!.getBoundingClientRect();
    setPlace(
      menuPosition(
        anchor,
        { width: box.width, height: box.height },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
    panel.current!.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  }, [anchor]);
  useEffect(() => {
    const away = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const choose = (action: () => void) => () => {
    onClose();
    action();
  };
  return createPortal(
    <div
      ref={panel}
      onKeyDown={(event) => {
        const items = [
          ...panel.current!.querySelectorAll<HTMLButtonElement>(
            "[role=menuitem]:not(:disabled)",
          ),
        ];
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        let next: number;
        if (event.key === "ArrowDown") next = (index + 1) % items.length;
        else if (event.key === "ArrowUp")
          next = (index - 1 + items.length) % items.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = items.length - 1;
        else return;
        event.preventDefault();
        items[next]?.focus();
      }}
      style={{
        position: "fixed",
        left: place?.left ?? 0,
        top: place?.top ?? 0,
        visibility: place === null ? "hidden" : "visible",
        zIndex: "var(--z-menu)",
        width: WIDTH,
      }}
    >
      <MenuPanel>
        <Truncate
          text={item.title}
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            padding: "6px 12px 0",
          }}
        />
        <Truncate
          text={sessionWhen(item)}
          className="ui-mono"
          style={{ fontSize: 12, padding: "2px 12px 0" }}
        />
        <Truncate
          text={sessionStanding(item)}
          style={{
            fontSize: 12,
            color: "var(--ink-muted)",
            padding: "2px 12px 4px",
          }}
        />
        {item.occurrence_date === null || item.state === "cancelled" ? null : (
          <MenuItem
            label={completed ? "Take back done" : "Mark done"}
            icon={completed ? "retry" : "check"}
            onClick={choose(() => mark.mutate())}
          />
        )}
        <MenuItem
          label={keeper === null ? "Tell Dadi" : `Message ${keeper.name}`}
          icon="send"
          onClick={choose(() =>
            keeper === null ? requestDock() : openAgent(keeper.id),
          )}
        />
        <MenuItem
          label="Show in Yaad"
          icon="graph"
          onClick={choose(() => navigate(`/yaad?focus=${item.id}`))}
        />
        {onDetails === undefined ? null : (
          <MenuItem
            label="Session details"
            icon="info"
            onClick={choose(onDetails)}
          />
        )}
      </MenuPanel>
    </div>,
    document.body,
  );
}

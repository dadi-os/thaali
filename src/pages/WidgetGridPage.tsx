import { useSyncExternalStore, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AgentGraph3D } from "../features/agents/AgentGraph3D";
import { ChaaviTile } from "../features/chaavi/ChaaviTile";
import { GharWidget } from "../features/ghar/widget";
import { MemoryCounters } from "../features/memory/MemoryCounters";
import { SystemMap } from "../features/system/SystemMap";
import { TimelineCalendar } from "../features/timeline/TimelineCalendar";
import { AGENTS_QUERY_KEY } from "../shared/hooks/useEvents";
import { getRunning, subscribeRunning } from "../store/running";
import type { AgentRecord } from "../types/hath";
import { WidgetFrame } from "../shared/components/WidgetFrame";
import { ErrorBoundary } from "../shared/components/states";

const tile =
  "min-h-0 w-full cursor-pointer transition-[border-color,transform] duration-slow ease-dadi hover:border-sage hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage";

/** "Week of Oct 26": the Monday that starts this week. */
function weekOf(now: Date): string {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/**
 * Home widget grid — 4×4 on a landscape window, two columns on a portrait one (see
 * `.home-grid`): Hath 2×2, Timeline 2×2, Yaad 2×1, Ghar 2×1, Chaavi 1×2, System 1×2.
 * Each widget names itself on the left of its title row and says how it is on the right.
 */
export function WidgetGridPage() {
  const navigate = useNavigate();
  const agents = useQuery<AgentRecord[]>({ queryKey: AGENTS_QUERY_KEY, enabled: false });
  const running = useSyncExternalStore(subscribeRunning, getRunning, getRunning);
  const working = Object.values(running).filter((lanes) => lanes.reasoning || lanes.conversation).length;
  const agentsAside = agents.data
    ? `${working} working · ${agents.data.filter((agent) => agent.active).length} agents`
    : null;

  const open = (path: string) => () => navigate(path);
  const onActivate =
    (path: string) => (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(path);
      }
    };

  return (
    <div className="home-grid h-full min-h-0 overflow-hidden px-2 py-2">
      <WidgetFrame
        title="Hath"
        aside={agentsAside}
        role="link"
        tabIndex={0}
        onClick={open("/hath")}
        onKeyDown={onActivate("/hath")}
        className={`${tile} [grid-area:agents]`}
      >
        <ErrorBoundary label="Hath" compact>
          <AgentGraph3D
            entranceKey="home-agents"
            interactive={false}
            focusOnEntry={null}
            onPick={(agentId) => navigate("/hath", { state: { focusAgent: agentId } })}
            toolbar={null}
          />
        </ErrorBoundary>
      </WidgetFrame>

      <WidgetFrame
        title="Yaad"
        role="link"
        tabIndex={0}
        onClick={open("/yaad")}
        onKeyDown={onActivate("/yaad")}
        className={`${tile} [grid-area:memory]`}
      >
        <ErrorBoundary label="Yaad" compact>
          <MemoryCounters />
        </ErrorBoundary>
      </WidgetFrame>

      <WidgetFrame
        title="Timeline"
        aside={weekOf(new Date())}
        role="link"
        tabIndex={0}
        onClick={open("/timeline?view=week")}
        onKeyDown={onActivate("/timeline?view=week")}
        className={`${tile} [grid-area:timeline]`}
      >
        <ErrorBoundary label="Timeline" compact>
          <TimelineCalendar mode="preview" hideIdeas />
        </ErrorBoundary>
      </WidgetFrame>

      <WidgetFrame
        title="Ghar"
        role="link"
        tabIndex={0}
        onClick={open("/ghar")}
        onKeyDown={onActivate("/ghar")}
        className={`${tile} [grid-area:ghar]`}
      >
        <ErrorBoundary label="Ghar" compact>
          <GharWidget />
        </ErrorBoundary>
      </WidgetFrame>

      <WidgetFrame
        title="Chaavi"
        role="link"
        tabIndex={0}
        onClick={open("/chaavi")}
        onKeyDown={onActivate("/chaavi")}
        className={`${tile} [grid-area:chaavi]`}
      >
        <ErrorBoundary label="Chaavi" compact>
          <ChaaviTile />
        </ErrorBoundary>
      </WidgetFrame>

      <WidgetFrame
        title="System"
        role="link"
        tabIndex={0}
        onClick={open("/system")}
        onKeyDown={onActivate("/system")}
        className={`${tile} [grid-area:system]`}
      >
        <ErrorBoundary label="System" compact>
          <SystemMap mode="preview" />
        </ErrorBoundary>
      </WidgetFrame>
    </div>
  );
}

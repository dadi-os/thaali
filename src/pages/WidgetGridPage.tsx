import { useSyncExternalStore, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { AgentGraph3D } from "../features/agents/AgentGraph3D";
import { ChaaviTile } from "../features/chaavi/ChaaviTile";
import { GharWidget } from "../features/ghar/widget";
import { COUNTED_KINDS, MemoryCounters, kindCountKey, type KindCount } from "../features/memory/MemoryCounters";
import { serviceHealth } from "../features/system/SystemMap";
import { SystemWidget } from "../features/system/SystemWidget";
import type { NasStatus } from "../shared/api/nas";
import { TimelineCalendar } from "../features/timeline/TimelineCalendar";
import { AGENTS_QUERY_KEY } from "../shared/hooks/useEvents";
import { CHAAVI_ITEMS_KEY } from "../shared/api/chaavi";
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
  const counts = useQueries({
    queries: COUNTED_KINDS.map((kind) => ({ queryKey: kindCountKey(kind), enabled: false })),
    combine: (results) => (results.every((q) => q.data) ? results.reduce((sum, q) => sum + (q.data as KindCount).thisWeek, 0) : null),
  });
  const vault = useQuery<{ items: unknown[] }>({ queryKey: CHAAVI_ITEMS_KEY, enabled: false });
  const health = useQuery<NasStatus>({ queryKey: ["nas", "status"], enabled: false });
  const down = health.data ? serviceHealth(health.data).filter((s) => !s.ok).length : null;
  const busy = (agents.data ?? []).flatMap((agent) => {
    const lanes = running[agent.id];
    return lanes?.reasoning ? [`${agent.name} · working`] : lanes?.conversation ? [`${agent.name} · thinking`] : [];
  });
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
        {busy.length > 0 ? (
          <span className="pointer-events-none absolute bottom-3.5 left-[18px] flex max-w-[calc(100%-36px)] flex-wrap gap-2">
            {busy.slice(0, 3).map((label) => (
              <span key={label} className="rounded-full bg-sage-fill px-2.5 py-[5px] text-[11.5px] font-semibold text-sage-text">
                {label}
              </span>
            ))}
          </span>
        ) : null}
      </WidgetFrame>

      <WidgetFrame
        title="Yaad"
        aside={counts === null ? null : `+${counts.toLocaleString()} this week`}
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
        aside={vault.data ? `${vault.data.items.length} items` : null}
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
        aside={
          down === null ? null : (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className={`size-1.5 rounded-full ${down === 0 ? "bg-sage" : "border border-dashed border-ink-ghost"}`} />
              {down === 0 ? "All healthy" : `${down} offline`}
            </span>
          )
        }
        role="link"
        tabIndex={0}
        onClick={open("/system")}
        onKeyDown={onActivate("/system")}
        className={`${tile} [grid-area:system]`}
      >
        <ErrorBoundary label="System" compact>
          <SystemWidget />
        </ErrorBoundary>
      </WidgetFrame>
    </div>
  );
}

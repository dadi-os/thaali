import { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { PageHeader } from "../chrome/PageHeader";
import { AgentGraph3D } from "../features/agents/AgentGraph3D";
import { AgentSheet } from "../features/agents/sheet";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";

/** Router state that arrives with a focused agent, set by the home tile and the thread's details button. */
type HathPageState = { focusAgent: string } | null;

/**
 * Hath page: the full-canvas forest of active agents as a live 3D graph (orbit, zoom, click to select) with the
 * selected agent's sheet docked beside it. Blow-up entrance remounts when arriving from home (or elsewhere), focused
 * on the agent picked there, if any.
 */
export function HathPage() {
  const location = useLocation();
  const entranceKey = `hath:${location.key}`;
  const state = location.state as HathPageState;
  const focusOnEntry = state === null ? null : state.focusAgent;
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <motion.div
      className="flex h-full min-h-0 w-full gap-4 overflow-hidden px-5 pt-[18px] pb-5"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <div className="relative min-h-0 min-w-0 flex-1">
        <div className="absolute inset-0">
          <AgentGraph3D entranceKey={entranceKey} interactive focusOnEntry={focusOnEntry} onSelect={setSelectedId} toolbar={toolbar} />
        </div>
        <div className="pointer-events-none relative z-10">
          <PageHeader title="HATH" trailing={<div ref={setToolbar} className="flex items-center gap-2" />} />
        </div>
      </div>
      {selectedId === null ? null : <AgentSheet agentId={selectedId} />}
    </motion.div>
  );
}

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { RoutedMessage } from "../../shared/api/types";
import { MarkdownBody } from "../../shared/components/Markdown";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { messageKey, type ChatMessage, type RouterRun } from "../../store/chat";
import type { RunningMap } from "../../store/running";
import { ActivityPulse } from "./ActivityPulse";
import { NEAR_BOTTOM_PX } from "./constants";
import { repliesTo } from "./lanes";

export type RouterViewProps = {
  /** This session's router runs, oldest first. */
  runs: RouterRun[];
  /** User threads keyed by agent id; replies to routed messages come from here. */
  threads: Record<string, ChatMessage[]>;
  /** Lane occupancy per agent, for "on it" while a reply is being written. */
  running: RunningMap;
  /** Reserve space above the floating composer. */
  composerPad: number;
  /** Open the thread a routed message landed in. */
  onOpenAgent: (agentId: string) => void;
};

/** Status copy while the router runs, with when each line takes over (ms). */
const ROUTING_PHASES: Array<{ at: number; label: string }> = [
  { at: 0, label: "Reading what you said" },
  { at: 900, label: "Finding who owns it" },
  { at: 2800, label: "Writing it as you" },
];

/**
 * The router screen. The router never answers: each run shows what you said,
 * then every message it sent as you, with the agent it landed on and that
 * agent's replies as they come back.
 */
export function RouterView({
  runs,
  threads,
  running,
  composerPad,
  onOpenAgent,
}: RouterViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [runs, threads, running, composerPad]);

  if (runs.length === 0) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-8"
        style={{ paddingBottom: composerPad }}
      >
        <span className="font-gujarati text-[56px] leading-none text-sage-text">
          દાદી
        </span>
        <p className="mt-5 max-w-[16rem] text-center text-[14px] leading-relaxed text-ink-muted">
          Say what you need. The router sends it, as you, to whoever owns it.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={() => {
        const el = scrollRef.current;
        if (el) {
          stickRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
        }
      }}
      className="absolute inset-0 overflow-y-auto px-5 pt-5"
      style={{ paddingBottom: composerPad }}
    >
      <div className="flex flex-col gap-7">
        {runs.map((run) => (
          <RunBlock
            key={run.id}
            run={run}
            threads={threads}
            running={running}
            onOpenAgent={onOpenAgent}
          />
        ))}
      </div>
    </div>
  );
}

/** One utterance and everything the router did with it. */
type RunBlockProps = {
  run: RouterRun;
  /** User threads keyed by agent id, for each routed message's replies. */
  threads: Record<string, ChatMessage[]>;
  /** Lane occupancy per agent. */
  running: RunningMap;
  /** Open the thread a routed message landed in. */
  onOpenAgent: (agentId: string) => void;
};

function RunBlock({ run, threads, running, onOpenAgent }: RunBlockProps) {
  return (
    <motion.section
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <div className="max-w-[82%] self-end rounded-[20px] bg-sage-active px-3.5 py-2.5 text-[15px] leading-[1.45] break-words whitespace-pre-wrap text-ink">
        {run.content}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {run.status === "routing" ? (
          <RoutingTrail key="routing" />
        ) : run.status === "failed" ? (
          <motion.p
            key="failed"
            role="alert"
            className="text-[13px] leading-relaxed text-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: SLOW_S, ease: EASE }}
          >
            The router couldn&apos;t send that. {run.error}
          </motion.p>
        ) : run.sent.length === 0 ? (
          <motion.p
            key="none"
            className="text-[13px] text-ink-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: SLOW_S, ease: EASE }}
          >
            The router didn&apos;t send anything.
          </motion.p>
        ) : (
          <motion.div
            key="sent"
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: SLOW_S, ease: EASE }}
          >
            {run.sent.map((sent) => (
              <RoutedCard
                key={`${sent.to_agent_id}:${sent.seq}`}
                sent={sent}
                replies={repliesTo(threads[sent.to_agent_id] ?? [], sent.seq)}
                busy={
                  running[sent.to_agent_id]?.conversation === true ||
                  running[sent.to_agent_id]?.reasoning === true
                }
                onOpen={() => onOpenAgent(sent.to_agent_id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/** A message the router sent as you, where it landed, and what came back. */
type RoutedCardProps = {
  /** The message the router sent as you. */
  sent: RoutedMessage;
  /** The agent's replies to it so far. */
  replies: ChatMessage[];
  /** The agent has a lane running. */
  busy: boolean;
  /** Open the agent's thread. */
  onOpen: () => void;
};

function RoutedCard({ sent, replies, busy, onOpen }: RoutedCardProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5 pl-0.5">
        <span className="routing-thread h-5 w-px rounded-full" aria-hidden />
        <button
          type="button"
          onClick={onOpen}
          className="lane-chip inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-sage-deep"
        >
          <IconArrow />
          {sent.to_agent_id}
        </button>
        <span className="text-[11px] tracking-[0.04em] text-ink-ghost">
          sent as you
        </span>
      </div>

      <div className="line-clamp-6 rounded-2xl border border-(--glass-border) bg-glass-veil px-3.5 py-2.5 text-[13.5px] text-ink-muted">
        <MarkdownBody content={sent.content} compact />
      </div>

      {replies.map((reply) => (
        <div key={messageKey(reply)} className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-sage-active text-[11px] font-semibold text-sage-deep uppercase">
              {sent.to_agent_id.slice(0, 1)}
            </span>
            <span className="text-[13px] font-semibold text-ink">
              {sent.to_agent_id}
            </span>
          </span>
          <div className="text-[15px] text-ink">
            <MarkdownBody content={reply.content} />
          </div>
        </div>
      ))}

      {busy ? (
        <div className="flex items-center gap-2 text-[12px] text-sage-text">
          <ActivityPulse />
          <span>{sent.to_agent_id} is on it</span>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        className="inline-flex min-h-8 items-center gap-1 self-start text-[13px] font-medium text-sage-deep"
      >
        Open thread
        <IconChevron />
      </button>
    </div>
  );
}

/** Thread line with a bead running down it, and the router's current step. */
function RoutingTrail() {
  const reduced = useReducedMotion() ?? false;
  const phase = useRoutingPhase();
  const label = ROUTING_PHASES[phase]!.label;
  return (
    <motion.div
      className="flex items-center gap-2.5 pl-0.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <motion.span
        className="routing-thread h-6 w-[1.5px] origin-top rounded-full"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: reduced ? 0 : 0.5, ease: EASE }}
        aria-hidden
      />
      <span
        role="status"
        aria-live="polite"
        className="text-[12px] tracking-[0.04em] text-sage-text"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={label}
            className="inline-block"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.22, ease: EASE }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.div>
  );
}

/** Index into ROUTING_PHASES, advancing on its schedule from mount. */
function useRoutingPhase(): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = ROUTING_PHASES.slice(1).map((p, i) =>
      setTimeout(() => setPhase(i + 1), p.at),
    );
    return () => {
      for (const t of timers) {
        clearTimeout(t);
      }
    };
  }, []);
  return phase;
}

function IconArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

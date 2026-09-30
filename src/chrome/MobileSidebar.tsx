import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ConnectionState } from "../shared/api/transport";
import { InlineMarkdown } from "../shared/components/Markdown";
import {
  IconNewChat,
  IconPower,
  IconRouter,
  IconSearch,
} from "../shared/components/IconButton";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";
import type { Conversation } from "../store/chat";
import type { RunningMap } from "../store/running";
import { ActivityPulse } from "./chatSidebar/ActivityPulse";

/** A full page reachable from the mobile sidebar. */
export type MobilePage = {
  path: string;
  title: string;
  icon: () => ReactNode;
};

/** Pages the phone can open, in sidebar order. No widget grid on mobile. */
export const MOBILE_PAGES: MobilePage[] = [
  { path: "/memory", title: "Memory", icon: IconMemory },
  { path: "/timeline", title: "Timeline", icon: IconTimeline },
  { path: "/ghar", title: "Ghar", icon: IconGhar },
  { path: "/chaavi", title: "Chaavi", icon: IconChaavi },
  { path: "/system", title: "System", icon: IconSystem },
];

/** What the main area shows, so the sidebar can mark it. */
export type MobileView =
  | { kind: "router" }
  | { kind: "agent"; agentId: string }
  | { kind: "page"; path: string };

export type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
  /** What the main area shows; its row is highlighted. */
  view: MobileView;
  /** Mesh state for the dadiMesh card. */
  connection: ConnectionState;
  /** Agent threads, listed in the Agents folder. */
  conversations: Conversation[];
  /** Lane occupancy per agent, for each thread's working dot. */
  running: RunningMap;
  /** POST /router is running. */
  routerBusy: boolean;
  /** Last thing said to the router this session. */
  routerPreview: string | null;
  /** Show the leave control (tailnet builds, mesh up). */
  canLeaveMesh: boolean;
  onOpenRouter: () => void;
  /** Clear the router screen and open it. */
  onNewRouterMessage: () => void;
  onOpenAgent: (agentId: string) => void;
  onOpenPage: (path: string) => void;
  onLeaveMesh: () => void;
};

const PANEL_WIDTH = 318;

/**
 * Frosted slide-over: the router, the pages, and an Agents folder holding
 * every agent thread. Drag it left to close.
 */
export function MobileSidebar({
  open,
  onClose,
  view,
  connection,
  conversations,
  running,
  routerBusy,
  routerPreview,
  canLeaveMesh,
  onOpenRouter,
  onNewRouterMessage,
  onOpenAgent,
  onOpenPage,
  onLeaveMesh,
}: MobileSidebarProps) {
  const [query, setQuery] = useState("");
  const [agentsOpen, setAgentsOpen] = useState(true);
  const needle = query.trim().toLowerCase();
  const pages = MOBILE_PAGES.filter((p) =>
    p.title.toLowerCase().includes(needle),
  );
  const agents = conversations.filter(
    (c) =>
      c.agent_name.toLowerCase().includes(needle) ||
      c.last_message.toLowerCase().includes(needle),
  );
  const showAgents = agentsOpen || needle.length > 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.button
          key="scrim"
          type="button"
          aria-label="Close sidebar"
          className="absolute inset-0 z-30 bg-ink/15 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: SLOW_S, ease: EASE }}
          onClick={onClose}
        />
      ) : null}
      {open ? (
        <motion.nav
          key="panel"
          aria-label="Sidebar"
          className="chat-rail absolute inset-y-0 left-0 z-40 flex flex-col px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[12px_0_40px_-18px_rgb(44_48_42/0.25)]"
          style={{ width: `min(86vw, ${PANEL_WIDTH}px)` }}
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ duration: SLOW_S, ease: EASE }}
          drag="x"
          dragConstraints={{ left: -PANEL_WIDTH, right: 0 }}
          dragElastic={{ left: 0.2, right: 0 }}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            if (info.offset.x < -70 || info.velocity.x < -400) {
              onClose();
            }
          }}
        >
          <div className="flex items-center gap-2 px-1 pb-3">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-(--chat-hover) px-3 text-ink-muted [&_svg]:size-4">
              <IconSearch />
              <span className="sr-only">Search</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint"
              />
            </label>
            <button
              type="button"
              aria-label="New message to the router"
              onClick={onNewRouterMessage}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-ink [&_svg]:size-5"
            >
              <IconNewChat />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <button
              type="button"
              onClick={onOpenRouter}
              className={`flex min-h-13 w-full items-center gap-3 rounded-xl px-3 text-left ${
                view.kind === "router" ? "bg-(--chat-active)" : ""
              }`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center text-sage-deep [&_svg]:size-4">
                <IconRouter />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">
                  router
                </span>
                {routerPreview ? (
                  <span className="block truncate text-[12.5px] text-ink-muted">
                    <InlineMarkdown content={routerPreview} />
                  </span>
                ) : null}
              </span>
              {routerBusy ? <ActivityPulse /> : null}
            </button>

            {pages.length > 0 ? (
              <>
                <div className="px-3 pt-5 pb-1.5 text-[11px] font-medium tracking-[0.12em] text-sage-text uppercase">
                  Pages
                </div>
                <div className="flex flex-col gap-0.5">
                  {pages.map((page) => (
                    <button
                      key={page.path}
                      type="button"
                      onClick={() => onOpenPage(page.path)}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-ink ${
                        view.kind === "page" && view.path === page.path
                          ? "bg-(--chat-active)"
                          : ""
                      }`}
                    >
                      <span className="flex size-6 items-center justify-center text-sage-deep">
                        {page.icon()}
                      </span>
                      {page.title}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            <div className="mx-3 my-3.5 h-px bg-(--chat-edge)" />

            <button
              type="button"
              aria-expanded={showAgents}
              onClick={() => setAgentsOpen((v) => !v)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-ink"
            >
              <span className="flex size-6 items-center justify-center text-sage-deep">
                <IconFolder />
              </span>
              <span className="flex-1 text-[15px] font-medium">Agents</span>
              <span className="text-[12px] text-ink-muted">{agents.length}</span>
              <motion.span
                className="text-ink-muted"
                animate={{ rotate: showAgents ? 0 : -90 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <IconChevronDown />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {showAgents ? (
                <motion.div
                  key="agents"
                  className="flex flex-col gap-0.5 overflow-hidden pl-5"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: EASE }}
                >
                  {agents.length === 0 ? (
                    <p className="px-3 py-2 text-[12.5px] text-ink-ghost">
                      {needle ? "No matching threads" : "No agent threads yet"}
                    </p>
                  ) : (
                    agents.map((conv) => {
                      const lanes = running[conv.agent_id];
                      const busy = lanes?.conversation === true || lanes?.reasoning === true;
                      const selected =
                        view.kind === "agent" && view.agentId === conv.agent_id;
                      return (
                        <button
                          key={conv.agent_id}
                          type="button"
                          onClick={() => onOpenAgent(conv.agent_id)}
                          className={`flex min-h-13 flex-col justify-center gap-0.5 rounded-xl px-3 text-left ${
                            selected ? "bg-(--chat-active)" : ""
                          }`}
                        >
                          <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                            <span className="truncate">{conv.agent_name}</span>
                            {busy ? (
                              <span className="size-1.5 shrink-0 rounded-full bg-sage" aria-label="working" />
                            ) : null}
                          </span>
                          <span className="truncate text-[12.5px] text-ink-muted">
                            {conv.from_user ? "You: " : ""}
                            <InlineMarkdown content={conv.last_message} />
                          </span>
                        </button>
                      );
                    })
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <MeshCard
            connection={connection}
            canLeave={canLeaveMesh}
            onLeave={onLeaveMesh}
          />
        </motion.nav>
      ) : null}
    </AnimatePresence>
  );
}

const MESH_LABEL: Record<ConnectionState, string> = {
  connected: "ONLINE",
  reconnecting: "RECONNECTING",
  connecting: "CONNECTING",
  disconnected: "OFFLINE",
};

type MeshCardProps = {
  connection: ConnectionState;
  /** Show the leave control. */
  canLeave: boolean;
  onLeave: () => void;
};

/** dadiMesh status and the leave control, pinned under the list. */
function MeshCard({ connection, canLeave, onLeave }: MeshCardProps) {
  const online = connection === "connected";
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-2xl border border-(--chat-edge) bg-bone/55 py-1.5 pr-1.5 pl-3">
      <span
        className={`size-2 shrink-0 rounded-full ${online ? "bg-sage shadow-[0_0_0_4px_var(--sage-faint)]" : "bg-ink-ghost"}`}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] font-medium text-ink">dadiMesh</span>
        <span className="text-[10.5px] font-medium tracking-[0.14em] text-sage-text">
          {MESH_LABEL[connection]}
        </span>
      </span>
      {canLeave ? (
        <button
          type="button"
          aria-label="Leave dadiMesh"
          onClick={onLeave}
          className="flex size-10 items-center justify-center rounded-full text-ink-muted [&_svg]:size-4.5"
        >
          <IconPower />
        </button>
      ) : null}
    </div>
  );
}

/** 24px outline icon frame shared by the sidebar glyphs. */
function Stroke({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function IconMemory() {
  return (
    <Stroke>
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="12" cy="17" r="2.2" />
      <path d="m8 8 3 7" />
      <path d="m16 8-3 7" />
      <path d="M8.2 6.8 15.8 6.2" />
    </Stroke>
  );
}

function IconTimeline() {
  return (
    <Stroke>
      <path d="M12 3v18" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="12" cy="16" r="2" />
      <path d="M14 7h5" />
      <path d="M5 16h5" />
    </Stroke>
  );
}

function IconGhar() {
  return (
    <Stroke>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </Stroke>
  );
}

function IconChaavi() {
  return (
    <Stroke>
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H20" />
      <path d="M17 12v3" />
      <path d="M20 12v2" />
    </Stroke>
  );
}

function IconSystem() {
  return (
    <Stroke>
      <rect x="4" y="4" width="16" height="7" rx="2" />
      <rect x="4" y="13" width="16" height="7" rx="2" />
      <path d="M8 7.5h.01" />
      <path d="M8 16.5h.01" />
    </Stroke>
  );
}

function IconFolder() {
  return (
    <Stroke>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </Stroke>
  );
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

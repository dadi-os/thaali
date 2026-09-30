import { useState, useSyncExternalStore } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ChatSidebar } from "./chatSidebar";
import { DisconnectedState } from "./DisconnectedState";
import { MeshPowerOverlay } from "./MeshPowerOverlay";
import { MOBILE_PAGES, MobileSidebar, type MobileView } from "./MobileSidebar";
import { useConnection } from "../hooks/useConnection";
import { useNeedsProvisioning } from "../hooks/useNeedsProvisioning";
import {
  IconBack,
  IconMenu,
  IconNewChat,
} from "../shared/components/IconButton";
import { EASE, SLOW_S } from "../shared/lib/ux/motion";
import {
  clearRouterRuns,
  getChatState,
  openAgent,
  openRouter,
  subscribeChat,
} from "../store/chat";
import { getRunning, isRouterBusy, subscribeRunning } from "../store/running";
import { disconnectTransport } from "../store/connection";
import { usingTsnet, isMeshOnline } from "../shared/api";

/** Icon control in the mobile header: a 44pt touch target with no chrome. */
const HEADER_BUTTON =
  "flex size-11 shrink-0 items-center justify-center rounded-xl text-ink [&_svg]:size-5.5";

/**
 * Mobile shell. The router is home; the sidebar holds the pages and an Agents
 * folder of agent threads. Transport bootstrap is owned by AppShell.
 */
export function MobileChatShell() {
  const { state } = useConnection();
  const chat = useSyncExternalStore(subscribeChat, getChatState, getChatState);
  const running = useSyncExternalStore(subscribeRunning, getRunning, getRunning);
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const needsProvisioning = useNeedsProvisioning();

  const page = MOBILE_PAGES.find((p) => p.path === location.pathname) ?? null;
  const openAgentId =
    !page && chat.open.kind === "agent" ? chat.open.agentId : null;
  const view: MobileView = page
    ? { kind: "page", path: page.path }
    : openAgentId
      ? { kind: "agent", agentId: openAgentId }
      : { kind: "router" };

  const agentName = openAgentId
    ? (chat.conversations.find((c) => c.agent_id === openAgentId)?.agent_name ??
      openAgentId)
    : null;
  const lanes = openAgentId ? running[openAgentId] : undefined;
  const laneLabel = lanes?.conversation
    ? "THINKING"
    : lanes?.reasoning
      ? "WORKING"
      : "IDLE";
  const online = state === "connected";

  const showOnboarding = usingTsnet && needsProvisioning;
  const showPower =
    usingTsnet &&
    !needsProvisioning &&
    (state === "disconnected" || state === "connecting");

  const goRouter = () => {
    openRouter();
    navigate({ pathname: "/", search: location.search });
    setDrawerOpen(false);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-transparent">
      <motion.header
        className="z-20 flex shrink-0 items-center gap-1 bg-bone/55 px-2 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 backdrop-blur-[24px]"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: SLOW_S, ease: EASE }}
      >
        {view.kind === "agent" ? (
          <button
            type="button"
            onClick={goRouter}
            aria-label="Back to the router"
            className="flex h-11 shrink-0 items-center gap-0.5 pr-2 pl-1 text-[15px] text-sage-deep [&_svg]:size-4.5"
          >
            <IconBack />
            router
          </button>
        ) : (
          <button type="button" aria-label="Open sidebar" onClick={() => setDrawerOpen(true)} className={HEADER_BUTTON}>
            <IconMenu />
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col items-center">
          {view.kind === "page" ? (
            <span className="truncate text-[16px] font-semibold tracking-[-0.01em] text-ink">
              {page?.title}
            </span>
          ) : view.kind === "agent" ? (
            <>
              <span className="max-w-full truncate text-[16px] font-semibold tracking-[-0.01em] text-ink">
                {agentName}
              </span>
              <span className="text-[10.5px] font-medium tracking-[0.12em] text-sage-text">
                {laneLabel}
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
                router
              </span>
              <span
                className={`size-1.5 rounded-full ${online ? "bg-sage" : "bg-ink-ghost"}`}
                aria-label={online ? "online" : state}
              />
            </span>
          )}
        </div>

        {view.kind === "router" ? (
          <button type="button" aria-label="New message to the router" onClick={clearRouterRuns} className={HEADER_BUTTON}>
            <IconNewChat />
          </button>
        ) : view.kind === "agent" ? (
          <button type="button" aria-label="Open sidebar" onClick={() => setDrawerOpen(true)} className={HEADER_BUTTON}>
            <IconMenu />
          </button>
        ) : (
          <span className="size-11 shrink-0" aria-hidden />
        )}
      </motion.header>

      <motion.div
        className="relative min-h-0 flex-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: SLOW_S, ease: EASE, delay: 0.08 }}
      >
        {page ? (
          <div
            key={page.path}
            className="h-full min-h-0 overflow-hidden px-3 pt-2 pb-[env(safe-area-inset-bottom)]"
          >
            <Outlet />
          </div>
        ) : (
          <ChatSidebar variant="mobile" sessionKey={0} className="h-full" />
        )}
        {showPower ? <MeshPowerOverlay /> : null}
      </motion.div>

      <MobileSidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        view={view}
        connection={state}
        conversations={chat.conversations}
        running={running}
        routerBusy={isRouterBusy()}
        routerPreview={chat.routerRuns[chat.routerRuns.length - 1]?.content ?? null}
        canLeaveMesh={usingTsnet && isMeshOnline(state)}
        onOpenRouter={goRouter}
        onNewRouterMessage={() => {
          clearRouterRuns();
          goRouter();
        }}
        onOpenAgent={(agentId) => {
          openAgent(agentId);
          navigate({ pathname: "/", search: location.search });
          setDrawerOpen(false);
        }}
        onOpenPage={(path) => {
          navigate({ pathname: path, search: location.search });
          setDrawerOpen(false);
        }}
        onLeaveMesh={() => {
          setDrawerOpen(false);
          void disconnectTransport();
        }}
      />
      {showOnboarding ? <DisconnectedState /> : null}
    </div>
  );
}


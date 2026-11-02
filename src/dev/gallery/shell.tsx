import { useRef } from "react";
import { ConversationList, RailRow } from "../../chrome/chatSidebar/list";
import { Dock } from "../../chrome/chatSidebar/Dock";
import { ResizeHandle, type RailWidth } from "../../chrome/chatSidebar/ResizeHandle";
import { TitleBar } from "../../chrome/TitleBar";
import { OfflineNotice } from "../../shared/components/OfflineNotice";
import type { DraftAttachment } from "../../shared/lib/content/attachments";
import type { Conversation, HistoryStatus } from "../../store/chat";
import type { RunningMap } from "../../store/running";
import type { Scenario } from "../scenario";
import * as hath from "../fixtures/hath";
import { CASES } from "./cases";

/** The shell's cases: the title bar, the conversation rail in each of its states, its rows and handle, and the router dock. */

/** The agent whose conversation the rail highlights. */
const SELECTED = "finance-specialist";
const noop = () => undefined;

/** The fixtures' conversations, as the store holds them. */
function conversationsOf(scenario: Scenario): Conversation[] {
  return hath.threads(scenario).map(({ agent_id, agent_name, last_message, last_at, from_user }) => ({ agent_id, agent_name, last_message, last_at, from_user }));
}

/** The fixtures' unread counts, per agent. */
function unreadOf(scenario: Scenario): Record<string, number> {
  return Object.fromEntries(hath.threads(scenario).map((t) => [t.agent_id, t.unread]));
}

/** The fixtures' running lanes, per agent. */
function runningOf(scenario: Scenario): RunningMap {
  return Object.fromEntries(hath.agents(scenario).map((a) => [a.id, { work: a.running.work, process: a.running.process }]));
}

/** The user's messages to one agent in the fixtures: the draft texts the dock cases type. */
const USER_TEXTS = hath
  .messages("normal", "career-manager")
  .filter((m) => m.from_agent_id === null)
  .map((m) => m.content);
const DRAFT = USER_TEXTS[0]!;
const DRAFT_LONG = [...USER_TEXTS, ...USER_TEXTS, ...USER_TEXTS, ...USER_TEXTS].join("\n");
const ATTACHMENT: DraftAttachment = { media_type: "application/pdf", data: "", filename: "october-statement.pdf", sizeBytes: 184320 };

type RailCase = {
  scenario: Scenario;
  width: number;
  history: HistoryStatus;
  /** Highlight the selected agent's row. */
  selected?: boolean;
  offline?: boolean;
  routing?: boolean;
  handle?: { dragging: boolean };
  /** Message under the failed state. */
  error?: string;
};

/** A handle that only shows its width and whether it is being dragged. */
function handleOf(width: number, dragging: boolean): RailWidth {
  return { width, dragging, choose: noop, setDragging: noop, reset: noop };
}

/** The conversation rail as a case: search, list, dock and handle, 840 px tall. */
function Rail({ scenario, width, history, selected = false, offline = false, routing = false, handle = { dragging: false }, error }: RailCase) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const conversations = history === "loading" || history === "error" ? [] : conversationsOf(scenario);
  return (
    <aside className="rail" style={{ width, height: 840 }}>
      <ConversationList
        conversations={conversations}
        selectedAgentId={selected ? SELECTED : null}
        historyStatus={history}
        historyError={error ?? null}
        onRetry={noop}
        running={runningOf(scenario)}
        unread={unreadOf(scenario)}
        offline={offline}
        wide={width >= 440}
        now={Date.now()}
        onOpenAgent={noop}
        onDismissKeyboard={noop}
      />
      <Dock
        open={false}
        routing={routing}
        offline={offline}
        draft=""
        onDraft={noop}
        attachments={[]}
        onRemoveAttachment={noop}
        onPickFiles={noop}
        onAttach={noop}
        onOpen={noop}
        onClose={noop}
        onSend={noop}
        textareaRef={ref}
      />
      <ResizeHandle rail={handleOf(width, handle.dragging)} />
    </aside>
  );
}

for (const [name, notice] of [
  ["plain", null],
  ["reconnecting", <OfflineNotice key="r" text="Reconnecting to dadi…" />],
  ["unreachable", <OfflineNotice key="u" text="dadi unreachable" spin={false} />],
] as const) {
  CASES[`shell.titlebar.${name}`] = () => <TitleBar wordmark notice={notice} onHome={noop} />;
}

for (const width of [260, 300, 420, 560]) {
  CASES[`rail.normal.${width}`] = () => <Rail scenario="normal" width={width} history="ready" selected />;
}
CASES["rail.loading.300"] = () => <Rail scenario="normal" width={300} history="loading" />;
CASES["rail.empty.300"] = () => <Rail scenario="empty" width={300} history="ready" />;
CASES["rail.offline.300"] = () => <Rail scenario="normal" width={300} history="ready" offline />;
CASES["rail.error.300"] = () => <Rail scenario="normal" width={300} history="error" error="hath failed while handling GET /threads" />;
CASES["rail.long.300"] = () => <Rail scenario="long" width={300} history="ready" />;
CASES["rail.many.300"] = () => <Rail scenario="many" width={300} history="ready" />;
CASES["rail.routing.300"] = () => <Rail scenario="normal" width={300} history="ready" routing />;
CASES["rail.handle.hover"] = () => <Rail scenario="normal" width={300} history="ready" />;
CASES["rail.handle.focus"] = () => <Rail scenario="normal" width={300} history="ready" />;
CASES["rail.handle.drag"] = () => <Rail scenario="normal" width={300} history="ready" handle={{ dragging: true }} />;

const ROW = conversationsOf("normal").find((c) => c.agent_id === SELECTED)!;
const ROW_UNREAD = hath.threads("normal").find((t) => t.agent_id === SELECTED)!.unread;
const row = (selected: boolean, wide: boolean) => () => (
  <div style={{ width: 300, padding: "0 4px" }}>
    <RailRow conversation={ROW} unread={ROW_UNREAD} working selected={selected} wide={wide} now={Date.now()} onOpen={noop} />
  </div>
);
CASES["rail.row.rest"] = row(false, false);
CASES["rail.row.hover"] = row(false, false);
CASES["rail.row.active"] = row(false, false);
CASES["rail.row.selected"] = row(true, false);
CASES["rail.row.wide"] = row(false, true);

type DockCase = { open?: boolean; routing?: boolean; offline?: boolean; draft?: string; attachments?: DraftAttachment[]; height: number };

/** The dock in a 300 px frame like the rail's bottom, holding the state a case names. */
function DockFrame({ open = false, routing = false, offline = false, draft = "", attachments = [], height }: DockCase) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div style={{ position: "relative", width: 300, height, borderRadius: 14, border: "1px solid var(--glass-border)", background: "rgba(250,250,247,.55)", overflow: "hidden" }}>
      <Dock
        open={open}
        routing={routing}
        offline={offline}
        draft={draft}
        onDraft={noop}
        attachments={attachments}
        onRemoveAttachment={noop}
        onPickFiles={noop}
        onAttach={noop}
        onOpen={noop}
        onClose={noop}
        onSend={noop}
        textareaRef={ref}
      />
    </div>
  );
}

CASES["dock.idle"] = () => <DockFrame height={150} />;
CASES["dock.idle.hover"] = CASES["dock.idle"];
CASES["dock.idle.press"] = CASES["dock.idle"];
CASES["dock.idle.focus"] = CASES["dock.idle"];
CASES["dock.routing"] = () => <DockFrame height={150} routing />;
CASES["dock.offline"] = () => <DockFrame height={150} offline />;
CASES["dock.open.empty"] = () => <DockFrame height={190} open />;
CASES["dock.open.one"] = () => <DockFrame height={190} open draft="Check whether" />;
CASES["dock.open.three"] = () => <DockFrame height={230} open draft={DRAFT} />;
CASES["dock.open.many"] = () => <DockFrame height={330} open draft={DRAFT_LONG} />;
CASES["dock.open.attachment"] = () => <DockFrame height={320} open draft={DRAFT} attachments={[ATTACHMENT]} />;
CASES["dock.open.routing"] = () => <DockFrame height={230} open routing draft="Retry it." />;
CASES["dock.open.failed"] = () => <DockFrame height={230} open draft={DRAFT} />;
CASES["dock.open.send.hover"] = CASES["dock.open.one"];
CASES["dock.toggle.open"] = () => <DockFrame height={150} draft="" />;
CASES["dock.toggle.close"] = () => <DockFrame height={150} open draft="Check whether" />;

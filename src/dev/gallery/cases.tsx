import type { ReactNode } from "react";
import type { NasTask } from "../../shared/api/nas";
import type { AgentTask } from "../../types/hath";
import { agentTasks, nasTasks } from "../fixtures/tasks";
import { terminalCapture } from "../fixtures/nas";
import { Badge } from "../../shared/ui/Badge";
import { Button, ButtonGroup, IconButton, Pill, type ButtonSize, type ButtonTone } from "../../shared/ui/Button";
import { Dialog, DialogOption, Modal } from "../../shared/overlay/Overlay";
import { MenuItem, MenuPanel, PopoverPanel } from "../../shared/overlay/Floating";
import { TaskPreview } from "../../shared/components/Task/TaskPreview";
import { TaskRow } from "../../shared/components/Task/TaskRow";
import { TooltipBubble } from "../../shared/overlay/Tooltip";
import { Icon, ICON_NAMES } from "../../shared/ui/Icon";
import { Card } from "../../shared/ui/Card";
import { OfflineNotice } from "../../shared/states/OfflineNotice";
import { StaleBanner, StateView } from "../../shared/states/ModuleState";
import { Toast } from "../../shared/overlay/Toast";
import { Segmented } from "../../shared/ui/Segmented";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Clamp, NameTruncate, Truncate } from "../../shared/ui/Truncate";

/** Every gallery case by id, each the app's version of a design generator case (gen/gate.mjs). */
export const CASES: Record<string, () => ReactNode> = {};

/** The handler for a control whose case only shows its look. */
const noop = () => undefined;
const TONES: ButtonTone[] = ["outline", "sage", "quiet", "fill", "danger"];
const SIZES: ButtonSize[] = ["sm", "md", "lg", "xl"];

for (const tone of TONES) {
  for (const size of SIZES) {
    CASES[`button.${tone}.${size}`] = () => (
      <Button tone={tone} size={size}>
        Open thread
      </Button>
    );
  }
  CASES[`button.${tone}.pill`] = () => (
    <Button tone={tone} size="md" pill icon="retry">
      Retry
    </Button>
  );
}
for (const state of ["hover", "active", "focus"]) {
  CASES[`button.fill.md.${state}`] = () => <Button tone="fill">Open thread</Button>;
  CASES[`button.outline.md.${state}`] = () => <Button tone="outline">Edit</Button>;
}
CASES["button.group.equal"] = () => (
  <ButtonGroup>
    <Button tone="fill" size="lg" equal>
      Resume
    </Button>
    <Button tone="outline" size="lg" equal>
      Hand back
    </Button>
    <Button tone="danger" size="lg" equal>
      Stop
    </Button>
  </ButtonGroup>
);
CASES["button.fill.md.disabled"] = () => (
  <Button tone="fill" disabled>
    Open thread
  </Button>
);
CASES["button.outline.md.disabled"] = () => (
  <Button tone="outline" disabled>
    Edit
  </Button>
);
CASES["button.fill.md.selected"] = () => (
  <Button tone="fill" selected>
    Open thread
  </Button>
);
CASES["button.outline.md.selected"] = () => (
  <Button tone="outline" selected>
    Edit
  </Button>
);
CASES["button.icon.md.disabled"] = () => <IconButton icon="copy" label="Copy" disabled />;
CASES["button.icon.md.selected"] = () => <IconButton icon="copy" label="Copy" selected />;
CASES["icons.all"] = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, color: "var(--ink)" }}>
    {ICON_NAMES.map((name) => (
      <span key={name} style={{ display: "flex" }}>
        <Icon name={name} size={22} />
      </span>
    ))}
  </div>
);
CASES["button.icon.md"] = () => <IconButton icon="copy" label="Copy" />;
CASES["button.icon.md.hover"] = () => <IconButton icon="copy" label="Copy" />;
CASES["button.icon.lg"] = () => <IconButton icon="close" label="Close" size={36} />;
CASES["button.pill.rest"] = () => (
  <Pill count={18}>All</Pill>
);
CASES["button.pill.active"] = () => (
  <Pill active count={18}>
    All
  </Pill>
);
CASES["button.pill.active.hover"] = CASES["button.pill.active"];
for (const option of ["Day", "Week", "Month"] as const) {
  CASES[`segmented.${option.toLowerCase()}`] = () => <Segmented options={["Day", "Week", "Month"]} value={option} onChange={noop} />;
}

for (const status of ["working", "idle", "asleep", "asking", "paused"] as const) {
  CASES[`badge.${status}`] = () => <Badge status={status} />;
}
CASES["text.label"] = () => <span className="ui-label">Right now</span>;
CASES["text.mono"] = () => <Truncate text="task/browser/3f2a91" className="ui-mono" />;
CASES["text.trunc"] = () => <Truncate text="application-manager-archive-1010" />;
CASES["text.clamp"] = () => (
  <Clamp text="Reading the October statement to check the two pending charges against last month" lines={2} style={{ fontSize: 13.5, lineHeight: "19px" }} />
);
CASES["text.name.short"] = () => <NameTruncate name="finance-specialist" style={{ fontSize: 15 }} />;
CASES["text.name.cut"] = () => <NameTruncate name="networking-specialist" style={{ fontSize: 15 }} />;
CASES["skeleton.bar"] = () => <Skeleton width="100%" height={12} />;
CASES["card.plain"] = () => (
  <Card style={{ padding: 16, gap: 8 }}>
    <span style={{ fontSize: 15, fontWeight: 600 }}>Timeline</span>
    <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>5 sessions today</span>
  </Card>
);

CASES["pill.offline"] = () => <OfflineNotice text="dadi unreachable" spin={false} />;
CASES["banner.stale"] = () => <StaleBanner text="Showing what Nas reported 4 minutes ago" onRetry={noop} />;
CASES["state.error"] = () => (
  <div style={{ height: 220, display: "flex" }}>
    <StateView kind="error" title="Hath failed to answer" detail="GET /agents" service="hath" status={500} requestId="req_8f21c0" onRetry={noop} />
  </div>
);
CASES["state.error.compact"] = () => (
  <div style={{ height: 72, display: "flex" }}>
    <StateView kind="error" title="Hath failed to answer" detail="GET /agents · HTTP 500" compact onRetry={noop} />
  </div>
);
CASES["state.offline.dense"] = () => (
  <div style={{ height: 160, display: "flex" }}>
    <StateView kind="module-offline" title="Yaad isn’t answering" detail="yaad.dadi · HTTP 502" dense onRetry={noop} />
  </div>
);
CASES["state.empty"] = () => (
  <div style={{ height: 180, display: "flex" }}>
    <StateView kind="empty" title="No conversations yet" detail="Talk to Dadi to start one." />
  </div>
);

CASES["toast.info"] = () => <Toast kind="info" title="finance-specialist" body="Both pending charges are expected: Spotify and the gym." />;
CASES["toast.error"] = () => <Toast kind="error" title="Not sent, copied to your clipboard" body="hath failed while handling POST /router" />;
CASES["toast.ok.open"] = () => <Toast kind="ok" title="Password copied" body="It is cleared from the clipboard in 30 seconds." open />;
CASES["toast.info.hover"] = () => <Toast kind="info" title="finance-specialist" body="Both pending charges are expected: Spotify and the gym." />;

/** The services the log menu lists. */
const SERVICES = ["hath", "nas", "yaad", "ghar", "chaavi", "dwar"];
/** The log-service menu the design draws: a chosen first row and a row per service. */
const services = () => (
  <MenuPanel>
    <MenuItem label="All services" icon="grid" check on />
    {SERVICES.map((name) => (
      <MenuItem key={name} label={name} icon="server" />
    ))}
  </MenuPanel>
);
CASES["menu.panel"] = services;
CASES["menu.item.hover"] = services;
CASES["popover.panel"] = () => (
  <PopoverPanel>
    <span style={{ fontFamily: "var(--font-numeric)", fontSize: 12.5 }}>task/browser/3f2a91</span>
    <Clamp text="Read only. Chase checking and Sapphire card: October statement, then the two pending charges." lines={3} style={{ fontSize: 13.5, lineHeight: "19px" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Badge status="working" />
      <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>3 minutes ago</span>
    </div>
  </PopoverPanel>
);
CASES["tooltip.bubble"] = () => (
  <div style={{ position: "relative", width: 260, height: 60 }}>
    <TooltipBubble style={{ position: "absolute", top: 8, left: 8 }}>application-manager-archive-1010</TooltipBubble>
  </div>
);
CASES["dialog.resume"] = () => (
  <Dialog
    title="Hand it back?"
    subtitle="finance-specialist’s helper is paused on chase.com/accounts/statements/october."
    zIndex={5}
    footer={
      <>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--ink-muted)", lineHeight: "16px" }}>Either way the helper first sees the page and its own last step, not your keystrokes.</span>
        <Button tone="quiet" size="md">
          Keep driving
        </Button>
      </>
    }
  >
    <DialogOption tone="fill" title="Resume the loop" detail="It continues from where it paused, with the page as it is now." onClick={noop} />
    <DialogOption tone="outline" title="Hand back with a note" detail="It is told what you did and where things stand, then continues." onClick={noop} />
    <DialogOption tone="danger" title="Stop the task" detail="It goes to sleep and finance-specialist is told it was stopped." onClick={noop} />
  </Dialog>
);
CASES["modal.shell"] = () => (
  <Modal label="Browser 3f2a91" width={420} height={280} origin="50% 50%">
    <div style={{ padding: 24, fontSize: 14 }}>Header, page and footer go here</div>
  </Modal>
);

/** The fixture tasks the cases draw, by the state the case names. */
const TASKS = { working: "task/browser/3f2a91", waiting: "task/browser/d41e07", idle: "task/terminal/b7710c", asleep: "task/browser/8ecaaf" };
/** A task as Hath's session row and Nas's task describe it in the `asking` scenario. */
function taskFacts(id: string) {
  const nas = nasTasks("asking").find((task) => task.task === id);
  if (nas === undefined) {
    throw new Error(`no fixture task ${id}`);
  }
  const row = agentTasks("asking", nas.owner).find((task) => task.id === id);
  if (row === undefined) {
    throw new Error(`no session row for ${id}`);
  }
  return { nas, row };
}
/** A stand-in block for page content the gate does not draw: the design fills the frame with these. */
const placeholder = (width: number | string, height: number, radius = 6) => <span style={{ display: "block", width, height, borderRadius: radius, background: "rgba(44, 48, 42, 0.08)" }} />;
/** The preview of a task with stand-in content: the real screen is a live stream, so the gate fills the frame as the design draws it. */
export function previewOf(nas: NasTask, row: AgentTask, { tall = false, paused = false } = {}) {
  const shortId = nas.task.replace(/^task\//, "");
  const label = `Open ${nas.kind} task ${shortId}`;
  if (nas.kind === "terminal") {
    return (
      <TaskPreview kind="terminal" caption={nas.resource ? `${shortId} · ${nas.resource}` : shortId} label={label} paused={paused} onOpen={noop}>
        <pre style={{ margin: 0, padding: "10px 12px", fontFamily: "var(--font-numeric)", fontSize: 11.5, lineHeight: "17px", height: tall ? 288 : 132, overflow: "hidden", whiteSpace: "pre-wrap", overflowWrap: "anywhere", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div>{terminalCapture().output}</div>
        </pre>
      </TaskPreview>
    );
  }
  return (
    <TaskPreview kind="browser" caption={row.current} label={label} paused={paused} onOpen={noop}>
      <div style={{ height: tall ? 330 : 150, background: "linear-gradient(180deg, #f3f1ec, #e9e6df)", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {placeholder("46%", 16)}
        {placeholder("78%", 10)}
        {placeholder("64%", 10)}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {placeholder(96, 30, 15)}
          {placeholder(70, 30, 15)}
        </div>
      </div>
    </TaskPreview>
  );
}
/** The preview of a fixture task in the `asking` scenario. */
function preview(id: string, options: { tall?: boolean; paused?: boolean } = {}) {
  const { nas, row } = taskFacts(id);
  return previewOf(nas, row, options);
}
/** A task row for a fixture task, with its preview inside. */
function row(id: string, { open = false, paused = false } = {}) {
  const { nas, row: fact } = taskFacts(id);
  const task = paused ? { ...fact, status: "paused" as const } : fact;
  return (
    <TaskRow task={task} owner={nas.owner} showOwner question={nas.state} open={open} onToggle={noop}>
      {preview(id, { paused })}
    </TaskRow>
  );
}
CASES["task.row.working.closed"] = () => row(TASKS.working);
CASES["task.row.working.open"] = () => row(TASKS.working, { open: true });
CASES["task.row.working.paused"] = () => row(TASKS.working, { open: true, paused: true });
CASES["task.row.waiting.closed"] = () => row(TASKS.waiting);
CASES["task.row.idle.open"] = () => row(TASKS.idle, { open: true });
CASES["task.row.asleep.open"] = () => row(TASKS.asleep, { open: true });
CASES["task.row.working.hover"] = () => row(TASKS.working);
CASES["task.row.working.toggle"] = () => row(TASKS.working);
CASES["task.preview.browser"] = () => preview(TASKS.working);
CASES["task.preview.browser.hover"] = () => preview(TASKS.working);
CASES["task.preview.browser.paused"] = () => preview(TASKS.working, { paused: true });
CASES["task.preview.terminal"] = () => preview(TASKS.idle);
CASES["task.preview.terminal.tall"] = () => preview(TASKS.idle, { tall: true });

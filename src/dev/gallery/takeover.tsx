import type { CSSProperties, ReactNode } from "react";
import { terminalCapture } from "../fixtures/nas";
import { pageAddress } from "../../features/agents/sessions";
import { nasTasks } from "../fixtures/tasks";
import { LargeDialog } from "../../shared/overlay/LargeDialog";
import { TakeoverBrowser, TakeoverFooter, TakeoverHeader, TakeoverTerminal } from "../../features/agents/takeover/parts";
import { CASES } from "./cases";

/** The takeover modal's cases: the browser and the terminal, watching and in control, and the window at 960 and 1920. */

const noop = () => undefined;
const BROWSER = "task/browser/3f2a91";
const TERMINAL = "task/terminal/c5728f";

/** A stand-in block for page content the gate does not draw: the design fills the page with these. */
const block = (width: number | string, height: number, radius = 8): ReactNode => (
  <span style={{ display: "block", width, height, borderRadius: radius, background: "rgba(44, 48, 42, 0.08)" }} />
);

/** The picture the browser modal's page region holds, as the design draws it where the live stream will be. */
const PAGE: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  width: "min(100cqw, calc(100cqh * 16 / 9))",
  aspectRatio: "16 / 9",
  transform: "translate(-50%, -50%)",
  boxSizing: "border-box",
  background: "linear-gradient(180deg, #f7f5f0, #ece9e1)",
  padding: "36px 48px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

type TakeoverCase = {
  task: string;
  /** Ankur has taken over: the header says he is in control and the page or pane is ringed. */
  driving?: boolean;
  width?: number;
  height?: number;
};

/** The takeover modal for a fixture task, over a window of `width` x `height`, with stand-ins for the live page and pane. */
function takeover({ task, driving = false, width = 1440, height = 900 }: TakeoverCase) {
  const nas = nasTasks("normal").find((candidate) => candidate.task === task);
  if (nas === undefined || nas.resource === undefined) {
    throw new Error(`no fixture task ${task}`);
  }
  const state = driving ? "in-control" : "watching";
  const info = { task, kind: nas.kind, owner: nas.owner, purpose: nas.purpose, status: nas.status, resource: nas.resource };
  return (
    <div style={{ position: "relative", width, height }}>
      <LargeDialog open onClose={noop} label={`${nas.kind === "browser" ? "Browser" : "Terminal"} ${nas.id}`}>
        <TakeoverHeader task={info} state={state} onTakeover={noop} onReturn={noop} onMenu={noop} onClose={noop} />
        {nas.kind === "browser" ? (
          <TakeoverBrowser url={pageAddress(nas.active_url)} task={task} controlling={driving} onBack={noop} onReload={noop}>
            <div style={PAGE}>
              {block("34%", 26)}
              {block("68%", 14)}
              {block("56%", 14)}
              {block("62%", 14)}
              <div style={{ height: 12 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {block(220, 120, 14)}
                {block(220, 120, 14)}
                {block(220, 120, 14)}
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {block(132, 40, 20)}
                {block(96, 40, 20)}
              </div>
            </div>
          </TakeoverBrowser>
        ) : (
          <TakeoverTerminal controlling={driving}>
            <pre style={{ margin: 0, padding: 16, flex: 1 }}>{terminalCapture().output}</pre>
          </TakeoverTerminal>
        )}
        <TakeoverFooter kind={nas.kind} resource={nas.resource} state={state} />
      </LargeDialog>
    </div>
  );
}

CASES["takeover.browser.watch"] = () => takeover({ task: BROWSER });
CASES["takeover.browser.drive"] = () => takeover({ task: BROWSER, driving: true });
CASES["takeover.terminal.watch"] = () => takeover({ task: TERMINAL });
CASES["takeover.terminal.drive"] = () => takeover({ task: TERMINAL, driving: true });
CASES["takeover.browser.drive.960"] = () => takeover({ task: BROWSER, driving: true, width: 960 });
CASES["takeover.browser.drive.1920"] = () => takeover({ task: BROWSER, driving: true, width: 1920, height: 1080 });
CASES["takeover.terminal.drive.1920"] = () => takeover({ task: TERMINAL, driving: true, width: 1920, height: 1080 });

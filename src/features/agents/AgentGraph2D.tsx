import { Fragment, useRef, useState } from "react";
import type { AgentRecord } from "../../types/hath";
import { childrenOf, layoutForest, nodeRadius, viewForest, type ForestLink, type ForestNode, type ForestOptions, type GraphLabel, type GraphLabels, type GraphView } from "./graph2d";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { agentActions } from "./actions";
import { isLive, type LaneState } from "./laneState";

/** The fill of a node by what its agent is doing: sage on a lane, tide on the process lane alone, a bone ring while it waits. */
const FILL: Record<LaneState, string> = { both: "#8fa382", working: "#8fa382", processing: "#7d9aa6", waiting: "var(--bone)", idle: "#b6bdac" };

export type AgentGraph2DProps = {
  agents: AgentRecord[];
  /** What each agent is doing; a live agent's node has a ring that spreads. */
  stateOf: (agent: AgentRecord) => LaneState;
  /** The pixels the graph is drawn into; it is scaled to them, so names stay legible however far it shrinks. */
  width: number;
  height: number;
  /** Which names are written; a hovered node's name is always written. Changing it moves nothing. */
  labels: GraphLabels;
  /** Whose names the fit makes room for; defaults to `labels`, or every name when `labels` is `live`. Set it when `labels` follows activity so the layout does not. */
  reserve?: Exclude<GraphLabels, "live">;
  /** Scales the nodes; 1 for a whole-page graph, smaller for a tile. */
  nodeScale: number;
  /** The radius of the first ring and the distance between rings; a page spreads them wider than a tile. */
  layout?: ForestOptions;
  /** Scales the names. */
  fontScale?: number;
  /** The agent whose node is ringed in ink. */
  selectedId?: string | null;
  /** The agents a filter leaves out, drawn faint. */
  dimmed?: ReadonlySet<string> | null;
  /** Picks an agent; given, every node answers a click and grows under the pointer. */
  onPick?: (agent: AgentRecord, anchor: DOMRect) => void;
};

/** The path of a link: a curve that bows a little away from the straight line. */
function curve({ from, to }: ForestLink): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  return `M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${(mx + (to.y - from.y) * 0.06).toFixed(1)} ${(my - (to.x - from.x) * 0.06).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
}

/** The ring of a node: ink while it is the selected one, else by what its agent is doing. */
function ringOf(state: LaneState, selected: boolean): string {
  if (selected) {
    return "var(--ink)";
  }
  return state === "waiting" ? "#8fa382" : state === "both" ? "#7d9aa6" : "var(--bone)";
}

type AgentNodeProps = {
  agent: AgentRecord;
  state: LaneState;
  /** The node's centre and radius in the graph's own units, as the strings the SVG takes. */
  cx: string;
  cy: string;
  r: number;
  stroke: string;
  strokeWidth: number;
  dimmed: boolean;
  /** The pointer entered (the agent) or left (null) the node. */
  onHover: (agent: AgentRecord | null) => void;
  onPick?: (agent: AgentRecord, anchor: DOMRect) => void;
};

/** One agent's node: a circle that answers a click when the graph picks, and a right-click menu with the agent's actions. */
function AgentNode({ agent, state, cx, cy, r, stroke, strokeWidth, dimmed, onHover, onPick }: AgentNodeProps) {
  const ref = useRef<SVGCircleElement>(null);
  const context = useContextActions(() => agentActions(agent, { onShowDetails: onPick === undefined ? undefined : () => onPick(agent, ref.current!.getBoundingClientRect()) }));
  return (
    <circle
      ref={ref}
      {...context}
      onPointerEnter={() => onHover(agent)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(agent)}
      onBlur={() => onHover(null)}
      role={onPick === undefined ? undefined : "button"}
      tabIndex={onPick === undefined ? undefined : 0}
      aria-label={onPick === undefined ? undefined : `Open ${agent.name}`}
      onKeyDown={
        onPick === undefined
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onPick(agent, event.currentTarget.getBoundingClientRect());
              }
            }
      }
      className={onPick === undefined ? undefined : "gnode"}
      opacity={dimmed ? 0.2 : undefined}
      onClick={
        onPick === undefined
          ? undefined
          : (event) => {
              event.preventDefault();
              event.stopPropagation();
              onPick(agent, event.currentTarget.getBoundingClientRect());
            }
      }
      cx={cx}
      cy={cy}
      r={r}
      fill={FILL[state]}
      stroke={stroke}
      strokeWidth={strokeWidth}
    >
      <title>{`${agent.name} · ${state}`}</title>
    </circle>
  );
}

type NodeNameProps = {
  node: ForestNode;
  view: GraphView;
  nodeScale: number;
  /** Whether the name is drawn now; it fades between shown and hidden at the same place. */
  visible: boolean;
  /** The node's agent is filtered out. */
  faint: boolean;
  /** Drawn above the other names and fading in when it appears: `own` for the hovered node, in strong type, and `child` for one of its subagents, in normal type. */
  raised?: "own" | "child";
  /** Where the name goes when that is not the place the view reserved for it, as a hovered group's names may take. */
  at?: GraphLabel;
};

/** One node's name at the place the view reserved for it (or `at`), faded in or out by `visible`; it ignores the pointer. */
function NodeName({ node, view, nodeScale, visible, faint, raised, at }: NodeNameProps) {
  const label = at ?? view.names.get(node)!;
  const strong = raised === "child" ? false : node.depth === 1 || isLive(node.state) || raised === "own";
  const r = view.unit(nodeRadius(node.depth, nodeScale));
  return (
    <text
      x={(node.x + (label.right ? 1 : -1) * (r + view.unit(7))).toFixed(1)}
      y={(node.y + label.dy + label.size * 0.35).toFixed(1)}
      textAnchor={label.right ? "start" : "end"}
      fontFamily="Inter, system-ui, sans-serif"
      fontSize={label.size}
      fontWeight={strong ? 600 : 500}
      fill={strong || raised === "child" ? "var(--ink)" : "var(--ink-muted)"}
      paintOrder="stroke"
      stroke="var(--bone)"
      strokeWidth={view.unit(3)}
      strokeLinejoin="round"
      pointerEvents="none"
      aria-hidden={visible ? undefined : true}
      style={{ opacity: visible ? (faint ? 0.25 : 1) : 0, transition: "opacity var(--slow) var(--ease)", animation: raised === undefined ? undefined : "fade var(--slow) var(--ease) both" }}
    >
      {label.name}
    </text>
  );
}

/** The agents as a radial forest in one SVG that fills its positioned parent: a node per agent, a line per parent, and a name beside the nodes `labels` picks and the hovered (or focused) one together with the names of its subagents. Which names show never moves a node or the fit. */
export function AgentGraph2D({ agents, stateOf, width, height, labels, reserve, nodeScale, layout, fontScale, selectedId = null, dimmed = null, onPick }: AgentGraph2DProps) {
  const [hovered, setHovered] = useState<AgentRecord | null>(null);
  const view = viewForest(layoutForest(agents, stateOf, layout), { labels, reserve: reserve ?? (labels === "live" ? "all" : labels), width, height, nodeScale, fontScale });
  const { nodes, links, unit } = view;
  const hoveredNode = hovered === null ? undefined : nodes.find((n) => n.agent.id === hovered.id);
  const group = hoveredNode === undefined ? new Map<ForestNode, GraphLabel>() : view.focus([hoveredNode, ...childrenOf(links, hoveredNode)]);
  /** A subagent whose name is already written where the hover would put it needs no second copy. */
  const written = (n: ForestNode) => n !== hoveredNode && view.shown.has(n) && group.get(n) !== undefined && group.get(n)!.right === view.names.get(n)!.right && group.get(n)!.dy === view.names.get(n)!.dy;
  const moved = (n: ForestNode) => group.has(n) && n !== hoveredNode && !written(n);
  return (
    <svg
      viewBox={view.viewBox.map((x) => x.toFixed(0)).join(" ")}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Agent graph: ${nodes.length} agents`}
    >
      <g>
        {links.map((link) => {
          const live = isLive(link.to.state) || isLive(link.from.state);
          return (
            <path
              key={`${link.from.agent.id}>${link.to.agent.id}`}
              d={curve(link)}
              fill="none"
              stroke={live ? "rgba(143,163,130,.8)" : "rgba(185,201,171,.65)"}
              strokeWidth={unit(live ? 1.6 : 1.1)}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <g>
        {nodes.map((n) => {
          const r = unit(nodeRadius(n.depth, nodeScale));
          const x = n.x.toFixed(1);
          const y = n.y.toFixed(1);
          const selected = n.agent.id === selectedId;
          return (
            <Fragment key={n.agent.id}>
              {isLive(n.state) ? <circle cx={x} cy={y} r={r} fill="#8fa382" style={{ transformOrigin: `${x}px ${y}px`, animation: "ring 2.2s ease-out infinite" }} /> : null}
              <AgentNode
                agent={n.agent}
                state={n.state}
                cx={x}
                cy={y}
                r={r}
                strokeWidth={unit(selected ? 2.4 : n.state === "waiting" || n.state === "both" ? 2 : 1.5)}
                stroke={ringOf(n.state, selected)}
                dimmed={dimmed?.has(n.agent.id) ?? false}
                onHover={setHovered}
                onPick={onPick}
              />
            </Fragment>
          );
        })}
      </g>
      <g>
        {nodes.map((n) => (
          <NodeName key={n.agent.id} node={n} view={view} nodeScale={nodeScale} visible={view.shown.has(n) && !moved(n)} faint={dimmed?.has(n.agent.id) ?? false} />
        ))}
      </g>
      <g>
        {[...group.entries()]
          .filter(([n]) => !written(n))
          .map(([n, at]) => (
            <NodeName key={n.agent.id} node={n} view={view} nodeScale={nodeScale} visible faint={n !== hoveredNode && (dimmed?.has(n.agent.id) ?? false)} raised={n === hoveredNode ? "own" : "child"} at={at} />
          ))}
      </g>
    </svg>
  );
}

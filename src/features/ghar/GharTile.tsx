import { useEffect, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { RISE } from "../../shared/motion";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Switch } from "../../shared/ui/Switch";
import { Truncate } from "../../shared/ui/Truncate";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { pushToast } from "../../contexts/toasts";
import type { GharDevice } from "../../types/ghar";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { isLight, isOn, lightColor, sectionSwitch, switchCommand, tagLights, untaggedDevices } from "./model";
import { useHouse, type House } from "./useHouse";

const CARD_HEIGHT = 72;
/** A lone light's node: its height and the gap between nodes, in px. */
const NODE_HEIGHT = 30;
const NODE_GAP = 8;
/** The most rows of lone-light nodes the tile gives up room to. */
const NODE_ROWS = 2;

/** Keeps a click inside a tile's control from following the tile's link. */
function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

type LightProps = {
  light: GharDevice;
  house: House;
};

/** One light in a tag card: its colour dot and name, and a switch that flips just this light; the tile's link does not follow the click. */
function Light({ light, house }: LightProps) {
  const on = light.state.on?.value === true;
  const flip = (event: MouseEvent) => {
    swallow(event);
    void house.run([{ id: light.id, command: switchCommand(!isOn(light)) }]);
  };
  return (
    <motion.button
      {...RISE}
      layout="position"
      type="button"
      className={`ui-trans ui-hover-fill -mx-1 flex h-5 w-[calc(100%+8px)] items-center gap-2 rounded-[6px] px-1 text-left text-[13px] ${on ? "text-ink" : "text-ink-muted"} ${light.online ? "" : "opacity-45"}`}
      aria-pressed={on}
      title={`Switch ${on ? "off" : "on"} ${light.name}`}
      disabled={!house.connected || !light.online || house.pending.has(light.id)}
      onClick={flip}
    >
      <span className={`dot size-2 ${on ? "" : "border border-sage-line"}`} style={{ background: lightColor(light) }} />
      <Truncate text={light.name} className="min-w-0 flex-1" />
    </motion.button>
  );
}

type TagsProps = {
  lights: GharDevice[];
  geometry: TileGeometry;
  house: House;
};

type NodesProps = {
  lights: GharDevice[];
  width: number;
  house: House;
};

/** The width a lone light's node takes: its dot and name, capped. */
function nodeWidth(light: GharDevice): number {
  return Math.min(168, 34 + light.name.length * 7);
}

/** The lights that carry no tag, each its own small node: a dot and its name, one tap flips just that light; the ones that do not fit in two rows fold into a count. */
function Nodes({ lights, width, house }: NodesProps) {
  const navigate = useNavigate();
  const placed: GharDevice[] = [];
  let row = 0;
  let used = 0;
  for (const light of lights) {
    const w = nodeWidth(light);
    if (used > 0 && used + NODE_GAP + w > width) {
      row += 1;
      used = 0;
    }
    if (row >= NODE_ROWS) {
      break;
    }
    used += (used > 0 ? NODE_GAP : 0) + w;
    placed.push(light);
  }
  const left = lights.length - placed.length;
  return (
    <div className="flex flex-none flex-wrap content-start gap-2">
      <AnimatePresence initial={false}>
        {placed.map((light) => (
          <motion.button
            key={light.id}
            {...RISE}
            layout="position"
            type="button"
            aria-pressed={isOn(light)}
            title={`Switch ${isOn(light) ? "off" : "on"} ${light.name}`}
            disabled={!house.connected || !light.online || house.pending.has(light.id)}
            className={`ui-hover-card ui-trans flex items-center gap-2 rounded-full border px-3 text-[13px] ${isOn(light) ? "border-[rgba(240,168,104,.45)] bg-[rgba(240,168,104,.12)] text-ink" : "border-glass-border bg-sage-fill text-ink-muted"} ${light.online ? "" : "opacity-45"}`}
            style={{ height: NODE_HEIGHT, maxWidth: 168 }}
            onClick={(event) => {
              swallow(event);
              void house.run([{ id: light.id, command: switchCommand(!isOn(light)) }]);
            }}
          >
            <span className={`dot size-2 flex-none ${isOn(light) ? "" : "border border-sage-line"}`} style={{ background: lightColor(light) }} />
            <Truncate text={light.name} />
          </motion.button>
        ))}
      </AnimatePresence>
      {left > 0 ? (
        <button type="button" className="ui-hover-fill ui-trans flex items-center rounded-full px-3 text-[13px] text-ink-muted tabular-nums" style={{ height: NODE_HEIGHT }} onClick={(event) => { swallow(event); navigate("/ghar"); }}>
          {`+${left}`}
        </button>
      ) : null}
    </div>
  );
}

/**
 * A card per tag with how many of its lights are on and, when the card is tall enough, the lights themselves; a light is on every card
 * of a tag it carries, and the lights with no tag sit under the cards as small nodes of their own. Tags that do not fit collapse into a last card that opens the Ghar page.
 */
function Tags({ lights, geometry, house }: TagsProps) {
  const navigate = useNavigate();
  const cards = tagLights(lights);
  const bare = untaggedDevices(lights);
  const nodeRows = bare.length === 0 ? 0 : Math.min(NODE_ROWS, Math.max(1, Math.ceil(bare.reduce((sum, light) => sum + nodeWidth(light) + NODE_GAP, 0) / geometry.iw)));
  const nodesHeight = nodeRows === 0 ? 0 : nodeRows * NODE_HEIGHT + (nodeRows - 1) * NODE_GAP + 8;
  const room = Math.max(0, geometry.bh - nodesHeight);
  const maxColumns = geometry.iw >= 640 ? 4 : geometry.iw >= 440 ? 3 : 2;
  const columns = Math.max(1, Math.min(maxColumns, cards.length));
  const rowsFit = Math.max(1, Math.floor((room + 8) / CARD_HEIGHT));
  const slots = columns * rowsFit;
  const shown = cards.length <= slots ? cards : cards.slice(0, slots - 1);
  const extra = cards.length - shown.length;
  const rows = Math.ceil((shown.length + (extra > 0 ? 1 : 0)) / columns);
  const cell = (room - 8 * (rows - 1)) / rows;
  const listed = Math.max(0, Math.min(4, Math.floor((cell - 62) / 22)));
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
    {cards.length === 0 ? <div className="flex-1" /> : (
    <div className="grid min-h-0 min-w-0 flex-1 auto-rows-[minmax(0,1fr)] gap-2" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
      <AnimatePresence initial={false}>
        {shown.map((card) => (
          <motion.div
            key={card.key}
            {...RISE}
            layout="position"
            role="button"
            tabIndex={0}
            aria-pressed={card.on > 0}
            className={`ui-hover-card ui-trans flex min-h-0 min-w-0 cursor-pointer flex-col gap-1 rounded-[14px] border px-3 pt-3 pb-3 text-left ${card.on > 0 ? "border-[rgba(240,168,104,.45)] bg-[rgba(240,168,104,.12)]" : "border-glass-border bg-sage-fill"}`}
            title={`Switch ${card.on > 0 ? "off" : "on"} ${card.name}`}
            onClick={(event) => {
              swallow(event);
              void house.run(sectionSwitch(card.lights));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                void house.run(sectionSwitch(card.lights));
              }
            }}
          >
            <div className="flex min-w-0 text-[14px] font-semibold">
              <Truncate text={card.name} />
            </div>
            <span className="text-[13px] text-ink-muted tabular-nums">{`${card.on} of ${card.lights.length} on`}</span>
            <div className="flex-1" />
            {listed === 0 ? null : (
              <div className="flex flex-col gap-0.5">
                <AnimatePresence initial={false}>
                  {card.lights.length <= listed
                    ? card.lights.map((light) => <Light key={light.id} light={light} house={house} />)
                    : listed === 1
                      ? [<span key="count" className="flex h-5 items-center text-[13px] text-ink-muted tabular-nums">{`${card.lights.length} lights`}</span>]
                      : [
                          ...card.lights.slice(0, listed - 1).map((light) => <Light key={light.id} light={light} house={house} />),
                          <span key="more" className="flex h-5 items-center text-[12px] text-ink-muted tabular-nums">{`+${card.lights.length - (listed - 1)} more`}</span>,
                        ]}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      {extra > 0 ? (
        <button
          type="button"
          aria-label="Show all tags"
          className="ui-hover-fill ui-trans flex min-h-0 items-center justify-center gap-2 rounded-[14px] border border-dashed border-sage-line text-[14px] font-medium text-sage-text"
          onClick={(event) => {
            swallow(event);
            navigate("/ghar");
          }}
        >
          <span className="tabular-nums">{`${extra} more`}</span>
        </button>
      ) : null}
    </div>
    )}
    {bare.length > 0 ? <Nodes lights={bare} width={geometry.iw} house={house} /> : null}
    </div>
  );
}

/** Home's Ghar tile: a card per tag with how many of its lights are on and, when tall enough, the lights; a tap switches the whole tag, and one switch in the header is for every light. */
export function GharTile({ order }: { order: number }) {
  const house = useHouse();
  const query = house.devicesQuery;
  const state = useModuleState(query, (answer) => answer.devices.filter(isLight).length === 0);
  const lights = state.kind === "ready" ? state.data.devices.filter(isLight) : [];
  const on = lights.filter(isOn).length;
  useEffect(() => {
    if (house.failure !== null) {
      pushToast({ key: "ghar:tile", tone: "error", title: "Ghar", body: house.failure });
    }
  }, [house.failure]);
  return (
    <Tile
      area="ghar"
      title="Ghar"
      to="/ghar"
      order={order}
      summary={lights.length > 0 ? `${on} of ${lights.length} on` : undefined}
      right={
        state.kind === "ready" ? (
          <span onClick={swallow} className="-mt-1 flex">
            <Switch on={on > 0} label="All lights" onChange={() => void house.run(sectionSwitch(lights))} />
          </span>
        ) : undefined
      }
      loading={state.kind === "loading"}
      notice={tileNotice(state, { name: "Ghar", request: "GET /devices", empty: ["No lights yet", "Lights appear here once Ghar finds them."] }, () => void query.refetch())}
      skeleton={(g) => {
        const columns = g.iw >= 440 ? 3 : 2;
        return (
          <div className="grid min-w-0 flex-1 auto-rows-[minmax(64px,1fr)] gap-2" style={{ gridTemplateColumns: `repeat(${columns},1fr)` }}>
            {Array.from({ length: columns === 3 ? 3 : 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-[14px] bg-sage-fill p-3">
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <Skeleton width={12} height={12} radius={6} />
                  <Skeleton width={12} height={12} radius={6} />
                  <Skeleton width={12} height={12} radius={6} />
                </div>
              </div>
            ))}
          </div>
        );
      }}
    >
      {(g) => <Tags lights={lights} geometry={g} house={house} />}
    </Tile>
  );
}

import { useEffect, type MouseEvent } from "react";
import { motion } from "motion/react";
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

/** A tag card's narrowest and widest, in px: a card keeps a card's shape however wide the tile is, and the band of cards scrolls sideways past what fits. */
const CARD_MIN = 208;
const CARD_MAX = 380;
/** A light's pill: its height inside a card and as a lone light, the gap between pills and what a card spends on its own header and padding, in px. */
const PILL_SMALL = 26;
const PILL_LARGE = 30;
const PILL_GAP = 6;
const CARD_CHROME = 52;
/** The strip of lone lights under the cards: the room it takes with its hairline, and its gap above the cards, in px. */
const STRIP = PILL_LARGE + 13;
const BAND_GAP = 12;

/** Keeps a click inside a tile's control from following the tile's link. */
function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/** The width a light's pill takes: its dot and name, capped. */
function pillWidth(light: GharDevice): number {
  return Math.min(176, 38 + light.name.length * 6);
}

/** The lights that fit in `rows` rows of pills `width` wide, in order, and how many were left out. */
function pack(lights: GharDevice[], width: number, rows: number): { placed: GharDevice[]; left: number } {
  const placed: GharDevice[] = [];
  let row = 0;
  let used = 0;
  for (const light of lights) {
    const w = pillWidth(light);
    if (used > 0 && used + PILL_GAP + w > width) {
      row += 1;
      used = 0;
    }
    if (row >= rows) {
      break;
    }
    used += (used > 0 ? PILL_GAP : 0) + w;
    placed.push(light);
  }
  return { placed, left: lights.length - placed.length };
}

type PillProps = {
  light: GharDevice;
  house: House;
  /** The pill's height, in px. */
  height: number;
  /** The pill sits on a tag's card, whose own wash it lightens, and not on the tile. */
  inCard?: boolean;
};

/** One light as a pill: its colour dot and name; a tap flips just this light, and the tile's link does not follow it. */
function LightPill({ light, house, height, inCard = false }: PillProps) {
  const on = isOn(light);
  return (
    <motion.button
      {...RISE}
      layout="position"
      type="button"
      aria-pressed={on}
      title={`Switch ${on ? "off" : "on"} ${light.name}`}
      disabled={!house.connected || !light.online || house.pending.has(light.id)}
      className={`ui-trans flex flex-none items-center gap-2 rounded-full border px-2.5 text-[12.5px] ${
        on
          ? `border-[rgba(240,168,104,.45)] ${inCard ? "bg-[rgba(255,255,255,.55)]" : "bg-[rgba(240,168,104,.12)]"} text-ink`
          : `border-glass-border ${inCard ? "bg-[rgba(255,255,255,.4)]" : "bg-sage-fill"} text-ink-muted`
      } hover:border-sage-line ${light.online ? "" : "opacity-45"}`}
      style={{ height, maxWidth: 176 }}
      onClick={(event) => {
        swallow(event);
        void house.run([{ id: light.id, command: switchCommand(!on) }]);
      }}
    >
      <span className={`dot size-2 flex-none ${on ? "" : "border border-sage-line"}`} style={{ background: lightColor(light) }} />
      <Truncate text={light.name} />
    </motion.button>
  );
}

type TagsProps = {
  lights: GharDevice[];
  geometry: TileGeometry;
  house: House;
};

/**
 * Two bands, the way the Chaavi and System tiles are built: the tags as cards in a row that scrolls sideways, each saying
 * how many of its lights are on (a tap switches the whole tag) and listing its lights as pills while it has the height; and
 * under them a strip that scrolls the same way for the lights that carry no tag, each one a pill of its own. A light is on
 * every card of a tag it carries.
 */
function Tags({ lights, geometry, house }: TagsProps) {
  const cards = tagLights(lights);
  const bare = untaggedDevices(lights);
  const bandHeight = Math.max(0, geometry.bh - (bare.length === 0 || cards.length === 0 ? 0 : STRIP + BAND_GAP));
  const cardWidth = Math.min(CARD_MAX, Math.max(CARD_MIN, cards.length === 0 ? CARD_MIN : (geometry.iw - BAND_GAP * (cards.length - 1)) / cards.length));
  const pillRows = Math.max(0, Math.floor((bandHeight - CARD_CHROME + PILL_GAP) / (PILL_SMALL + PILL_GAP)));
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ gap: BAND_GAP }}>
      {cards.length === 0 ? null : (
        <div className="scroll flex min-h-0 flex-1 gap-2.5 overflow-x-auto">
          {cards.map((card) => {
            const { placed, left } = pack(card.lights, cardWidth - 28, pillRows);
            return (
              <div
                key={card.key}
                role="button"
                tabIndex={0}
                aria-pressed={card.on > 0}
                title={`Switch ${card.on > 0 ? "off" : "on"} ${card.name}`}
                className={`ui-hover-card ui-trans flex min-h-0 flex-none cursor-pointer flex-col gap-2 rounded-[16px] border px-3.5 py-3 text-left ${card.on > 0 ? "border-[rgba(240,168,104,.45)] bg-[rgba(240,168,104,.12)]" : "border-glass-border bg-sage-fill"}`}
                style={{ width: cardWidth }}
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
                <div className="flex min-w-0 items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 text-[14px] font-semibold">
                    <Truncate text={card.name} />
                  </span>
                  <span className="flex-none text-[12.5px] text-ink-muted tabular-nums">{`${card.on} of ${card.lights.length} on`}</span>
                </div>
                {pillRows === 0 ? null : (
                  <div className="flex flex-wrap content-start" style={{ gap: PILL_GAP }}>
                    {placed.map((light) => (
                      <LightPill key={light.id} light={light} house={house} height={PILL_SMALL} inCard />
                    ))}
                    {left > 0 ? (
                      <span className="flex items-center px-1 text-[12px] text-ink-muted tabular-nums" style={{ height: PILL_SMALL }}>
                        {`+${left}`}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {bare.length === 0 ? null : (
        <div className={`scroll flex flex-none items-center gap-2 overflow-x-auto ${cards.length === 0 ? "" : "border-t border-rule pt-3"}`} style={{ height: cards.length === 0 ? undefined : STRIP }}>
          {cards.length === 0 ? null : <span className="flex-none text-[12.5px] text-ink-muted">No tag</span>}
          {bare.map((light) => (
            <LightPill key={light.id} light={light} house={house} height={PILL_LARGE} />
          ))}
        </div>
      )}
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

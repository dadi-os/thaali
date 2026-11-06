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

/** A tag column's narrowest and widest, in px: a column keeps a card's shape however wide the tile is. */
const COLUMN_MIN = 200;
const COLUMN_MAX = 300;
/** A light's row inside a tag's column, in px. */
const LIGHT_ROW = 28;
/** What a tag column spends on its header and padding, in px. */
const CARD_CHROME = 48;
/** A lone light's pill, and the room its strip takes with its hairline and the gap above it, in px. */
const PILL_HEIGHT = 30;
const STRIP = PILL_HEIGHT + 13;
const BAND_GAP = 12;

/** Keeps a click inside a tile's control from following the tile's link. */
function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

type LightRowProps = {
  light: GharDevice;
  house: House;
};

/** One light as a row: its colour dot and name; a tap flips just this light, and the tile's link does not follow it. */
function LightRow({ light, house }: LightRowProps) {
  const on = isOn(light);
  return (
    <motion.button
      {...RISE}
      layout="position"
      type="button"
      aria-pressed={on}
      title={`Switch ${on ? "off" : "on"} ${light.name}`}
      disabled={!house.connected || !light.online || house.pending.has(light.id)}
      className={`ui-trans ui-hover-fill flex w-full items-center gap-2.5 rounded-[10px] px-2 text-left text-[13px] ${on ? "text-ink" : "text-ink-muted"} ${light.online ? "" : "opacity-45"}`}
      style={{ height: LIGHT_ROW }}
      onClick={(event) => {
        swallow(event);
        void house.run([{ id: light.id, command: switchCommand(!on) }]);
      }}
    >
      <span className={`dot size-2 flex-none ${on ? "" : "border border-sage-line"}`} style={{ background: lightColor(light) }} />
      <Truncate text={light.name} className="min-w-0 flex-1" />
    </motion.button>
  );
}

type PillProps = {
  light: GharDevice;
  house: House;
};

/** One light that carries no tag, as a pill of its own: its colour dot and name; a tap flips just this light, and the tile's link does not follow it. */
function LightPill({ light, house }: PillProps) {
  const on = isOn(light);
  return (
    <motion.button
      {...RISE}
      layout="position"
      type="button"
      aria-pressed={on}
      title={`Switch ${on ? "off" : "on"} ${light.name}`}
      disabled={!house.connected || !light.online || house.pending.has(light.id)}
      className={`ui-trans flex flex-none items-center gap-2 rounded-full border px-3 text-[13px] hover:border-sage-line ${
        on ? "border-[rgba(240,168,104,.45)] bg-[rgba(240,168,104,.12)] text-ink" : "border-glass-border bg-sage-fill text-ink-muted"
      } ${light.online ? "" : "opacity-45"}`}
      style={{ height: PILL_HEIGHT, maxWidth: 176 }}
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
 * Two bands. Above, a row of columns that scrolls sideways: one per tag, headed by its name and how many of its lights are on
 * (a tap on the header switches the whole tag), its lights stacked under it, one tap each; a light is in every column of a tag
 * it carries; a column shows the lights that fit its height and counts the rest. Below, a strip
 * that scrolls sideways for the lights that carry no tag, each one a pill of its own.
 */
function Tags({ lights, geometry, house }: TagsProps) {
  const cards = tagLights(lights);
  const bare = untaggedDevices(lights);
  const width = Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, cards.length === 0 ? COLUMN_MIN : (geometry.iw - 10 * (cards.length - 1)) / cards.length));
  const band = geometry.bh - (bare.length === 0 || cards.length === 0 ? 0 : STRIP + BAND_GAP);
  const rowsFit = Math.max(1, Math.floor((band - CARD_CHROME) / (LIGHT_ROW + 2)));
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ gap: BAND_GAP }}>
      {cards.length === 0 ? (
        <div className="flex-1" />
      ) : (
        <div className="scroll flex min-h-0 flex-1 items-start gap-2.5 overflow-x-auto overflow-y-hidden">
          {cards.map((card) => (
            <section
              key={card.key}
              className={`flex flex-none flex-col gap-0.5 rounded-[16px] border p-1.5 ${card.on > 0 ? "border-[rgba(240,168,104,.45)] bg-[rgba(240,168,104,.12)]" : "border-glass-border bg-sage-fill"}`}
              style={{ width }}
            >
              <button
                type="button"
                aria-pressed={card.on > 0}
                title={`Switch ${card.on > 0 ? "off" : "on"} ${card.name}`}
                className="ui-trans ui-hover-fill flex min-w-0 items-baseline justify-between gap-3 rounded-[10px] px-2 py-1 text-left"
                onClick={(event) => {
                  swallow(event);
                  void house.run(sectionSwitch(card.lights));
                }}
              >
                <span className="min-w-0 flex-1 text-[14px] font-semibold">
                  <Truncate text={card.name} />
                </span>
                <span className="flex-none text-[12.5px] text-ink-muted tabular-nums">{`${card.on} of ${card.lights.length} on`}</span>
              </button>
              {(card.lights.length <= rowsFit ? card.lights : card.lights.slice(0, Math.max(0, rowsFit - 1))).map((light) => (
                <LightRow key={light.id} light={light} house={house} />
              ))}
              {card.lights.length <= rowsFit ? null : (
                <span className="flex items-center px-2 text-[12.5px] text-ink-muted tabular-nums" style={{ height: LIGHT_ROW }}>
                  {`+${card.lights.length - Math.max(0, rowsFit - 1)} more`}
                </span>
              )}
            </section>
          ))}
        </div>
      )}
      {bare.length === 0 ? null : (
        <div className={`scroll flex flex-none items-center gap-2 overflow-x-auto ${cards.length === 0 ? "" : "border-t border-rule pt-3"}`} style={{ height: cards.length === 0 ? undefined : STRIP }}>
          {cards.length === 0 ? null : <span className="flex-none text-[12.5px] text-ink-muted">No tag</span>}
          {bare.map((light) => (
            <LightPill key={light.id} light={light} house={house} />
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

import { useEffect, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { RISE } from "../../shared/motion";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Switch } from "../../shared/ui/Switch";
import { NameTruncate, Truncate } from "../../shared/ui/Truncate";
import { useModuleState } from "../../shared/hooks/useModuleState";
import { pushToast } from "../../contexts/toasts";
import type { GharDevice } from "../../types/ghar";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { isLight, isOn, lightColor, roomTitle, sectionSwitch, switchCommand, UNASSIGNED_ROOM } from "./model";
import { useHouse, type House } from "./useHouse";

const ROOM_HEIGHT = 72;

type Room = { name: string; lights: GharDevice[]; on: number };

/** Keeps a click inside a tile's control from following the tile's link. */
function swallow(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
}

/** The lights grouped by the room they are in: rooms with a light on first, the rest after, and the lights that belong to no room last. */
function roomsOf(lights: GharDevice[]): Room[] {
  const names = [...new Set(lights.map((light) => light.room.name))];
  const rooms = names.map((name) => {
    const own = lights.filter((light) => light.room.name === name);
    return { name, lights: own, on: own.filter(isOn).length };
  });
  const rank = (room: Room) => (room.name === UNASSIGNED_ROOM ? 2 : room.on > 0 ? 0 : 1);
  return rooms.map((room, index) => ({ room, index })).sort((a, b) => rank(a.room) - rank(b.room) || a.index - b.index).map((entry) => entry.room);
}

type LightProps = {
  light: GharDevice;
  house: House;
};

/** One light in a room tile: its colour dot and name, and a switch that flips just this light; the tile's link does not follow the click. */
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

type RoomsProps = {
  lights: GharDevice[];
  geometry: TileGeometry;
  house: House;
};

/** A card per room with how many of its lights are on and, when the card is tall enough, the lights themselves; rooms that do not fit collapse into a last card that opens the Ghar page. */
function Rooms({ lights, geometry, house }: RoomsProps) {
  const navigate = useNavigate();
  const rooms = roomsOf(lights);
  const maxColumns = geometry.iw >= 640 ? 4 : geometry.iw >= 440 ? 3 : 2;
  const columns = Math.max(1, Math.min(maxColumns, rooms.length));
  const rowsFit = Math.max(1, Math.floor((geometry.bh + 8) / ROOM_HEIGHT));
  const slots = columns * rowsFit;
  const shown = rooms.length <= slots ? rooms : rooms.slice(0, slots - 1);
  const extra = rooms.length - shown.length;
  const rows = Math.ceil((shown.length + (extra > 0 ? 1 : 0)) / columns);
  const cell = (geometry.bh - 8 * (rows - 1)) / rows;
  const listed = Math.max(0, Math.min(4, Math.floor((cell - 62) / 22)));
  return (
    <div className="grid min-h-0 min-w-0 flex-1 auto-rows-[minmax(0,1fr)] gap-2" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
      <AnimatePresence initial={false}>
        {shown.map((room) => (
          <motion.div
            key={room.name}
            {...RISE}
            layout="position"
            role="button"
            tabIndex={0}
            aria-pressed={room.on > 0}
            className={`ui-hover-card ui-trans flex min-h-0 min-w-0 cursor-pointer flex-col gap-1 rounded-[14px] border px-3 pt-3 pb-3 text-left ${room.on > 0 ? "border-[rgba(240,168,104,.45)] bg-[rgba(240,168,104,.12)]" : "border-glass-border bg-sage-fill"}`}
            title={`Switch ${room.on > 0 ? "off" : "on"} ${roomTitle(room.name)}`}
            onClick={(event) => {
              swallow(event);
              void house.run(sectionSwitch(room.lights));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                void house.run(sectionSwitch(room.lights));
              }
            }}
          >
            <div className="flex min-w-0 text-[14px] font-semibold">
              <NameTruncate name={roomTitle(room.name)} />
            </div>
            <span className="text-[13px] text-ink-muted tabular-nums">{`${room.on} of ${room.lights.length} on`}</span>
            <div className="flex-1" />
            {listed === 0 ? null : (
              <div className="flex flex-col gap-0.5">
                <AnimatePresence initial={false}>
                  {room.lights.length <= listed
                    ? room.lights.map((light) => <Light key={light.id} light={light} house={house} />)
                    : listed === 1
                      ? [<span key="count" className="flex h-5 items-center text-[13px] text-ink-muted tabular-nums">{`${room.lights.length} lights`}</span>]
                      : [
                          ...room.lights.slice(0, listed - 1).map((light) => <Light key={light.id} light={light} house={house} />),
                          <span key="more" className="flex h-5 items-center text-[12px] text-ink-muted tabular-nums">{`+${room.lights.length - (listed - 1)} more`}</span>,
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
          aria-label="Show all rooms"
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
  );
}

/** Home's Ghar tile: a tile per room with its lights, how many are on, and one switch for all of them. */
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
      {(g) => <Rooms lights={lights} geometry={g} house={house} />}
    </Tile>
  );
}

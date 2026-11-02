import type { MouseEvent } from "react";
import { Icon } from "../../shared/components/Icon";
import { Skeleton } from "../../shared/components/Skeleton";
import { NameTruncate, Truncate } from "../../shared/components/Truncate";
import { useModuleState } from "../../shared/hooks/useModuleState";
import type { GharDevice } from "../../types/ghar";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { isLight, isOn, lightColor, sectionSwitch } from "./model";
import { useHouse } from "./useHouse";

const ROOM_HEIGHT = 72;

type Room = { name: string; lights: GharDevice[]; on: number };

/** The lights grouped by the room they are in, rooms in the order their first light appears. */
function roomsOf(lights: GharDevice[]): Room[] {
  const names = [...new Set(lights.map((light) => light.room.name))];
  return names.map((name) => {
    const own = lights.filter((light) => light.room.name === name);
    return { name, lights: own, on: own.filter(isOn).length };
  });
}

/** One light in a room tile: its colour dot and name. */
function Light({ light }: { light: GharDevice }) {
  const on = light.state.on?.value === true;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 20, fontSize: 12.5, color: on ? "var(--ink)" : "var(--ink-muted)" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: lightColor(light), border: on ? "none" : "1px solid var(--sage-line)", flex: "none" }} />
      <Truncate text={light.name} style={{ flex: 1, minWidth: 0 }} />
    </div>
  );
}

type RoomsProps = {
  lights: GharDevice[];
  geometry: TileGeometry;
};

/** A tile per room with how many of its lights are on and, when the tile is tall enough, the lights themselves, then a tile to add a room. */
function Rooms({ lights, geometry }: RoomsProps) {
  const rooms = roomsOf(lights);
  const columns = geometry.iw >= 640 ? 4 : geometry.iw >= 440 ? 3 : 2;
  const rowsFit = Math.max(1, Math.floor((geometry.bh + 8) / ROOM_HEIGHT));
  const slots = columns * rowsFit;
  const shown = rooms.length + 1 <= slots ? rooms : rooms.slice(0, slots - 1);
  const extra = rooms.length - shown.length;
  const cell = (geometry.bh - 8 * (rowsFit - 1)) / rowsFit;
  const listed = Math.max(0, Math.min(4, Math.floor((cell - 64) / 22)));
  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gridAutoRows: "minmax(0,1fr)", gap: 8 }}>
      {shown.map((room) => (
        <button
          key={room.name}
          type="button"
          className="ui-hover-card ui-trans"
          title={`Open ${room.name} in Ghar`}
          style={{ display: "flex", flexDirection: "column", gap: 3, padding: "12px 12px 10px", borderRadius: 14, textAlign: "left", minWidth: 0, minHeight: 0, background: room.on > 0 ? "rgba(240,168,104,.12)" : "var(--sage-fill)", border: `1px solid ${room.on > 0 ? "rgba(240,168,104,.45)" : "var(--glass-border)"}` }}
        >
          <NameTruncate name={room.name} style={{ fontSize: 14, fontWeight: 600 }} />
          <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{`${room.on} of ${room.lights.length} on`}</span>
          <div style={{ flex: 1 }} />
          {listed === 0 ? null : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {room.lights.length <= listed
                ? room.lights.map((light) => <Light key={light.id} light={light} />)
                : listed === 1
                  ? [<span key="count" style={{ fontSize: 12.5, color: "var(--ink-muted)", height: 20, display: "flex", alignItems: "center" }}>{`${room.lights.length} lights`}</span>]
                  : [
                      ...room.lights.slice(0, listed - 1).map((light) => <Light key={light.id} light={light} />),
                      <span key="more" style={{ fontSize: 12, color: "var(--ink-muted)", height: 20, display: "flex", alignItems: "center" }}>{`+${room.lights.length - (listed - 1)} more`}</span>,
                    ]}
            </div>
          )}
        </button>
      ))}
      <button type="button" className="ui-hover-fill ui-trans" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 14, border: "1px dashed var(--sage-line)", color: "var(--sage-text)", fontSize: 13.5, fontWeight: 500, minHeight: 0 }}>
        <Icon name="plus" size={14} />
        {extra > 0 ? `${extra} more` : "New room"}
      </button>
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
  const toggle = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    void house.run(sectionSwitch(lights));
  };
  return (
    <Tile
      area="ghar"
      title="Ghar"
      to="/ghar"
      order={order}
      summary={lights.length > 0 ? `${on} of ${lights.length} on` : undefined}
      right={
        state.kind === "ready" ? (
          <button
            role="switch"
            type="button"
            aria-checked={on > 0 ? "true" : "false"}
            aria-label="All lights"
            className="ui-trans"
            onClick={toggle}
            style={{ width: 52, height: 32, borderRadius: 999, background: on > 0 ? "var(--sage-deep)" : "var(--rule)", position: "relative", flex: "none", marginTop: -4 }}
          >
            <span style={{ position: "absolute", top: 3, left: on > 0 ? 23 : 3, width: 26, height: 26, borderRadius: "50%", background: "var(--bone)", boxShadow: "0 1px 3px rgba(44,48,42,.3)" }} />
          </button>
        ) : undefined
      }
      loading={state.kind === "loading"}
      notice={tileNotice(state, { name: "Ghar", request: "GET /devices", empty: ["No lights yet", "Lights appear here once Ghar finds them."] }, () => void query.refetch())}
      skeleton={(g) => {
        const columns = g.iw >= 440 ? 3 : 2;
        return (
          <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: `repeat(${g.iw >= 440 ? 3 : 2},1fr)`, gridAutoRows: "minmax(64px,1fr)", gap: 8 }}>
            {Array.from({ length: columns === 3 ? 3 : 4 }, (_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 14, background: "var(--sage-fill)" }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={11} />
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Skeleton width={10} height={10} radius={5} />
                  <Skeleton width={10} height={10} radius={5} />
                  <Skeleton width={10} height={10} radius={5} />
                </div>
              </div>
            ))}
          </div>
        );
      }}
    >
      {(g) => <Rooms lights={lights} geometry={g} />}
    </Tile>
  );
}

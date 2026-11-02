import { DeviceTile } from "../../features/ghar/DeviceTile";
import { Inspector } from "../../features/ghar/Inspector";
import { RoomSection, SECTION_SHUT } from "../../features/ghar/RoomSection";
import type { GharDevice } from "../../types/ghar";
import { devices, rooms } from "../fixtures/ghar";
import { CASES } from "./cases";

/** Ghar's controls in the states a page cannot be put in by a URL: a command in flight, and Ghar unreachable with its last reading on screen. */

const noop = () => undefined;
const house = devices("normal");
const desk = house.find((device) => device.name === "Desk Lamp")!;
const kettle: GharDevice = { ...desk, id: "kettle", name: "Kettle", kind: "plug", capabilities: [{ capability: "on_off", config: {} }], state: { on: desk.state.on! }, tags: [] };
const living = house.filter((device) => device.room.name === "Living room");

/** A tile as the Ghar page draws it, alone. */
function Tile({ device, selected = false, busy = false, disabled = false }: { device: GharDevice; selected?: boolean; busy?: boolean; disabled?: boolean }) {
  return <DeviceTile device={device} selected={selected} busy={busy} disabled={disabled} onToggle={noop} onLevel={noop} onSelect={noop} />;
}

CASES["ghar.tile.busy"] = () => <Tile device={desk} busy />;
CASES["ghar.tile.disabled"] = () => <Tile device={desk} disabled />;
CASES["ghar.tile.selected.plug"] = () => <Tile device={kettle} selected />;

CASES["ghar.section.disabled"] = () => (
  <RoomSection
    section={{ kind: "room", key: "living", title: "Living room", room: living[0]!.room, devices: living }}
    elsewhere={[]}
    ui={SECTION_SHUT}
    onUi={noop}
    selectedId={null}
    busy={new Set()}
    disabled
    minTile={210}
    onToggle={noop}
    onLevel={noop}
    onSelect={noop}
    onSwitch={noop}
    onSectionLevel={noop}
    onRename={noop}
    onMoveHere={noop}
    onAddHere={noop}
    onDelete={noop}
  />
);

CASES["ghar.inspector.disabled"] = () => (
  <Inspector device={desk} rooms={rooms("normal")} groups={["Reading"]} width={360} pick={null} onPick={noop} renaming={false} onRenaming={noop} disabled onClose={noop} onSend={noop} onRename={noop} onMove={noop} onTags={noop} onIdentify={noop} />
);

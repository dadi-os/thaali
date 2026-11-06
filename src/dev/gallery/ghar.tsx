import { DeviceTile } from "../../features/ghar/DeviceTile";
import { Inspector } from "../../features/ghar/Inspector";
import { SECTION_SHUT, TagSection } from "../../features/ghar/TagSection";
import type { GharDevice } from "../../types/ghar";
import { devices } from "../fixtures/ghar";
import { CASES } from "./cases";

/** Ghar's controls in the states a page cannot be put in by a URL: a command in flight, and Ghar unreachable with its last reading on screen. */

const noop = () => undefined;
const house = devices("normal");
const desk = house.find((device) => device.name === "Desk Lamp")!;
const kettle: GharDevice = { ...desk, id: "kettle", name: "Kettle", kind: "plug", capabilities: [{ capability: "on_off", config: {} }], state: { on: desk.state.on! }, tags: [] };
const reading = house.filter((device) => device.tags.some((tag) => tag.name === "reading"));

/** A tile as the Ghar page draws it, alone. */
function Tile({ device, selected = false, busy = false, disabled = false }: { device: GharDevice; selected?: boolean; busy?: boolean; disabled?: boolean }) {
  return <DeviceTile device={device} selected={selected} busy={busy} disabled={disabled} onToggle={noop} onLevel={noop} onSelect={noop} />;
}

CASES["ghar.tile.busy"] = () => <Tile device={desk} busy />;
CASES["ghar.tile.disabled"] = () => <Tile device={desk} disabled />;
CASES["ghar.tile.selected.plug"] = () => <Tile device={kettle} selected />;

CASES["ghar.section.disabled"] = () => (
  <TagSection
    title="reading"
    tag={reading[0]!.tags.find((tag) => tag.name === "reading")!}
    devices={reading}
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
    deviceActions={() => []}
    onSwitch={noop}
    onSectionLevel={noop}
    onRename={noop}
    onAddDevice={noop}
    onDelete={noop}
  />
);

CASES["ghar.inspector.disabled"] = () => (
  <Inspector device={desk} tags={["all lights", "reading"]} width={360} renaming={false} onRenaming={noop} disabled onClose={noop} onSend={noop} onRename={noop} onTags={noop} onIdentify={noop} />
);

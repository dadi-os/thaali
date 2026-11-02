import type { GharAttributeState, GharDevice, GharRoom, GharTag } from "../../types/ghar";
import type { Scenario } from "../scenario";
import { ago, HOUR, MIN } from "./time";

const ROOMS: GharRoom[] = [
  { id: "r0000000-0000-4000-8000-000000000001", name: "unassigned" },
  { id: "r0000000-0000-4000-8000-000000000002", name: "Ankur's room" },
  { id: "r0000000-0000-4000-8000-000000000003", name: "Living room" },
  { id: "r0000000-0000-4000-8000-000000000004", name: "Kitchen" },
];

const READING: GharTag = { id: "t0000000-0000-4000-8000-000000000001", name: "Reading" };

function state(entries: Record<string, unknown>, minutes: number): Record<string, GharAttributeState> {
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, { value, changed_at: ago(minutes * MIN) }]));
}

function device(index: number, partial: Pick<GharDevice, "name" | "kind" | "capabilities" | "state"> & { room: number; online?: boolean; tags?: GharTag[] }): GharDevice {
  return {
    id: `d0000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    name: partial.name,
    kind: partial.kind,
    product_name: "Smart RGBTW Bulb",
    bridge_name: null,
    room: ROOMS[partial.room]!,
    tags: partial.tags ?? [],
    capabilities: partial.capabilities,
    online: partial.online ?? true,
    last_seen_at: ago(5 * MIN),
    state: partial.state,
  };
}

const LIGHT_CAPS: GharDevice["capabilities"] = [
  { capability: "on_off", config: {} },
  { capability: "level", config: { max: 100, min: 0 } },
  { capability: "color", config: { modes: ["hue_sat", "color_temp"] } },
];

/** Ghar `GET /rooms`. */
export function rooms(scenario: Scenario): GharRoom[] {
  return scenario === "empty" ? [ROOMS[0]!] : ROOMS;
}

/** Ghar `GET /devices`. */
export function devices(scenario: Scenario): GharDevice[] {
  if (scenario === "empty") {
    return [];
  }
  const long = scenario === "long";
  const base = [
    device(1, { name: "Desk Lamp", kind: "light", room: 1, tags: [READING], capabilities: LIGHT_CAPS, state: state({ on: true, brightness: 100, color_temp: 356, hue: 19, saturation: 159, color_mode: "color_temp" }, 90) }),
    device(2, { name: long ? "Bedside lamp with the very long name that the user gave it years ago" : "Bedside Lamp", kind: "light", room: 1, tags: [READING], capabilities: LIGHT_CAPS, state: state({ on: false, brightness: 40, color_temp: 400, color_mode: "color_temp" }, 200) }),
    device(3, { name: "Floor Lamp", kind: "light", room: 2, tags: [READING], capabilities: LIGHT_CAPS, state: state({ on: true, brightness: 62, hue: 210, saturation: 180, color_mode: "hue_sat" }, 12) }),
    device(4, { name: "Ceiling Light", kind: "light", room: 2, online: false, capabilities: LIGHT_CAPS, state: state({ on: true, brightness: 80 }, 600) }),
    device(5, { name: "Counter Lights", kind: "light", room: 3, capabilities: LIGHT_CAPS, state: state({ on: true, brightness: 30, color_temp: 300, color_mode: "color_temp" }, 30) }),
    device(6, { name: "Window Blind", kind: "cover", room: 2, capabilities: [{ capability: "cover", config: {} }], state: state({ lift_percent_open: 60 }, 120) }),
    device(7, { name: "Thermostat", kind: "thermostat", room: 2, capabilities: [{ capability: "thermostat", config: {} }], state: state({ local_temperature: 21.5, heat_setpoint: 21 }, 4) }),
    device(8, { name: "Hallway Sensor", kind: "occupancy", room: 0, capabilities: [{ capability: "sensor", config: {} }], state: state({ occupied: false }, 8 * HOUR / MIN) }),
  ];
  if (scenario !== "many") {
    return base;
  }
  const shelves = Array.from({ length: 7 }, (_, index) =>
    device(9 + index, { name: `Shelf Light ${index + 1}`, kind: "light", room: 2, capabilities: LIGHT_CAPS, state: state({ on: index % 2 === 0, brightness: 40 + index * 8, color_temp: 330, color_mode: "color_temp" }, 20 + index) }),
  );
  return [...base, ...shelves];
}

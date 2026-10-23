import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ghar } from "../../shared/api";
import type { GharCommand, GharDevice, GharRoom } from "../../types/ghar";
import { REVEAL } from "../../shared/lib/ux/motion";
import { Pill, Switch, Track } from "./controls";
import { IconChevron } from "./icons";
import {
  activePreset,
  brightness,
  colorModes,
  colorName,
  glow,
  has,
  hue,
  hueCommand,
  isOn,
  kelvinLabel,
  levelCommand,
  presetsFor,
  roomTitle,
  switchCommand,
  temperatureCommand,
  UNASSIGNED_ROOM,
  warmth,
  warmthFraction,
  warmthMireds,
} from "./model";
import type { House } from "./useHouse";

/** The Warmth track, warm to cool. */
const WARMTH_GRADIENT = "linear-gradient(90deg, #ffb46b, #ffe7c4, #f4f7ff, #c9daff)";

/** The Color track, once around the hue wheel. */
const HUE_GRADIENT = "linear-gradient(90deg, #ff6b6b, #ffb86b, #fff06b, #7be38a, #6bc8ff, #8e7bff, #ff6bd6, #ff6b6b)";

type InspectorProps = {
  /** The selected device, or null before one is picked. */
  device: GharDevice | null;
  rooms: GharRoom[];
  /** Every group in the house, by name. */
  groups: string[];
  house: House;
};

/**
 * The page's one panel: the selected device's name (click to rename), switch, brightness
 * pill, Warmth and Color sliders and presets, then its Room and Groups pickers.
 */
export function Inspector({ device, rooms, groups, house }: InspectorProps) {
  return (
    <aside aria-label="Selected device" className="ghar-inspector">
      {device ? (
        <DeviceControls key={device.id} device={device} rooms={rooms} groups={groups} house={house} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="text-[16px] font-semibold text-ink">Nothing selected</span>
          <span className="text-[13px] leading-relaxed text-ink-muted">
            Hold a tile, right-click it or use its controls button to adjust it here.
          </span>
        </div>
      )}
    </aside>
  );
}

type DeviceControlsProps = InspectorProps & { device: GharDevice };

function DeviceControls({ device, rooms, groups, house }: DeviceControlsProps) {
  const [renaming, setRenaming] = useState(false);
  const [open, setOpen] = useState<"room" | "groups" | null>(null);
  const disabled = !house.connected || !device.online || house.pending.has(device.id);
  const on = isOn(device);
  const modes = colorModes(device);
  const mireds = warmth(device);
  const shownHue = hue(device);
  const presets = presetsFor(device);
  const active = activePreset(device);
  const send = (command: GharCommand) => house.run([{ id: device.id, command }]);

  const rename = async (name: string) => {
    const trimmed = name.trim();
    setRenaming(false);
    if (trimmed.length > 0 && trimmed !== device.name) {
      await house.write(`Renaming ${device.name}`, () => ghar.renameDevice(device.id, trimmed));
    }
  };

  const tagged = device.tags.map((tag) => tag.name);
  const setTags = (next: string[]) => house.write(`Grouping ${device.name}`, () => ghar.setDeviceTags(device.id, next));

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {renaming ? (
            <input
              autoFocus
              defaultValue={device.name}
              aria-label="Device name"
              onBlur={(event) => void rename(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setRenaming(false);
                }
              }}
              className="ghar-inline-input text-[20px] font-bold"
            />
          ) : (
            <button
              type="button"
              title="Rename"
              onClick={() => setRenaming(true)}
              className="truncate text-left text-[20px] font-bold text-ink hover:text-sage-deep"
            >
              {device.name}
            </button>
          )}
          <span className="truncate text-[13px] text-ink-muted">
            {[roomTitle(device.room.name), device.product_name, device.online ? null : "Offline"]
              .filter((part): part is string => part !== null)
              .join(" · ")}
          </span>
        </div>
        {has(device, "on_off") ? (
          <Switch on={on} label={`Switch ${device.name}`} disabled={disabled} onChange={(next) => void send(switchCommand(next))} />
        ) : null}
      </div>

      {has(device, "level") ? (
        <div className="flex justify-center pt-[26px] pb-[22px]">
          <Pill
            value={brightness(device)}
            color={glow(device)}
            on={on}
            disabled={disabled}
            onCommit={(level) => send(levelCommand(level))}
          />
        </div>
      ) : (
        <div className="h-6" />
      )}

      {modes.includes("color_temp") ? (
        <Track
          label="Warmth"
          reading={mireds === null ? "–" : kelvinLabel(mireds)}
          value={mireds === null ? null : warmthFraction(mireds)}
          gradient={WARMTH_GRADIENT}
          disabled={disabled}
          onCommit={(fraction) => send(temperatureCommand(warmthMireds(fraction)))}
        />
      ) : null}
      {modes.includes("hue_sat") ? (
        <div className="pt-4">
          <Track
            label="Color"
            reading={colorName(device) ?? "–"}
            value={shownHue === null ? null : shownHue.hue / 254}
            gradient={HUE_GRADIENT}
            disabled={disabled}
            onCommit={(fraction) => send(hueCommand(Math.round(fraction * 254), shownHue === null ? 254 : shownHue.saturation))}
          />
        </div>
      ) : null}
      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-3 pt-[18px]">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              aria-label={preset.name}
              aria-pressed={active === preset.name}
              title={preset.name}
              disabled={disabled}
              onClick={() => void send(preset.command)}
              className={`ghar-preset ${active === preset.name ? "ghar-preset--on" : ""}`}
              style={{ background: preset.swatch }}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col pt-5">
        <Picker
          label="Room"
          value={roomTitle(device.room.name)}
          open={open === "room"}
          onToggle={() => setOpen(open === "room" ? null : "room")}
        >
          {[...rooms]
            .sort((a, b) => Number(a.name === UNASSIGNED_ROOM) - Number(b.name === UNASSIGNED_ROOM))
            .map((room) => (
              <label key={room.id} className="ghar-pick">
                <input
                  type="radio"
                  name={`room-${device.id}`}
                  checked={room.id === device.room.id}
                  disabled={!house.connected}
                  onChange={() => void house.write(`Moving ${device.name}`, () => ghar.moveDevice(device.id, room.id))}
                />
                {roomTitle(room.name)}
              </label>
            ))}
        </Picker>
        <Picker
          label="Groups"
          value={tagged.length === 0 ? "None" : tagged.join(", ")}
          open={open === "groups"}
          onToggle={() => setOpen(open === "groups" ? null : "groups")}
        >
          {groups.map((name) => (
            <label key={name} className="ghar-pick">
              <input
                type="checkbox"
                checked={tagged.includes(name)}
                disabled={!house.connected}
                onChange={(event) =>
                  void setTags(event.currentTarget.checked ? [...tagged, name] : tagged.filter((tag) => tag !== name))
                }
              />
              {name}
            </label>
          ))}
          <input
            placeholder="New group"
            aria-label="New group"
            disabled={!house.connected}
            onKeyDown={(event) => {
              const name = event.currentTarget.value.trim();
              if (event.key === "Enter" && name.length > 0) {
                event.currentTarget.value = "";
                if (!tagged.includes(name)) {
                  void setTags([...tagged, name]);
                }
              }
            }}
            className="ghar-inline-input mt-1 text-[14px]"
          />
        </Picker>
      </div>
    </>
  );
}

type PickerProps = {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A row that reads "Room · Ankur's room ›" and opens its choices beneath it. */
function Picker({ label, value, open, onToggle, children }: PickerProps) {
  return (
    <div className="border-t border-rule">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-[46px] w-full items-center justify-between gap-3 text-[14px] text-ink"
      >
        <span>{label}</span>
        <span className="flex min-w-0 items-center gap-1 text-ink-muted">
          <span className="truncate">{value}</span>
          <span className="size-3.5 shrink-0">
            <IconChevron open={open} />
          </span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div {...REVEAL} className="overflow-hidden">
            <div className="flex flex-col gap-1 pb-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

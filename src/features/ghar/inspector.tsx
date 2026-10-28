import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ghar } from "../../shared/api";
import type { GharCommand, GharDevice, GharRoom } from "../../types/ghar";
import { REVEAL } from "../../shared/lib/ux/motion";
import { formatRelative } from "../../shared/lib/ux/time";
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

/** The Warmth track, warm at the bottom to cool at the top. */
const WARMTH_GRADIENT = "linear-gradient(0deg, #f6a35c, #fbd3a6, #fdf1e4, #eef2fb)";

/** The Color track, once around the hue wheel from the bottom. */
const HUE_GRADIENT = "linear-gradient(0deg, #ff6b6b, #ffb86b, #fff06b, #7be38a, #6bc8ff, #8e7bff, #ff6bd6, #ff6b6b)";

type InspectorProps = {
  /** The selected device, or null before one is picked. */
  device: GharDevice | null;
  rooms: GharRoom[];
  /** Every group in the house, by name. */
  groups: string[];
  house: House;
};

/**
 * The page's one panel: the selected device's name (click to rename) and switch, its tall
 * Brightness, Warmth and Color sliders, the named presets, then what the device is, its
 * connection, its last change, and its Room and Groups pickers.
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
  const level = brightness(device);
  const state = !device.online ? "Offline" : has(device, "on_off") ? (on ? (level === null ? "On" : `On · ${Math.round(level)}%`) : "Off") : null;
  const changed = Object.values(device.state)
    .map((attribute) => attribute.changed_at)
    .reduce<string | null>((latest, at) => (latest === null || at > latest ? at : latest), null);
  const seen = device.last_seen_at;
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
            {[roomTitle(device.room.name), state].filter((part): part is string => part !== null).join(" · ")}
          </span>
        </div>
        {has(device, "on_off") ? (
          <Switch on={on} label={`Switch ${device.name}`} disabled={disabled} onChange={(next) => void send(switchCommand(next))} />
        ) : null}
      </div>

      {has(device, "level") || modes.length > 0 ? (
        <div className="flex justify-center gap-4 pt-[26px]">
          {has(device, "level") ? (
            <Labelled label="Brightness">
              <Pill value={level} color={glow(device)} on={on} disabled={disabled} onCommit={(next) => send(levelCommand(next))} />
            </Labelled>
          ) : null}
          {modes.includes("color_temp") ? (
            <Labelled label="Warmth">
              <Track
                label="Warmth"
                reading={mireds === null ? "–" : kelvinLabel(mireds)}
                value={mireds === null ? null : warmthFraction(mireds)}
                gradient={WARMTH_GRADIENT}
                disabled={disabled}
                onCommit={(fraction) => send(temperatureCommand(warmthMireds(fraction)))}
              />
            </Labelled>
          ) : null}
          {modes.includes("hue_sat") ? (
            <Labelled label="Color">
              <Track
                label="Color"
                reading={colorName(device) ?? "–"}
                value={shownHue === null ? null : shownHue.hue / 254}
                gradient={HUE_GRADIENT}
                disabled={disabled}
                onCommit={(fraction) => send(hueCommand(Math.round(fraction * 254), shownHue === null ? 254 : shownHue.saturation))}
              />
            </Labelled>
          ) : null}
        </div>
      ) : null}
      {presets.length > 0 ? (
        <div className="flex justify-between gap-2 pt-6">
          {presets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              aria-pressed={active === preset.name}
              disabled={disabled}
              onClick={() => void send(preset.command)}
              className="flex min-w-0 flex-col items-center gap-2 text-[12px] text-ink-muted disabled:cursor-default"
            >
              <span className={`ghar-preset ${active === preset.name ? "ghar-preset--on" : ""}`} style={{ background: preset.swatch }} />
              <span className="truncate">{preset.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <dl className="m-0 mt-6 flex flex-col gap-2 border-t border-rule pt-5 text-[13px]">
        {device.product_name ? <Fact label="Device">{device.product_name}</Fact> : null}
        <Fact label="Connection">
          {device.online ? (
            <span className="text-sage-deep">{device.bridge_name ? `Online · via ${device.bridge_name}` : "Online"}</span>
          ) : seen ? (
            `Offline · seen ${formatRelative(seen)}`
          ) : (
            "Offline"
          )}
        </Fact>
        {changed ? <Fact label="Last change">{formatRelative(changed)}</Fact> : null}
      </dl>

      <div className="flex flex-col pt-3">
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

type LabelledProps = {
  label: string;
  children: ReactNode;
};

/** A tall slider with its name beneath it. */
function Labelled({ label, children }: LabelledProps) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      {children}
      <span className="text-[13px] text-ink-muted">{label}</span>
    </div>
  );
}

type FactProps = {
  label: string;
  children: ReactNode;
};

/** One line of what the device is: a quiet label column, then the value. */
function Fact({ label, children }: FactProps) {
  return (
    <div className="flex gap-3">
      <dt className="w-[92px] shrink-0 text-ink-ghost">{label}</dt>
      <dd className="m-0 min-w-0 truncate text-ink">{children}</dd>
    </div>
  );
}

/** A row that reads "Room · Ankur's room ›" and opens its choices beneath it. */
function Picker({ label, value, open, onToggle, children }: PickerProps) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-[30px] w-full items-center gap-3 text-[13px] text-ink hover:text-sage-deep"
      >
        <span className="w-[92px] shrink-0 text-left text-ink-ghost">{label}</span>
        <span className="flex min-w-0 items-center gap-1">
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

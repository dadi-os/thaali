import type { ReactNode } from "react";
import { Button, ButtonGroup, IconButton } from "../../shared/components/Button";
import { Card } from "../../shared/components/Card";
import { Reveal } from "../../shared/components/Disclosure";
import { Icon } from "../../shared/components/Icon";
import { Truncate } from "../../shared/components/Truncate";
import { formatClock, formatRelative } from "../../shared/lib/ux/time";
import type { GharCommand, GharDevice, GharRoom } from "../../types/ghar";
import { Slider, Switch, useDraft } from "./controls";
import {
  activePreset,
  colorModes,
  coverCommand,
  has,
  hueCommand,
  isSwitchable,
  kelvinLabel,
  levelCommand,
  liftCommand,
  lightColor,
  num,
  presetCommand,
  presetsFor,
  roomTitle,
  setpointCommand,
  SETPOINT_STEP,
  switchCommand,
  temperatureCommand,
  UNASSIGNED_ROOM,
  warmthMireds,
  warmthPercent,
} from "./model";

/** Which of the two pickers is open. */
export type InspectorPick = "room" | "groups" | null;

export type InspectorProps = {
  device: GharDevice;
  /** Every room, for the room picker. */
  rooms: GharRoom[];
  /** Every group in the house, by name. */
  groups: string[];
  /** The card's width in px. */
  width: number;
  /** The picker that is open. */
  pick: InspectorPick;
  onPick: (next: InspectorPick) => void;
  /** The name is an input. */
  renaming: boolean;
  onRenaming: (next: boolean) => void;
  /** Ghar is unreachable: the controls show the last reading and do nothing. A device that is offline does the same. */
  disabled: boolean;
  onClose: () => void;
  /** Send the device a command. */
  onSend: (command: GharCommand) => void;
  onRename: (name: string) => void;
  onMove: (room: GharRoom) => void;
  /** Set the groups the device carries. */
  onTags: (names: string[]) => void;
  onIdentify: () => void;
};

type ControlProps = {
  name: string;
  /** The value, in words. */
  reading: string;
  children: ReactNode;
};

/** A control with its caps name and its value over it. */
function Control({ name, reading, children }: ControlProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="ui-label">{name}</span>
        <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{reading}</span>
      </div>
      {children}
    </div>
  );
}

type ChoiceProps = {
  text: string;
  kind: "radio" | "checkbox";
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
};

/** One row of a picker: a radio or a checkbox mark and a name. */
function Choice({ text, kind, checked, disabled, onClick }: ChoiceProps) {
  return (
    <button
      type="button"
      role={kind}
      aria-checked={checked}
      className="ui-trans ui-hover-fill"
      disabled={disabled}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, height: 32, padding: "0 10px", borderRadius: 9, fontSize: 13.5 }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: kind === "radio" ? "50%" : 5,
          border: `1.5px solid ${checked ? "var(--sage-deep)" : "var(--sage-line)"}`,
          background: checked ? "var(--sage-deep)" : "transparent",
          color: "var(--bone)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        {checked ? <Icon name="check" size={11} /> : null}
      </span>
      <Truncate text={text} style={{ flex: 1, minWidth: 0 }} />
    </button>
  );
}

type PickerProps = {
  name: string;
  /** The choice now, in words. */
  value: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

/** A row that reads the choice now and opens the choices under it. */
function Picker({ name, value, open, onToggle, children }: PickerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "none" }}>
      <span className="ui-label">{name}</span>
      <div className={open ? "open" : undefined} style={{ display: "flex", flexDirection: "column" }}>
        <button
          type="button"
          className="ui-trans ui-hover-fill"
          aria-expanded={open}
          aria-label={`${name}, ${value}`}
          onClick={onToggle}
          style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", borderRadius: 10, border: "1px solid var(--glass-border)", fontSize: 14, fontWeight: 500 }}
        >
          <Truncate text={value} style={{ flex: 1, minWidth: 0 }} />
          <span style={{ display: "flex", color: "var(--ink-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 320ms cubic-bezier(.22,.61,.36,1)" }}>
            <Icon name="chevDown" size={14} />
          </span>
        </button>
        <Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 0 2px" }}>{children}</div>
        </Reveal>
      </div>
    </div>
  );
}

/**
 * The inspector for one device: its name (click to rename), where it is and whether it answers, a power card, the controls its
 * capabilities offer (brightness, colour temperature, hue and saturation, presets, a cover's position and buttons, a thermostat's
 * setpoint), its room and group pickers, what it can do, and Identify. Every control sends one command on release.
 */
export function Inspector({ device, rooms, groups, width, pick, onPick, renaming, onRenaming, disabled, onClose, onSend, onRename, onMove, onTags, onIdentify }: InspectorProps) {
  const { state } = device;
  const dis = disabled || !device.online;
  const on = state.on?.value === true;
  const tagged = device.tags.map((tag) => tag.name);
  const modes = colorModes(device);
  const presets = presetsFor(device);
  const active = activePreset(device);
  const [level, setLevel] = useDraft(num(device, "brightness") ?? 0);
  const [warmth, setWarmth] = useDraft(warmthPercent(num(device, "color_temp") ?? 0));
  const [hue, setHue] = useDraft(((num(device, "hue") ?? 0) / 254) * 100);
  const [saturation, setSaturation] = useDraft(((num(device, "saturation") ?? 0) / 254) * 100);
  const [lift, setLift] = useDraft(num(device, "lift_percent_open") ?? 0);
  const changedAt = state.on?.changed_at;
  const kelvin = kelvinLabel(warmthMireds(warmth / 100));
  const hueDegrees = Math.round((hue / 100) * 360);
  const saturationPercent = Math.round(saturation);
  const heat = num(device, "heat_setpoint");
  const rename = (name: string) => {
    onRenaming(false);
    if (name.trim().length > 0 && name.trim() !== device.name) {
      onRename(name.trim());
    }
  };
  return (
    <Card style={{ width, flex: "none", background: "var(--glass-sheet)", minHeight: 0, animation: "slide-in 550ms var(--ease) both" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "18px 18px 12px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 4 }}>
          {renaming ? (
            <div style={{ display: "flex", alignItems: "center", height: 32, padding: "0 10px", margin: "0 -10px", borderRadius: 9, border: "1px solid var(--sage-line)", background: "var(--bone)" }}>
              <input
                className="cinp"
                aria-label="Device name"
                defaultValue={device.name}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink)" }}
                onBlur={(event) => rename(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    onRenaming(false);
                  }
                }}
              />
            </div>
          ) : (
            <button type="button" title="Rename" disabled={disabled} onClick={() => onRenaming(true)} style={{ display: "block", minWidth: 0, textAlign: "left" }}>
              <Truncate text={device.name} style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em" }} />
            </button>
          )}
          <Truncate text={[roomTitle(device.room.name), device.product_name].filter(Boolean).join(" · ")} style={{ fontSize: 13, color: "var(--ink-muted)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: device.online ? "var(--sage-text)" : "var(--error)", marginTop: 2 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: device.online ? "var(--sage)" : "var(--error)", flex: "none" }} />
            {device.online ? (device.bridge_name ? `Online · via ${device.bridge_name}` : "Online") : "Offline"}
            {device.last_seen_at ? <span style={{ color: "var(--ink-muted)" }}>{`· seen ${formatRelative(device.last_seen_at)}`}</span> : null}
          </div>
        </div>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
        {isSwitchable(device) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--sage-fill)", flex: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 2 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>Power</span>
              <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{`${on ? "On" : "Off"} since ${changedAt ? formatClock(changedAt) : "—"}`}</span>
            </div>
            <Switch on={on} label={`${device.name} power`} disabled={dis} onChange={(next) => onSend(switchCommand(next))} />
          </div>
        ) : null}
        {state.brightness && has(device, "level") ? (
          <Control name="Brightness" reading={`${Math.round(level)}%`}>
            <Slider value={level} color={lightColor(device)} thickness={8} name="Brightness" text={`${Math.round(level)}%`} disabled={dis} onDrag={setLevel} onCommit={(f) => onSend(levelCommand(Math.max(1, Math.round(f * 100))))} />
          </Control>
        ) : null}
        {state.color_temp && modes.includes("color_temp") ? (
          <Control name="Colour temperature" reading={kelvin}>
            <Slider value={warmth} color="#f0a868" thickness={8} name="Colour temperature" text={kelvin} disabled={dis} onDrag={setWarmth} onCommit={(f) => onSend(temperatureCommand(warmthMireds(f)))} />
          </Control>
        ) : null}
        {state.hue && modes.includes("hue_sat") ? (
          <>
            <Control name="Hue" reading={`${hueDegrees}°`}>
              <Slider value={hue} color={lightColor(device)} thickness={8} name="Hue" text={`${hueDegrees}°`} disabled={dis} onDrag={setHue} onCommit={(f) => onSend(hueCommand(Math.round(f * 254), num(device, "saturation") ?? 254))} />
            </Control>
            <Control name="Saturation" reading={`${saturationPercent}%`}>
              <Slider value={saturation} color={lightColor(device)} thickness={8} name="Saturation" text={`${saturationPercent}%`} disabled={dis} onDrag={setSaturation} onCommit={(f) => onSend(hueCommand(num(device, "hue") ?? 0, Math.round(f * 254)))} />
            </Control>
          </>
        ) : null}
        {presets.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "none" }}>
            <span className="ui-label">Presets</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0 }}>
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  aria-pressed={active === preset.name}
                  disabled={dis}
                  className="ui-trans ui-hover-fill"
                  onClick={() => onSend(presetCommand(preset))}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 64, padding: "6px 0", borderRadius: 10, fontSize: 11.5, color: "var(--ink-muted)", minWidth: 0, ...(dis ? { opacity: 0.45 } : {}) }}
                >
                  <span
                    style={{ width: 28, height: 28, borderRadius: "50%", background: preset.swatch, border: `2px solid ${active === preset.name ? "var(--sage-deep)" : "var(--glass-border)"}`, boxShadow: active === preset.name ? "0 0 0 3px rgba(92,107,82,.15)" : "none" }}
                  />
                  <Truncate text={preset.name} style={{ maxWidth: "100%" }} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {device.kind === "cover" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "none" }}>
            <Control name="Position" reading={`${Math.round(lift)}% open`}>
              <Slider value={lift} color="var(--sage)" thickness={8} name="Position" text={`${Math.round(lift)}% open`} disabled={dis} onDrag={setLift} onCommit={(f) => onSend(liftCommand(Math.round(f * 100)))} />
            </Control>
            <ButtonGroup>
              {(["open", "stop", "close"] as const).map((name) => (
                <Button key={name} tone="outline" size="lg" equal disabled={dis} onClick={() => onSend(coverCommand(name))}>
                  {name === "open" ? "Open" : name === "stop" ? "Stop" : "Close"}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        ) : null}
        {device.kind === "thermostat" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="ui-label">Temperature</span>
              <span style={{ marginLeft: "auto", fontSize: 22, fontWeight: 500 }}>{`${num(device, "local_temperature")}°`}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="ui-label">Heat to</span>
              <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{`${heat}°`}</span>
              <ButtonGroup>
                <Button tone="outline" size="sm" aria-label="Lower heat setpoint" disabled={dis || heat === null} style={{ minWidth: 32, padding: 0 }} onClick={() => heat !== null && onSend(setpointCommand(heat - SETPOINT_STEP))}>
                  −
                </Button>
                <Button tone="outline" size="sm" aria-label="Raise heat setpoint" disabled={dis || heat === null} style={{ minWidth: 32, padding: 0 }} onClick={() => heat !== null && onSend(setpointCommand(heat + SETPOINT_STEP))}>
                  +
                </Button>
              </ButtonGroup>
            </div>
          </div>
        ) : null}
        {device.kind === "occupancy" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--sage-fill)", flex: "none" }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600 }}>{state.occupied?.value === true ? "Occupied" : "Not occupied"}</span>
            <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{`since ${state.occupied ? formatClock(state.occupied.changed_at) : "—"}`}</span>
          </div>
        ) : null}
        <Picker name="Room" value={roomTitle(device.room.name)} open={pick === "room"} onToggle={() => onPick(pick === "room" ? null : "room")}>
          {[...rooms]
            .sort((a, b) => Number(a.name === UNASSIGNED_ROOM) - Number(b.name === UNASSIGNED_ROOM))
            .map((room) => (
              <Choice key={room.id} text={roomTitle(room.name)} kind="radio" checked={room.id === device.room.id} disabled={disabled} onClick={() => onMove(room)} />
            ))}
        </Picker>
        <Picker name="Groups" value={tagged.length > 0 ? tagged.join(", ") : "None"} open={pick === "groups"} onToggle={() => onPick(pick === "groups" ? null : "groups")}>
          {groups.map((name) => (
            <Choice key={name} text={name} kind="checkbox" checked={tagged.includes(name)} disabled={disabled} onClick={() => onTags(tagged.includes(name) ? tagged.filter((tag) => tag !== name) : [...tagged, name])} />
          ))}
          <div style={{ display: "flex", alignItems: "center", height: 32, padding: "0 10px", marginTop: 2, borderRadius: 9, border: "1px dashed var(--sage-line)" }}>
            <input
              className="cinp"
              placeholder="New group"
              aria-label="New group"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              style={{ fontSize: 13.5, color: "var(--ink)" }}
              onKeyDown={(event) => {
                const name = event.currentTarget.value.trim();
                if (event.key === "Enter" && name.length > 0) {
                  event.currentTarget.value = "";
                  if (!tagged.includes(name)) {
                    onTags([...tagged, name]);
                  }
                }
              }}
            />
          </div>
        </Picker>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "none" }}>
          <span className="ui-label">Capabilities</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {device.capabilities.map((cap) => (
              <span key={cap.capability} className="ui-mono" style={{ padding: "3px 9px", borderRadius: 8, background: "var(--sage-fill)", fontSize: 12, color: "var(--sage-text)" }}>
                {cap.capability}
              </span>
            ))}
          </div>
        </div>
        <ButtonGroup>
          <Button tone="outline" size="md" icon="bolt" disabled={dis} onClick={onIdentify}>
            Identify
          </Button>
        </ButtonGroup>
      </div>
    </Card>
  );
}

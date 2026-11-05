import { useContextActions } from "../../shared/interaction/contextMenu";
import type { ActionList } from "../../shared/interaction/actions";
import { Icon, type IconName } from "../../shared/ui/Icon";
import { Truncate } from "../../shared/ui/Truncate";
import type { GharDevice } from "../../types/ghar";
import { Switch } from "../../shared/ui/Switch";
import { Slider, useDraft } from "./controls";
import { has, isOn, isSwitchable, lightColor, num, stateLine } from "./model";

/** The icon each kind of device wears; any other kind is a power mark. */
const KIND_ICON: Partial<Record<GharDevice["kind"], IconName>> = { light: "bulb", cover: "expand", thermostat: "sun", occupancy: "eye" };

export type DeviceTileProps = {
  device: GharDevice;
  /** It is the one in the inspector. */
  selected: boolean;
  /** A command for it is in flight. */
  busy: boolean;
  /** Ghar is unreachable: the tile shows its last reading and does not switch or dim. */
  disabled: boolean;
  onToggle: (on: boolean) => void;
  /** The brightness the user settled on, 1 to 100. */
  onLevel: (level: number) => void;
  /** Choose the device for the inspector. */
  onSelect: () => void;
  /** What a right-click on the tile offers ({@link deviceActions}); absent where the tile has no menu. */
  actions?: () => ActionList;
};

/**
 * One device as a tile: its kind's icon, a switch where it has one, its name and what it is doing, and a brightness slider while
 * a dimmable light is on. The name and state are the button that selects it into the inspector; a right click opens its actions.
 */
export function DeviceTile({ device, selected, busy, disabled, onToggle, onLevel, onSelect, actions }: DeviceTileProps) {
  const on = isOn(device);
  const [level, setLevel] = useDraft(num(device, "brightness") ?? 100);
  const lit = device.kind === "light" && on;
  const context = useContextActions(() => (actions === undefined ? null : actions()));
  return (
    <div
      {...context}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: 16,
        minWidth: 0,
        background: selected ? "rgba(250,250,247,.95)" : "var(--glass-veil)",
        border: `1px solid ${selected ? "var(--sage-deep)" : "var(--glass-border)"}`,
        boxShadow: selected ? "0 0 0 3px rgba(92,107,82,.12)" : "var(--shadow)",
        opacity: device.online ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: lit ? "rgba(240,168,104,.2)" : "var(--sage-fill)",
            color: lit ? "#9a5f24" : "var(--ink-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <Icon name={KIND_ICON[device.kind] ?? "power"} size={18} />
        </span>
        <div style={{ flex: 1 }} />
        {busy ? (
          <span
            style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--sage-line)", borderTopColor: "var(--sage-deep)", animation: "ui-spin 800ms linear infinite", flex: "none" }}
          />
        ) : null}
        {isSwitchable(device) ? (
          <Switch on={on} label={`${device.name} power`} disabled={disabled || !device.online} busy={busy} onChange={(next) => !busy && onToggle(next)} />
        ) : null}
      </div>
      <button type="button" aria-current={selected ? "true" : "false"} onClick={onSelect} style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left", width: "100%", minWidth: 0 }}>
        <Truncate text={device.name} style={{ fontSize: 15, fontWeight: 600 }} />
        <Truncate text={stateLine(device)} style={{ fontSize: 13, color: device.online ? "var(--ink-muted)" : "var(--error)" }} />
      </button>
      {isSwitchable(device) && on && has(device, "level") ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Slider
              value={level}
              color={lightColor(device)}
              thickness={6}
              name={`${device.name} brightness`}
              text={`${level}%`}
              disabled={disabled}
              onDrag={setLevel}
              onCommit={(fraction) => onLevel(Math.max(1, Math.round(fraction * 100)))}
            />
          </div>
          <span style={{ fontSize: 12, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums", width: 38, flex: "none", textAlign: "right" }}>{`${Math.round(level)}%`}</span>
        </div>
      ) : null}
    </div>
  );
}

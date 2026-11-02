import { useState } from "react";
import { Button, ButtonGroup } from "../../shared/components/Button";
import { Reveal } from "../../shared/components/Disclosure";
import { Icon } from "../../shared/components/Icon";
import type { GharDevice } from "../../types/ghar";
import { Slider, Switch, useDraft } from "./controls";
import { DeviceTile } from "./DeviceTile";
import { countLights, isOn, lightColor, sectionLevel, sectionMeta, type Section } from "./model";

/** What a room's options are showing: the menu, the list of lights to move in, or the question before it goes. */
export type SectionUi = { open: boolean; mode: "menu" | "move" | "delete"; rename: boolean };

/** Everything shut. */
export const SECTION_SHUT: SectionUi = { open: false, mode: "menu", rename: false };

/** Tiles a section shows before the rest hide behind "+N more". */
const CAP = 6;

export type RoomSectionProps = {
  section: Section;
  /** Every device outside this room, for moving lights in. */
  elsewhere: GharDevice[];
  ui: SectionUi;
  onUi: (next: SectionUi) => void;
  selectedId: string | null;
  /** The devices a command is in flight for. */
  busy: ReadonlySet<string>;
  /** Ghar is unreachable: the controls show their last reading and do nothing. */
  disabled: boolean;
  /** The narrowest a tile gets before the grid drops a column, in px. */
  minTile: number;
  onToggle: (device: GharDevice, on: boolean) => void;
  onLevel: (device: GharDevice, level: number) => void;
  onSelect: (device: GharDevice) => void;
  onSwitch: () => void;
  /** Every light in the section to one brightness, 1 to 100. */
  onSectionLevel: (level: number) => void;
  onRename: (name: string) => void;
  onMoveHere: (device: GharDevice) => void;
  onAddHere: () => void;
  onDelete: () => void;
};

const dashed = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  minHeight: 100,
  borderRadius: 16,
  border: "1px dashed var(--sage-line)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--sage-text)",
} as const;

/**
 * One room or group: its header (the name, how many lights are on, a switch), the options a room opens from its name
 * (brightness for every light in it, then rename, move lights here, add a device here and delete), and its tiles.
 */
export function RoomSection({ section, elsewhere, ui, onUi, selectedId, busy, disabled, minTile, onToggle, onLevel, onSelect, onSwitch, onSectionLevel, onRename, onMoveHere, onAddHere, onDelete }: RoomSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { title, kind, devices } = section;
  const { lights, on } = countLights(devices);
  const [level, setLevel] = useDraft(sectionLevel(devices));
  const shown = expanded ? devices : devices.slice(0, CAP);
  const more = devices.length - shown.length;
  const set = (patch: Partial<SectionUi>) => onUi({ ...ui, ...patch });
  const head =
    kind === "room" ? (
      ui.rename ? (
        <div style={{ display: "flex", alignItems: "center", height: 32, width: 220, padding: "0 12px", borderRadius: 9, border: "1px solid var(--sage-line)", background: "var(--bone)" }}>
          <input
            className="cinp"
            aria-label="Room name"
            defaultValue={title}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)" }}
            onBlur={(event) => {
              set({ rename: false });
              onRename(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                set({ rename: false });
              }
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          className="ui-trans ui-hover-fill"
          aria-expanded={ui.open}
          aria-label={`${title} options`}
          disabled={disabled}
          onClick={() => onUi(ui.open ? SECTION_SHUT : { ...ui, open: true, mode: "menu" })}
          style={{ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 8px", borderRadius: 9, fontSize: 17, fontWeight: 600, ...(disabled ? { opacity: 0.45 } : {}) }}
        >
          {title}
          <span style={{ display: "flex", color: "var(--ink-muted)", transform: ui.open ? "rotate(180deg)" : undefined, transition: "transform 320ms cubic-bezier(.22,.61,.36,1)" }}>
            <Icon name="chevDown" size={14} />
          </span>
        </button>
      )
    ) : (
      <h3 style={{ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 8px", margin: 0, fontSize: 17, fontWeight: 600 }}>
        {kind === "group" ? (
          <span style={{ display: "flex", color: "var(--sage-deep)" }}>
            <Icon name="grid" size={15} />
          </span>
        ) : null}
        {title}
      </h3>
    );
  const actions =
    ui.mode === "delete" ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{`Delete ${title}?${devices.length > 0 ? ` Its ${devices.length === 1 ? "device goes" : `${devices.length} devices go`} to Unassigned.` : ""}`}</span>
        <Button tone="danger" size="sm" disabled={disabled} onClick={onDelete}>
          Delete room
        </Button>
        <Button tone="quiet" size="sm" onClick={() => set({ mode: "menu" })}>
          Cancel
        </Button>
      </div>
    ) : ui.mode === "move" ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{elsewhere.length > 0 ? "Click a device to move it here:" : "Every device is already here."}</span>
        {elsewhere.map((device) => (
          <button
            key={device.id}
            type="button"
            className="ui-trans ui-hover-fill"
            disabled={disabled}
            onClick={() => onMoveHere(device)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 28, padding: "0 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", border: `1px solid ${isOn(device) ? "var(--sage)" : "var(--sage-line)"}`, color: "var(--ink)" }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOn(device) ? lightColor(device) : "var(--ink-ghost)", flex: "none" }} />
            {device.name}
          </button>
        ))}
        <Button tone="quiet" size="sm" onClick={() => set({ mode: "menu" })}>
          Done
        </Button>
      </div>
    ) : (
      <ButtonGroup wrap>
        <Button tone="outline" size="sm" disabled={disabled} onClick={() => set({ rename: true })}>
          Rename room
        </Button>
        <Button tone="outline" size="sm" disabled={disabled} onClick={() => set({ mode: "move" })}>
          Move lights here
        </Button>
        <Button tone="outline" size="sm" disabled={disabled} onClick={onAddHere}>
          Add device here
        </Button>
        <Button tone="danger" size="sm" disabled={disabled} onClick={() => set({ mode: "delete" })}>
          Delete room
        </Button>
      </ButtonGroup>
    );
  return (
    <section aria-label={title} className={ui.open ? "open" : undefined} style={{ display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 36 }}>
          {head}
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{sectionMeta(devices)}</span>
          <div style={{ flex: 1 }} />
          {lights > 0 ? <Switch on={on > 0} label={`${title} lights`} disabled={disabled} onChange={onSwitch} /> : null}
        </div>
        {kind === "room" ? (
          <Reveal>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "6px 4px 4px" }}>
              {lights > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="ui-label">Brightness</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Slider
                      value={level}
                      color="var(--sage)"
                      thickness={6}
                      name={`${title} brightness`}
                      text={`${Math.round(level)}%`}
                      disabled={disabled}
                      onDrag={setLevel}
                      onCommit={(fraction) => onSectionLevel(Math.max(1, Math.round(fraction * 100)))}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums", width: 38, flex: "none", textAlign: "right" }}>{`${Math.round(level)}%`}</span>
                </div>
              ) : null}
              {actions}
            </div>
          </Reveal>
        ) : null}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${minTile}px,1fr))`, gap: 12 }}>
        {shown.map((device) => (
          <DeviceTile
            key={device.id}
            device={device}
            selected={selectedId === device.id}
            busy={busy.has(device.id)}
            disabled={disabled}
            onToggle={(next) => onToggle(device, next)}
            onLevel={(next) => onLevel(device, next)}
            onSelect={() => onSelect(device)}
          />
        ))}
        {more > 0 ? (
          <button type="button" className="ui-trans ui-hover-fill" onClick={() => setExpanded(true)} style={dashed}>
            {`+${more} more`}
          </button>
        ) : null}
        {kind === "room" && devices.length === 0 ? (
          <button type="button" className="ui-trans ui-hover-fill" disabled={disabled} onClick={onAddHere} style={{ ...dashed, ...(disabled ? { opacity: 0.45 } : {}) }}>
            Add a device here
          </button>
        ) : null}
      </div>
    </section>
  );
}

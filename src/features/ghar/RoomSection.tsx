import { useState } from "react";
import type { ActionList } from "../../shared/interaction/actions";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { AnchoredMenu } from "../../shared/overlay/AnchoredMenu";
import { Button, Pill } from "../../shared/ui/Button";
import { Reveal } from "../../shared/ui/Disclosure";
import { Icon } from "../../shared/ui/Icon";
import { Switch } from "../../shared/ui/Switch";
import type { GharDevice } from "../../types/ghar";
import { Slider, useDraft } from "./controls";
import { DeviceTile } from "./DeviceTile";
import { countLights, isOn, lightColor, sectionLevel, sectionMeta, type Section } from "./model";
import { roomActions } from "./roomActions";

/** What a room's options panel is showing: whether it is open, the room's brightness alone or with the list of lights to move in, and whether the name is a field. */
export type SectionUi = { open: boolean; mode: "menu" | "move"; rename: boolean };

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
  /** What a right-click on a device's tile offers ({@link deviceActions}). */
  deviceActions: (device: GharDevice) => ActionList;
  onSwitch: () => void;
  /** Every light in the section to one brightness, 1 to 100. */
  onSectionLevel: (level: number) => void;
  onRename: (name: string) => void;
  onMoveHere: (device: GharDevice) => void;
  onAddHere: () => void;
  /** Ask whether to delete the room; the page confirms before it goes. */
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
 * One room or group: its header (the name, how many lights are on, a switch), the actions a room offers from its name or a
 * right-click ({@link roomActions}: brightness for every light in it, rename, move lights here, add a device here and delete),
 * the panel brightness and moving lights open, and its tiles.
 */
export function RoomSection({ section, elsewhere, ui, onUi, selectedId, busy, disabled, minTile, onToggle, onLevel, onSelect, deviceActions, onSwitch, onSectionLevel, onRename, onMoveHere, onAddHere, onDelete }: RoomSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { title, kind, devices } = section;
  const { lights, on } = countLights(devices);
  const [level, setLevel] = useDraft(sectionLevel(devices));
  const shown = expanded ? devices : devices.slice(0, CAP);
  const more = devices.length - shown.length;
  const set = (patch: Partial<SectionUi>) => onUi({ ...ui, ...patch });
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const actions = roomActions({
    disabled,
    hasLights: lights > 0,
    opened: ui.open,
    onToggleOptions: () => onUi(ui.open ? SECTION_SHUT : { ...ui, open: true, mode: "menu" }),
    onRename: () => set({ rename: true }),
    onMoveHere: () => set({ open: true, mode: "move" }),
    onAddHere,
    onDelete,
  });
  const context = useContextActions(() => (kind === "room" ? actions : null));
  const panel = ui.open && (lights > 0 || ui.mode === "move");
  const head =
    kind === "room" ? (
      ui.rename ? (
        <div style={{ display: "flex", alignItems: "center", height: 32, width: 220, padding: "0 12px", borderRadius: 10, border: "1px solid var(--sage-line)", background: "var(--bone)" }}>
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
          aria-haspopup="menu"
          aria-expanded={menuAnchor !== null}
          aria-label={`${title} options`}
          disabled={disabled}
          onClick={(event) => setMenuAnchor(event.currentTarget.getBoundingClientRect())}
          style={{ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 8px", borderRadius: 10, fontSize: 17, fontWeight: 600, ...(disabled ? { opacity: 0.45 } : {}) }}
        >
          {title}
          <span style={{ display: "flex", color: "var(--ink-muted)", transform: menuAnchor !== null ? "rotate(180deg)" : undefined, transition: "transform var(--slow) var(--ease)" }}>
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
  const moving =
    ui.mode === "move" ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{elsewhere.length > 0 ? "Click a device to move it here:" : "Every device is already here."}</span>
        {elsewhere.map((device) => (
          <Pill key={device.id} disabled={disabled} onClick={() => onMoveHere(device)}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOn(device) ? lightColor(device) : "var(--ink-ghost)", flex: "none" }} />
            {device.name}
          </Pill>
        ))}
        <Button tone="quiet" size="sm" onClick={() => onUi(SECTION_SHUT)}>
          Done
        </Button>
      </div>
    ) : null;
  return (
    <section aria-label={title} className={panel ? "open" : undefined} style={{ display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <div {...context} style={{ display: "flex", alignItems: "center", gap: 10, height: 36 }}>
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
              {moving}
            </div>
          </Reveal>
        ) : null}
      </div>
      <AnchoredMenu actions={actions} anchor={menuAnchor} onClose={() => setMenuAnchor(null)} />
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
            actions={() => deviceActions(device)}
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

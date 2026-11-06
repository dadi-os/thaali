import { useState } from "react";
import type { ActionList } from "../../shared/interaction/actions";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { AnchoredMenu } from "../../shared/overlay/AnchoredMenu";
import { Button, Pill } from "../../shared/ui/Button";
import { Icon } from "../../shared/ui/Icon";
import { Switch } from "../../shared/ui/Switch";
import type { GharDevice, GharTag } from "../../types/ghar";
import { Slider, useDraft } from "./controls";
import { DeviceTile } from "./DeviceTile";
import { countLights, isOn, lightColor, sectionLevel, sectionMeta } from "./model";
import { tagActions } from "./tagActions";

/** What a tag's header is showing: the list of devices to put under it, and whether the name is a field. */
export type SectionUi = { mode: "none" | "add"; rename: boolean };

/** Everything shut. */
export const SECTION_SHUT: SectionUi = { mode: "none", rename: false };

/** Tiles a section shows before the rest hide behind "+N more". */
const CAP = 6;

export type TagSectionProps = {
  /** The tag's name, or what the view is called ("All devices"). */
  title: string;
  /** The tag these devices are under; null for a view that is not one tag, which has a switch but no tag controls. */
  tag: GharTag | null;
  devices: GharDevice[];
  /** Every device not under this tag, to put under it. */
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
  /** Switch every light in the section: all off when any is on, else all on. */
  onSwitch: () => void;
  /** Every light in the section to one brightness, 1 to 100. */
  onSectionLevel: (level: number) => void;
  onRename: (name: string) => void;
  /** Put a device under the tag. */
  onAddDevice: (device: GharDevice) => void;
  /** Ask whether to delete the tag; the page confirms before it goes. */
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
 * One view of the house: a tag or all devices. Its header is the name, how many lights are on and a switch; for a
 * tag the name opens its actions (rename, add devices, delete, the same list as a right-click on the header) and a brightness bar
 * sets every light under it. Below are the device tiles.
 */
export function TagSection({ title, tag, devices, elsewhere, ui, onUi, selectedId, busy, disabled, minTile, onToggle, onLevel, onSelect, deviceActions, onSwitch, onSectionLevel, onRename, onAddDevice, onDelete }: TagSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const { lights, on } = countLights(devices);
  const [level, setLevel] = useDraft(sectionLevel(devices));
  const shown = expanded ? devices : devices.slice(0, CAP);
  const more = devices.length - shown.length;
  const set = (patch: Partial<SectionUi>) => onUi({ ...ui, ...patch });
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const actions = tagActions({ disabled, onRename: () => set({ rename: true }), onAddDevices: () => set({ mode: "add" }), onDelete });
  const context = useContextActions(() => (tag === null ? null : actions));
  const head =
    tag === null ? (
      <h3 style={{ display: "flex", alignItems: "center", height: 32, padding: "0 8px", margin: 0, fontSize: 17, fontWeight: 600 }}>{title}</h3>
    ) : ui.rename ? (
      <div style={{ display: "flex", alignItems: "center", height: 32, width: 220, padding: "0 12px", borderRadius: 10, border: "1px solid var(--sage-line)", background: "var(--bone)" }}>
        <input
          className="cinp"
          aria-label="Tag name"
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
        <span style={{ display: "flex", color: "var(--sage-deep)" }}>
          <Icon name="grid" size={15} />
        </span>
        {title}
        <span style={{ display: "flex", color: "var(--ink-muted)", transform: menuAnchor !== null ? "rotate(180deg)" : undefined, transition: "transform var(--slow) var(--ease)" }}>
          <Icon name="chevDown" size={14} />
        </span>
      </button>
    );
  return (
    <section aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
      <div {...context} style={{ display: "flex", alignItems: "center", gap: 10, height: 36 }}>
        {head}
        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{sectionMeta(devices)}</span>
        <div style={{ flex: 1 }} />
        {lights > 0 ? <Switch on={on > 0} label={`${title} lights`} disabled={disabled} onChange={onSwitch} /> : null}
      </div>
      {tag !== null && lights > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 4px" }}>
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
      {tag !== null && ui.mode === "add" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "0 4px" }}>
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{elsewhere.length > 0 ? "Click a device to add it here:" : "Every device is already here."}</span>
          {elsewhere.map((device) => (
            <Pill key={device.id} disabled={disabled} onClick={() => onAddDevice(device)}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: isOn(device) ? lightColor(device) : "var(--ink-ghost)", flex: "none" }} />
              {device.name}
            </Pill>
          ))}
          <Button tone="quiet" size="sm" onClick={() => onUi(SECTION_SHUT)}>
            Done
          </Button>
        </div>
      ) : null}
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
      </div>
    </section>
  );
}

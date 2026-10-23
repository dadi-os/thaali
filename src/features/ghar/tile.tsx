import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { GharDevice } from "../../types/ghar";
import { IconAdd, IconSliders, KindIcon } from "./icons";
import { tileLook, tileStatus } from "./model";

/** How long a press must hold to select a tile instead of switching it. */
const LONG_PRESS_MS = 350;

/** A tile's colors as the custom properties the stylesheet reads; none when it is off. */
function lookStyle(device: GharDevice): CSSProperties | undefined {
  const look = tileLook(device);
  return look
    ? ({
        "--tile-fill": look.fill,
        "--tile-border": look.border,
        "--tile-disc": look.disc,
        "--tile-disc-ink": look.discInk,
        "--tile-status": look.statusInk,
      } as CSSProperties)
    : undefined;
}

/** A device's icon disc, name and status: the inside of a tile. */
function TileFace({ device }: { device: GharDevice }) {
  return (
    <>
      <span className="ghar-tile__disc">
        <span className="size-[22px]">
          <KindIcon kind={device.kind} />
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="line-clamp-2 text-[16px] leading-tight font-semibold text-ink">{device.name}</span>
        <span className="ghar-tile__status truncate text-[13px]">{tileStatus(device)}</span>
      </span>
    </>
  );
}

/** A tile that only shows a device, as the pairing sheet does once a device lands. */
export function TilePreview({ device }: { device: GharDevice }) {
  return (
    <div className={`ghar-tile ${tileLook(device) ? "ghar-tile--on" : ""}`} style={lookStyle(device)}>
      <TileFace device={device} />
    </div>
  );
}

type TileProps = {
  device: GharDevice;
  /** It is the one in the inspector. */
  selected: boolean;
  /** A command for it is in flight. */
  busy: boolean;
  /** Ghar is unreachable, or the device is: the tile shows its last reading and does not switch. */
  disabled: boolean;
  onToggle: () => void;
  onSelect: () => void;
};

/**
 * One device as the page's only card, lit in its light's own color and brightness when on.
 * A click switches it (or selects a device with nothing to switch); a long press, a right
 * click or its controls button selects it into the inspector.
 */
export function Tile({ device, selected, busy, disabled, onToggle, onSelect }: TileProps) {
  const press = useRef<number | null>(null);
  const held = useRef(false);
  const switchable = typeof device.state.on?.value === "boolean";

  const cancelPress = () => {
    if (press.current !== null) {
      window.clearTimeout(press.current);
      press.current = null;
    }
  };

  useEffect(() => cancelPress, []);

  return (
    <div
      className={`ghar-tile group ${tileLook(device) ? "ghar-tile--on" : ""} ${selected ? "ghar-tile--selected" : ""} ${
        device.online ? "" : "ghar-tile--offline"
      }`}
      style={lookStyle(device)}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-sage"
        aria-label={`${device.name}, ${tileStatus(device)}`}
        aria-pressed={switchable ? tileLook(device) !== null : undefined}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          held.current = false;
          cancelPress();
          press.current = window.setTimeout(() => {
            press.current = null;
            held.current = true;
            onSelect();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(event) => {
          event.preventDefault();
          cancelPress();
          onSelect();
        }}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          if (switchable && !disabled) {
            onToggle();
            return;
          }
          onSelect();
        }}
      />
      <span className="pointer-events-none relative flex h-full flex-col items-start justify-between">
        <TileFace device={device} />
      </span>
      {busy ? (
        <span aria-hidden className="absolute top-4 right-4 size-4 animate-spin rounded-full border-2 border-sage/30 border-t-sage-deep" />
      ) : (
        <button
          type="button"
          aria-label={`${device.name} controls`}
          title="Controls"
          onClick={onSelect}
          className={`absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full text-ink-muted transition-opacity duration-slow ease-dadi hover:text-ink focus-visible:opacity-100 ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <span className="size-4">
            <IconSliders />
          </span>
        </button>
      )}
    </div>
  );
}

type AddTileProps = {
  label: ReactNode;
  onClick: () => void;
};

/** A dashed tile that adds something where it sits. */
export function AddTile({ label, onClick }: AddTileProps) {
  return (
    <button type="button" onClick={onClick} className="ghar-add-tile">
      <span className="size-[22px]">
        <IconAdd />
      </span>
      {label}
    </button>
  );
}

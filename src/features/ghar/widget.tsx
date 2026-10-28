import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { StaleBanner, StateView } from "../../shared/components/states";
import { Switch } from "./controls";
import {
  glow,
  isLight,
  isOn,
  roomSections,
  sectionSwitch,
  summarize,
  switchCommand,
} from "./model";
import { useHouse } from "./useHouse";

/** One row of tile chips (34 px chip plus the 8 px gap below it), and that gap. */
const CHIP_ROW_PX = 42;
const CHIP_GAP_PX = 8;

/**
 * The home Ghar tile, as on the canvas: how many lights are on and where beside a switch for
 * every light, then a chip per light that switches it, in as many whole rows as the tile's
 * height holds (none when it is too short for one).
 */
export function GharWidget() {
  const house = useHouse();
  const chipArea = useRef<HTMLDivElement>(null);
  const [chipRows, setChipRows] = useState(1);
  useLayoutEffect(() => {
    const el = chipArea.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => setChipRows(Math.floor((el.clientHeight + CHIP_GAP_PX) / CHIP_ROW_PX)));
    observer.observe(el);
    return () => observer.disconnect();
  });
  const { devicesQuery, roomsQuery, connected } = house;

  if (!connected && !devicesQuery.data) {
    return <StateView tone="offline" label="Ghar is offline" compact />;
  }
  if (devicesQuery.isError && !devicesQuery.data) {
    return <StateView tone="error" label="Could not reach Ghar" error={devicesQuery.error} compact />;
  }
  if (roomsQuery.isError && !roomsQuery.data) {
    return <StateView tone="error" label="Could not load rooms" error={roomsQuery.error} compact />;
  }
  if (!devicesQuery.data || !roomsQuery.data) {
    return (
      <div role="status" aria-label="Opening the house" className="flex h-full min-h-0 flex-col px-[22px] pt-1.5 pb-4">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="skeleton h-7 w-28 rounded-[8px]" />
            <span className="skeleton h-2.5 w-20" />
          </div>
          <span className="skeleton h-7 w-12 rounded-full" />
        </div>
        <div className="flex gap-2 pt-3">
          <span className="skeleton h-9 w-28 rounded-full" />
          <span className="skeleton h-9 w-36 rounded-full" />
        </div>
      </div>
    );
  }

  const lights = devicesQuery.data.devices.filter(isLight);
  if (lights.length === 0) {
    return <StateView tone="empty" label="No lights yet" compact />;
  }
  const summary = summarize(lights);
  const where = roomSections(lights, roomsQuery.data.rooms)
    .filter((section) => section.devices.length > 0)
    .map((section) => section.title)
    .join(" · ");
  const disabled = !connected;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-[18px] pt-1 pb-3">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[26px] leading-tight font-bold tracking-[-0.02em] text-ink">
            {summary.on === 0 ? "All off" : `${summary.on} of ${summary.lights} on`}
          </span>
          <span className="truncate text-[12px] text-ink-ghost">
            {summary.lights === 1 ? "1 light" : `${summary.lights} lights`}
            {where ? ` · ${where}` : ""}
          </span>
        </div>
        <Switch
          on={summary.on > 0}
          label="Switch every light"
          disabled={disabled}
          onChange={() => void house.run(sectionSwitch(lights))}
        />
      </div>
      <div ref={chipArea} className="min-h-0 flex-1 basis-0">
        <div className="flex flex-wrap content-start gap-2 overflow-hidden" style={{ maxHeight: Math.max(0, chipRows * CHIP_ROW_PX - CHIP_GAP_PX) }}>
          {lights.map((light) => (
            <button
              key={light.id}
              type="button"
              aria-pressed={isOn(light)}
              disabled={disabled || !light.online || house.pending.has(light.id)}
              onClick={(event) => {
                event.stopPropagation();
                void house.run([{ id: light.id, command: switchCommand(!isOn(light)) }]);
              }}
              className={`ghar-light-chip ghar-light-chip--tile ${isOn(light) ? "ghar-light-chip--on" : ""}`}
              style={isOn(light) ? ({ "--chip-color": glow(light) } as CSSProperties) : undefined}
            >
              <span className="ghar-light-chip__dot" />
              {light.name}
            </button>
          ))}
        </div>
      </div>
      {!connected ? (
        <StaleBanner label="Ghar is offline" since={devicesQuery.dataUpdatedAt} compact />
      ) : house.failure ? (
        <p role="alert" className="m-0 truncate text-[12px] text-error" title={house.failure}>
          {house.failure}
        </p>
      ) : null}
    </div>
  );
}

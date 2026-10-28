import type { CSSProperties } from "react";
import { StaleBanner, StateView } from "../../shared/components/states";
import { LevelBar, Switch } from "./controls";
import {
  glow,
  isLight,
  isOn,
  rgbCss,
  roomSections,
  sectionLevel,
  sectionSwitch,
  summarize,
  switchCommand,
  WARM_WHITE,
} from "./model";
import { useHouse } from "./useHouse";

/**
 * The home widget's Ghar, straight on the widget card: how many lights are on and where, a
 * switch for every light, a chip per light that switches it, and a bar that sets them all.
 */
export function GharWidget() {
  const house = useHouse();
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
    <div className="flex h-full min-h-0 flex-col px-[22px] pt-1.5 pb-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[28px] leading-tight font-bold tracking-[-0.5px] text-ink">
            {summary.on === 0 ? "All off" : `${summary.on} of ${summary.lights} on`}
          </span>
          <span className="truncate text-[13px] text-ink-muted">{where}</span>
        </div>
        <Switch
          on={summary.on > 0}
          label="Switch every light"
          disabled={disabled}
          onChange={() => void house.run(sectionSwitch(lights))}
        />
      </div>
      {!connected ? (
        <StaleBanner label="Ghar is offline" since={devicesQuery.dataUpdatedAt} compact className="mt-2" />
      ) : house.failure ? (
        <p role="alert" className="m-0 mt-2 truncate text-[12px] text-error" title={house.failure}>
          {house.failure}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-wrap gap-2 overflow-hidden pt-3">
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
            className={`ghar-light-chip ${isOn(light) ? "ghar-light-chip--on" : ""}`}
            style={isOn(light) ? ({ "--chip-color": glow(light) } as CSSProperties) : undefined}
          >
            <span className="ghar-light-chip__dot" />
            {light.name}
          </button>
        ))}
      </div>
      <LevelBar
        label="Brightness"
        value={summary.brightness}
        color={rgbCss(summary.color ?? WARM_WHITE)}
        disabled={disabled}
        className="mt-auto h-[34px] shrink-0 text-[12px]"
        onCommit={(level) => house.run(sectionLevel(lights, level))}
      />
    </div>
  );
}

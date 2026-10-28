/**
 * Ghar, rooms first: the house's headline and quick actions, chips for every room and group,
 * then each room (or the chosen group) as a header with its switch, its brightness bar and a
 * grid of tiles, beside the one inspector for the selected device.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { ghar } from "../../shared/api";
import type { GharDevice, GharRoom } from "../../types/ghar";
import { StaleBanner, StateView } from "../../shared/components/states";
import { EASE, REVEAL, SLOW_S, SLOWER_S } from "../../shared/lib/ux/motion";
import { PairingSheet } from "./commission";
import { LevelBar, Switch } from "./controls";
import { IconAdd, IconChevron, IconGroup, IconMoon } from "./icons";
import { Inspector } from "./inspector";
import {
  allOff,
  evening,
  glow,
  groupNames,
  headline,
  isLight,
  isOn,
  rgbCss,
  roomSections,
  sectionLevel,
  sectionStatus,
  sectionsFor,
  sectionSwitch,
  summarize,
  switchCommand,
  UNASSIGNED_ROOM,
  WARM_WHITE,
  type Filter,
  type Section,
} from "./model";
import { AddTile, Tile } from "./tile";
import { useHouse, type House } from "./useHouse";

export type GharHouseProps = {
  /** A device to select (from a toast's `?device=`); `key` changes on every navigation to it. */
  focus: { deviceId: string; key: string } | null;
};

/** The Ghar page's body. */
export function GharHouse({ focus }: GharHouseProps) {
  const house = useHouse();
  const { devicesQuery, roomsQuery, connected } = house;
  const [filter, setFilter] = useState<Filter>({ kind: "everywhere" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pairingRoom, setPairingRoom] = useState<string | null>(null);
  const [newRoom, setNewRoom] = useState(false);

  useEffect(() => {
    if (focus) {
      setSelectedId(focus.deviceId);
      setFilter({ kind: "everywhere" });
    }
  }, [focus?.deviceId, focus?.key]);

  if (!connected && !devicesQuery.data) {
    return <StateView tone="offline" label="Ghar is offline" detail="The house comes back when dadi reconnects" />;
  }
  if (devicesQuery.isError && !devicesQuery.data) {
    return <StateView tone="error" label="Could not reach Ghar" error={devicesQuery.error} onRetry={() => void devicesQuery.refetch()} />;
  }
  if (roomsQuery.isError && !roomsQuery.data) {
    return <StateView tone="error" label="Could not load rooms" error={roomsQuery.error} onRetry={() => void roomsQuery.refetch()} />;
  }
  if (!devicesQuery.data || !roomsQuery.data) {
    return <StateView tone="loading" label="Opening the house" />;
  }

  const devices = devicesQuery.data.devices;
  const rooms = roomsQuery.data.rooms;
  const groups = groupNames(devices);
  const everyRoom = roomSections(devices, rooms);
  const shown: Filter =
    (filter.kind === "room" && !everyRoom.some((section) => section.room?.id === filter.id)) ||
    (filter.kind === "group" && !groups.includes(filter.name))
      ? { kind: "everywhere" }
      : filter;
  const sections = sectionsFor(shown, devices, rooms);
  /** What the inspector shows: the picked device, or until one is picked a lit light, else any light, so the panel opens on Khisso's light sheet instead of an empty "Nothing selected". */
  const selected =
    devices.find((device) => device.id === selectedId) ?? devices.find(isOn) ?? devices.find(isLight) ?? null;
  const total = summarize(devices);
  const litRooms = roomSections(devices.filter(isLight), rooms).filter((section) => section.devices.length > 0).length;

  const createRoom = async (name: string) => {
    setNewRoom(false);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    const made: GharRoom[] = [];
    const ok = await house.write(`Creating ${trimmed}`, async () => {
      made.push(await ghar.createRoom(trimmed));
    });
    const room = made[0];
    if (ok && room) {
      setFilter({ kind: "room", id: room.id });
    }
  };

  return (
    <div className="relative flex h-full min-h-0 gap-6">
      <div className="@container min-h-0 min-w-0 flex-1 overflow-y-auto px-[6px] pb-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="m-0 text-[40px] leading-[1.05] font-bold tracking-[-0.8px] text-ink">{headline(total)}</h2>
            {total.lights > 0 ? (
              <span className="text-[14px] text-ink-muted">
                {total.lights === 1 ? "1 light" : `${total.lights} lights`} in {litRooms === 1 ? "1 room" : `${litRooms} rooms`}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!connected || total.on === 0}
              onClick={() => void house.run(allOff(devices))}
              className="ghar-action"
            >
              All off
            </button>
            <button
              type="button"
              disabled={!connected || total.lights === 0}
              onClick={() => void house.run(evening(devices))}
              className="ghar-action"
            >
              <span className="size-[15px] text-clay">
                <IconMoon />
              </span>
              Evening
            </button>
            <button
              type="button"
              disabled={!connected}
              onClick={() => setPairingRoom("")}
              className="ghar-action ghar-action--primary"
            >
              Add a device
            </button>
          </div>
        </div>

        {!connected ? (
          <StaleBanner label="Ghar is offline" since={devicesQuery.dataUpdatedAt} detail="controls come back when it does" className="mt-4" />
        ) : devicesQuery.isError ? (
          <StaleBanner
            label="Ghar is not answering"
            since={devicesQuery.dataUpdatedAt}
            error={devicesQuery.error}
            detail="the next change tries again"
            className="mt-4"
          />
        ) : null}
        <AnimatePresence initial={false}>
          {house.failure ? (
            <motion.div key="failure" {...REVEAL} className="overflow-hidden">
              <p role="alert" className="m-0 flex items-start gap-3 pt-4 text-[13px] text-error select-text">
                <span className="flex-1">{house.failure}</span>
                <button type="button" onClick={house.dismiss} className="text-ink-muted hover:text-ink">
                  Dismiss
                </button>
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div role="toolbar" aria-label="Rooms and groups" className="flex flex-wrap gap-2 pt-5">
          <Chip selected={shown.kind === "everywhere"} onClick={() => setFilter({ kind: "everywhere" })}>
            Everywhere
          </Chip>
          {everyRoom.map((section) => (
            <Chip
              key={section.key}
              selected={shown.kind === "room" && shown.id === section.room?.id}
              onClick={() => section.room && setFilter({ kind: "room", id: section.room.id })}
            >
              {section.title}
            </Chip>
          ))}
          {groups.map((name) => (
            <Chip key={name} selected={shown.kind === "group" && shown.name === name} onClick={() => setFilter({ kind: "group", name })}>
              <span className="size-[13px]">
                <IconGroup />
              </span>
              {name}
            </Chip>
          ))}
          {newRoom ? (
            <input
              autoFocus
              placeholder="Room name"
              aria-label="New room name"
              onBlur={(event) => void createRoom(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  event.currentTarget.value = "";
                  event.currentTarget.blur();
                }
              }}
              className="ghar-chip ghar-chip--new w-40 outline-none"
            />
          ) : (
            <button type="button" disabled={!connected} onClick={() => setNewRoom(true)} className="ghar-chip ghar-chip--new gap-1.5">
              <span className="size-3.5">
                <IconAdd />
              </span>
              New room
            </button>
          )}
        </div>

        {devices.length === 0 && shown.kind === "everywhere" && everyRoom.length === 0 ? (
          <div className="pt-12">
            <StateView tone="empty" label="No devices yet" detail="Add a device to start the house" />
          </div>
        ) : null}

        <LayoutGroup>
          {sections.map((section) => (
            <SectionView
              key={section.key}
              section={section}
              devices={devices}
              rooms={rooms}
              house={house}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              onAdd={() => setPairingRoom(section.room && section.room.name !== UNASSIGNED_ROOM ? section.room.id : "")}
              onDeleted={() => setFilter({ kind: "everywhere" })}
            />
          ))}
        </LayoutGroup>
      </div>

      <Inspector device={selected} rooms={rooms} groups={groups} house={house} />

      <AnimatePresence>
        {pairingRoom !== null ? <PairingSheet rooms={rooms} startRoom={pairingRoom} onClose={() => setPairingRoom(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}

type ChipProps = {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
};

/** A filter chip; the chosen one is filled sage and the fill slides between them. */
function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`ghar-chip relative ${selected ? "ghar-chip--on" : ""}`}>
      {selected ? (
        <motion.span
          layoutId="ghar-chip-fill"
          className="absolute inset-0 rounded-full bg-sage-deep"
          transition={{ type: "spring", bounce: 0, duration: 0.32 }}
        />
      ) : null}
      <span className="relative flex items-center gap-1.5">{children}</span>
    </button>
  );
}

type SectionViewProps = {
  section: Section;
  /** Every device, for moving lights into a room. */
  devices: GharDevice[];
  rooms: GharRoom[];
  house: House;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDeleted: () => void;
};

/** One room or group: its name and status, brightness bar and switch, then its tiles. */
function SectionView({ section, devices, rooms, house, selectedId, onSelect, onAdd, onDeleted }: SectionViewProps) {
  const reduce = useReducedMotion() ?? false;
  const [mode, setMode] = useState<"idle" | "menu" | "rename" | "move" | "delete">("idle");
  const summary = summarize(section.devices);
  const room = section.room;
  const manageable = room !== null && room.name !== UNASSIGNED_ROOM;
  const disabled = !house.connected;
  const color = summary.color ? rgbCss(summary.color) : rgbCss(WARM_WHITE);

  const rename = async (name: string) => {
    setMode("idle");
    const trimmed = name.trim();
    if (room && trimmed.length > 0 && trimmed !== room.name) {
      await house.write(`Renaming ${room.name}`, () => ghar.renameRoom(room.id, trimmed));
    }
  };

  const remove = async () => {
    if (!room) {
      return;
    }
    const unplaced = rooms.find((candidate) => candidate.name === UNASSIGNED_ROOM);
    setMode("idle");
    const ok = await house.write(`Deleting ${room.name}`, async () => {
      if (section.devices.length > 0) {
        if (!unplaced) {
          throw new Error("Ghar has no unassigned room to move this room's devices into");
        }
        for (const device of section.devices) {
          await ghar.moveDevice(device.id, unplaced.id);
        }
      }
      await ghar.deleteRoom(room.id);
    });
    if (ok) {
      onDeleted();
    }
  };

  const elsewhere = room ? devices.filter((device) => device.room.id !== room.id) : [];

  return (
    <motion.section
      layout={reduce ? false : "position"}
      aria-label={section.title}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOWER_S, ease: EASE }}
    >
      <div className="flex items-center justify-between gap-4 pt-[30px] pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {mode === "rename" && room ? (
            <input
              autoFocus
              defaultValue={room.name}
              aria-label="Room name"
              onBlur={(event) => void rename(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setMode("idle");
                }
              }}
              className="ghar-inline-input text-[22px] font-bold"
            />
          ) : manageable ? (
            <button
              type="button"
              aria-label={`${section.title} options`}
              aria-expanded={mode !== "idle"}
              disabled={disabled}
              onClick={() => setMode(mode === "idle" ? "menu" : "idle")}
              className="group flex min-w-0 items-center gap-1 text-left text-[22px] font-bold text-ink"
            >
              <span className="truncate">{section.title}</span>
              <span className="size-[18px] shrink-0 text-ink-ghost group-hover:text-ink">
                <IconChevron open={mode !== "idle"} />
              </span>
            </button>
          ) : (
            <h3 className="m-0 flex items-center gap-1.5 truncate text-[22px] font-bold text-ink">
              {room === null ? (
                <span className="size-4 text-sage-deep">
                  <IconGroup />
                </span>
              ) : null}
              {section.title}
            </h3>
          )}
          <span className="text-[13px] text-ink-muted">{sectionStatus(summary, section.devices.length)}</span>
        </div>
        {summary.lights > 0 ? (
          <Switch
            on={summary.on > 0}
            label={`Switch ${section.title}`}
            disabled={disabled}
            onChange={() => void house.run(sectionSwitch(section.devices))}
          />
        ) : null}
      </div>
      {summary.lights > 0 ? (
        <LevelBar
          label="Brightness"
          value={summary.brightness}
          color={color}
          disabled={disabled}
          className="mb-[14px] h-11 w-full text-[14px]"
          onCommit={(level) => house.run(sectionLevel(section.devices, level))}
        />
      ) : null}

      <AnimatePresence initial={false}>
        {mode === "menu" || mode === "delete" || mode === "move" ? (
          <motion.div key="manage" {...REVEAL} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 pb-4 text-[13px]">
              {mode === "menu" ? (
                <>
                  <button type="button" onClick={() => setMode("rename")} className="ghar-action ghar-action--small">
                    Rename room
                  </button>
                  <button type="button" onClick={() => setMode("move")} className="ghar-action ghar-action--small">
                    Move lights here
                  </button>
                  <button type="button" onClick={() => setMode("delete")} className="ghar-action ghar-action--small text-error">
                    Delete room
                  </button>
                </>
              ) : mode === "delete" ? (
                <>
                  <span className="text-ink-muted">
                    Delete {section.title}?
                    {section.devices.length > 0
                      ? ` Its ${section.devices.length === 1 ? "device goes" : `${section.devices.length} devices go`} to Unplaced.`
                      : ""}
                  </span>
                  <button type="button" onClick={() => void remove()} className="ghar-action ghar-action--small text-error">
                    Delete room
                  </button>
                  <button type="button" onClick={() => setMode("idle")} className="ghar-action ghar-action--small">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="text-ink-muted">
                    {elsewhere.length === 0 ? "Every device is already here." : "Click a device to move it here:"}
                  </span>
                  {elsewhere.map((device) => (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => room && void house.write(`Moving ${device.name}`, () => ghar.moveDevice(device.id, room.id))}
                      className={`ghar-light-chip ${isOn(device) ? "ghar-light-chip--on" : ""}`}
                      style={isOn(device) ? ({ "--chip-color": glow(device) } as CSSProperties) : undefined}
                    >
                      <span className="ghar-light-chip__dot" />
                      {device.name}
                    </button>
                  ))}
                  <button type="button" onClick={() => setMode("idle")} className="ghar-action ghar-action--small">
                    Done
                  </button>
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-[14px] @md:grid-cols-3 @xl:grid-cols-4">
        <AnimatePresence initial={false} mode="popLayout">
          {section.devices.map((device) => (
            <motion.div
              key={device.id}
              layout={reduce ? false : "position"}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: SLOW_S, ease: EASE }}
            >
              <Tile
                device={device}
                selected={device.id === selectedId}
                busy={house.pending.has(device.id)}
                disabled={disabled || !device.online || house.pending.has(device.id)}
                onToggle={() => void house.run([{ id: device.id, command: switchCommand(!isOn(device)) }])}
                onSelect={() => onSelect(device.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {room !== null ? <AddTile label="Add a device here" onClick={onAdd} /> : null}
      </div>
    </motion.section>
  );
}

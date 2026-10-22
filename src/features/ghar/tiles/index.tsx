/**
 * Ghar as the phone shows it, the page's default view: room chips over glass tiles grouped
 * by room, each lit in its light's own color and brightness when on. A click switches a
 * device (or opens its controls when it has no switch); a long press, a right click or the
 * small sliders button opens its controls in a glass sheet.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ghar, isMeshOnline } from "../../../shared/api";
import { GHAR_DEVICES_KEY, GHAR_ROOMS_KEY } from "../../../shared/api/ghar";
import type { GharCommand, GharDevice } from "../../../types/ghar";
import { useConnection } from "../../../shared/hooks/useConnection";
import { StaleBanner, StateView } from "../../../shared/components/states";
import { EASE, SLOW_S, SLOWER_S } from "../../../shared/lib/ux/motion";
import { POLL_MS } from "../../../shared/lib/ux/poll";
import { shownError } from "../commission";
import { familyOf } from "../house/families";
import { lampLevel } from "../house/light";
import { DeviceSheet } from "./controls";
import { IconSliders, KindIcon } from "./icons";
import { groupByRoom, hasControls, tileGlow, tileOn, tileStatus } from "./style";

/** How long a press must hold to open the controls instead of switching. */
const LONG_PRESS_MS = 350;

/** How long a tile keeps waiting even when Ghar answers at once, so a click reads as a click. */
const COMMAND_HOLD_MS = 280;

/** One command to one device; `started` lets the hold measure from the click. */
type CommandRun = { id: string; command: GharCommand; started: number };

/** The tile grid for every device, by room. */
export function GharTiles() {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const queryClient = useQueryClient();
  const reduce = useReducedMotion() ?? false;
  const [room, setRoom] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<ReadonlySet<string>>(() => new Set());
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  const devicesQuery = useQuery({
    queryKey: GHAR_DEVICES_KEY,
    queryFn: () => ghar.listDevices(),
    enabled: connected,
    refetchInterval: connected ? POLL_MS : false,
  });
  const roomsQuery = useQuery({
    queryKey: GHAR_ROOMS_KEY,
    queryFn: () => ghar.listRooms(),
    enabled: connected,
  });

  const command = useMutation({
    mutationFn: (run: CommandRun) => ghar.command(run.id, run.command),
    onSuccess: (_data, run) => {
      setFailure((current) => (current?.id === run.id ? null : current));
    },
    onError: (err, run) => {
      setFailure({ id: run.id, message: shownError(err) });
    },
    onSettled: (_data, _error, run) => {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
      void queryClient.invalidateQueries({ queryKey: ["ghar", "events"] });
      const hold = Math.max(0, COMMAND_HOLD_MS - (Date.now() - run.started));
      window.setTimeout(() => {
        setWaiting((current) => {
          const next = new Set(current);
          next.delete(run.id);
          return next;
        });
      }, hold);
    },
  });

  /** Sends one command; a device already waiting on one is left alone. */
  function send(id: string, next: GharCommand): void {
    if (waiting.has(id)) {
      return;
    }
    setWaiting((current) => new Set(current).add(id));
    command.mutate({ id, command: next, started: Date.now() });
  }

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
    return (
      <div aria-label="Loading Ghar" className="mx-auto grid w-full max-w-[1100px] gap-3 px-1 pt-12 [grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-[132px] animate-pulse rounded-[24px] border border-rule bg-sage-fill/40" />
        ))}
      </div>
    );
  }

  const devices = devicesQuery.data.devices;
  if (devices.length === 0) {
    return <StateView tone="empty" label="No devices yet" detail="Add one from the House view" />;
  }
  const everywhere = groupByRoom(devices, roomsQuery.data.rooms, null);
  const chosen = room !== null && everywhere.some((group) => group.room.id === room) ? room : null;
  const groups = chosen === null ? everywhere : everywhere.filter((group) => group.room.id === chosen);
  const focused = devices.find((device) => device.id === focusedId) ?? null;

  function tap(device: GharDevice): void {
    if (!connected || !device.online) {
      return;
    }
    const primary = familyOf(device).primary(device);
    if (primary) {
      send(device.id, primary);
      return;
    }
    setFocusedId(device.id);
  }

  return (
    <div className="relative h-full min-h-0">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5 px-1 pb-8">
          <RoomChips
            rooms={everywhere.map((group) => ({ id: group.room.id, title: group.title }))}
            chosen={chosen}
            onChoose={setRoom}
          />
          {!connected ? (
            <StaleBanner label="Ghar is offline" since={devicesQuery.dataUpdatedAt} detail="controls come back when it does" />
          ) : devicesQuery.isError ? (
            <StaleBanner
              label="Ghar is not answering"
              since={devicesQuery.dataUpdatedAt}
              error={devicesQuery.error}
              detail="the next poll tries again"
            />
          ) : null}
          {failure && !focused ? (
            <p role="alert" className="m-0 text-[13px] text-error select-text">
              {devices.find((device) => device.id === failure.id)?.name ?? "Ghar"}: {failure.message}
            </p>
          ) : null}
          <LayoutGroup>
            {groups.map((group) => (
              <motion.section
                key={group.room.id}
                layout={reduce ? false : "position"}
                className="flex flex-col gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: SLOWER_S, ease: EASE }}
              >
                {chosen === null ? (
                  <h3 className="m-0 px-1 text-[11px] font-medium tracking-[2.5px] text-sage-deep uppercase">
                    {group.title}
                    <span className="ml-2 tracking-[1px] text-ink-ghost normal-case">
                      {litCount(group.devices)}
                    </span>
                  </h3>
                ) : null}
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(168px,1fr))]">
                  <AnimatePresence initial={false} mode="popLayout">
                    {group.devices.map((device) => (
                      <Tile
                        key={device.id}
                        device={device}
                        busy={waiting.has(device.id)}
                        disabled={!connected}
                        onTap={() => tap(device)}
                        onControls={() => setFocusedId(device.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.section>
            ))}
          </LayoutGroup>
        </div>
      </div>
      <AnimatePresence>
        {focused ? (
          <DeviceSheet
            key={focused.id}
            device={focused}
            pending={waiting.has(focused.id) || !connected}
            error={failure?.id === focused.id ? failure.message : null}
            send={(next) => send(focused.id, next)}
            onClose={() => setFocusedId(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** "2 on", or nothing when nothing in the room is on. */
function litCount(devices: GharDevice[]): string {
  const on = devices.filter(tileOn).length;
  return on > 0 ? `${on} on` : "";
}

type RoomChipsProps = {
  rooms: Array<{ id: string; title: string }>;
  chosen: string | null;
  onChoose: (room: string | null) => void;
};

/** Everywhere and each room with devices; the chosen chip's sage fill slides between them. */
function RoomChips({ rooms, chosen, onChoose }: RoomChipsProps) {
  const chips = [{ id: null, title: "Everywhere" }, ...rooms];
  return (
    <div role="tablist" aria-label="Rooms" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
      {chips.map((chip) => {
        const selected = chip.id === chosen;
        return (
          <button
            key={chip.id ?? "everywhere"}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChoose(chip.id)}
            className={`ghar-chip relative shrink-0 ${selected ? "ghar-chip--on" : ""}`}
          >
            {selected ? (
              <motion.span
                layoutId="ghar-chip-fill"
                className="absolute inset-0 rounded-full bg-sage-deep"
                transition={{ type: "spring", bounce: 0, duration: 0.32 }}
              />
            ) : null}
            <span className="relative">{chip.title}</span>
          </button>
        );
      })}
    </div>
  );
}

type TileProps = {
  device: GharDevice;
  /** A command for it is in flight. */
  busy: boolean;
  /** Ghar is unreachable: the tile shows its last reading and does nothing. */
  disabled: boolean;
  onTap: () => void;
  onControls: () => void;
};

/** One device as a glass tile: its glyph, name and status, glowing in its light's color when on. */
function Tile({ device, busy, disabled, onTap, onControls }: TileProps) {
  const on = tileOn(device);
  const press = useRef<number | null>(null);
  const held = useRef(false);
  const controls = hasControls(device);

  useEffect(() => {
    return () => {
      if (press.current !== null) {
        window.clearTimeout(press.current);
      }
    };
  }, []);

  const cancelPress = () => {
    if (press.current !== null) {
      window.clearTimeout(press.current);
      press.current = null;
    }
  };

  const style = {
    "--glow": tileGlow(device),
    "--level": device.kind === "light" ? lampLevel(device) : 1,
  } as CSSProperties;

  return (
    <motion.div
      layout="position"
      className={`ghar-glow-tile group ${on ? "ghar-glow-tile--on" : ""} ${device.online ? "" : "ghar-glow-tile--offline"}`}
      style={style}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: SLOW_S, ease: EASE }}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-sage"
        aria-label={`${device.name}, ${tileStatus(device)}`}
        aria-pressed={typeof device.state.on?.value === "boolean" ? on : undefined}
        disabled={disabled}
        onPointerDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          held.current = false;
          cancelPress();
          press.current = window.setTimeout(() => {
            press.current = null;
            held.current = true;
            onControls();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault();
          cancelPress();
          onControls();
        }}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          onTap();
        }}
      />
      <div className="pointer-events-none relative flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between">
          <span className="ghar-glow-icon">
            <span className="size-[22px]">
              <KindIcon kind={device.kind} />
            </span>
          </span>
          {busy ? (
            <span aria-hidden className="mt-1 size-4 animate-spin rounded-full border-2 border-sage/30 border-t-sage" />
          ) : !device.online ? (
            <span className="mt-1 text-[10px] font-medium tracking-[1.5px] text-ink-ghost uppercase">Offline</span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 text-left">
          <span className="line-clamp-2 text-[14px] leading-snug font-semibold text-ink">{device.name}</span>
          <span className={`truncate text-[12.5px] ${on ? "text-sage-text" : "text-ink-muted"}`}>{tileStatus(device)}</span>
        </div>
      </div>
      {controls && !busy && device.online ? (
        <button
          type="button"
          aria-label={`${device.name} controls`}
          title="Controls"
          disabled={disabled}
          onClick={onControls}
          className="ghar-glow-tile__more absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-full text-ink-muted"
        >
          <span className="size-3.5">
            <IconSliders />
          </span>
        </button>
      ) : null}
    </motion.div>
  );
}

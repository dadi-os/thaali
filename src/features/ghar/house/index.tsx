/**
 * Ghar's house, shared by the page and the home tile. The page is the house at a glance (a
 * ledger over the house in miniature and what needs a look) over a glass panel per room, each
 * device drawn as its family's abstract form; the tile is the house in miniature over a line of
 * how much of it is lit. On the tile a room or lamp tap switches it and does not navigate.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ghar, isMeshOnline } from "../../../shared/api";
import { GHAR_DEVICES_KEY, GHAR_ROOMS_KEY } from "../../../shared/api/ghar";
import type { GharCommand, GharDevice, GharRoom } from "../../../types/ghar";
import { useConnection } from "../../../shared/hooks/useConnection";
import { IconPlus } from "../../../shared/components/IconButton";
import { Popover, type PopoverAnchor } from "../../../shared/components/Popover";
import { SearchField } from "../../../shared/components/SearchField";
import { StaleBanner, StateView, type StaleBannerProps } from "../../../shared/components/states";
import { Ticker } from "../../../shared/components/Ticker";
import { POLL_MS } from "../../../shared/lib/ux/poll";
import { PairingSheet, shownError } from "../commission";
import { attention, familyOf } from "./families";
import { Horizon } from "./horizon";
import { DevicePopover } from "./inspector";
import { isLamp, isLit } from "./light";
import { HouseMap } from "./map";
import { DeviceFace, GLIDE, RoomPanel } from "./rooms";
import { searchHouse, type RoomRef } from "./search";

export type GharHouseProps = {
  /** `preview` is the home tile. `full` is the page. */
  mode: "preview" | "full";
  /** Page header slot for search, Add device and New room in `full` mode; null on the home tile. */
  toolbar: HTMLElement | null;
  /**
   * Device whose controls to open once it is on screen (from a toast in `full` mode).
   * `key` is new on every arrival, so the same device can be focused again.
   */
  focus?: { deviceId: string; key: string } | null;
};

type DragGhost = {
  id: string;
  x: number;
  y: number;
  overId: string | null;
};

type PointerSession = {
  id: string;
  startX: number;
  startY: number;
  dragging: boolean;
};

/** One command for some devices; `started` lets the hold below measure from the tap. */
type CommandRun = { ids: string[]; command: GharCommand; started: number };

const DRAG_PX = 4;
/** How long a device stays waiting even when Ghar answers immediately, so a tap reads as a tap. */
const COMMAND_HOLD_MS = 280;
const HOVER_OPEN_MS = 160;
const HOVER_CLOSE_MS = 320;
/** How long a room stays drawn out after the horizon points at it. */
const FLASH_MS = 1_200;
/**
 * New room form anchor past the button's bottom-right corner. Popover has no room
 * to open rightward at the header's edge, so it flips left and hangs right-aligned
 * just under the button instead of covering the search box.
 */
const NEW_ROOM_ANCHOR_OFFSET = { x: 28, y: 30 };
/** Rooms offered to an empty house. */
const FIRST_ROOMS = ["Living room", "Kitchen", "Bedroom"];

/**
 * Rooms and devices. Tile rows switch a room and do not navigate. On the page, a tap does a
 * device's primary action (or opens its controls), hover opens its controls, a drag moves it
 * to another room.
 */
export function GharHouse({ mode, toolbar, focus }: GharHouseProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const session = useRef<PointerSession | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  const [drag, setDrag] = useState<DragGhost | null>(null);
  const [waiting, setWaiting] = useState<ReadonlySet<string>>(() => new Set());
  const waitingRef = useRef<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [naming, setNaming] = useState(false);
  const [roomAnchor, setRoomAnchor] = useState<PopoverAnchor | null>(null);
  const [roomDraft, setRoomDraft] = useState("");
  const [query, setQuery] = useState("");
  const [pairing, setPairing] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);
  const [entering, setEntering] = useState(true);
  const roomButtonRef = useRef<HTMLButtonElement>(null);
  const focusedKey = useRef<string | null>(null);

  useEffect(() => {
    if (hoverId !== null) {
      setShownId(hoverId);
    }
  }, [hoverId]);

  useEffect(() => {
    return () => {
      for (const timer of [openTimer.current, closeTimer.current, flashTimer.current]) {
        if (timer !== null) {
          window.clearTimeout(timer);
        }
      }
    };
  }, []);

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
    mutationFn: (run: CommandRun) => Promise.all(run.ids.map((id) => ghar.command(id, run.command))),
    onSettled: (_data, _error, run) => {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
      void queryClient.invalidateQueries({ queryKey: ["ghar", "events"] });
      const hold = Math.max(0, COMMAND_HOLD_MS - (Date.now() - run.started));
      window.setTimeout(() => {
        for (const id of run.ids) {
          waitingRef.current.delete(id);
        }
        setWaiting(new Set(waitingRef.current));
      }, hold);
    },
  });

  const identify = useMutation({
    mutationFn: (id: string) => ghar.identify(id),
  });

  const pendingIds = new Set<string>([...waiting, ...(identify.isPending && identify.variables ? [identify.variables] : [])]);

  /** Send one command to some devices; devices already waiting on a command are left alone. */
  function send(ids: string[], next: GharCommand): void {
    if (ids.length === 0 || ids.some((id) => waitingRef.current.has(id))) {
      return;
    }
    for (const id of ids) {
      waitingRef.current.add(id);
    }
    setWaiting(new Set(waitingRef.current));
    command.mutate({ ids, command: next, started: Date.now() });
  }

  const move = useMutation({
    mutationFn: (input: { id: string; room: RoomRef }) => ghar.moveDevice(input.id, input.room.id),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: GHAR_DEVICES_KEY });
      const previous = queryClient.getQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY);
      queryClient.setQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY, (current) =>
        current
          ? { devices: current.devices.map((device) => (device.id === input.id ? { ...device, room: input.room } : device)) }
          : current,
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(GHAR_DEVICES_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
    },
  });

  const rename = useMutation({
    mutationFn: (input: { id: string; name: string }) => ghar.renameDevice(input.id, input.name),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: GHAR_DEVICES_KEY });
      const previous = queryClient.getQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY);
      queryClient.setQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY, (current) =>
        current
          ? { devices: current.devices.map((device) => (device.id === input.id ? { ...device, name: input.name } : device)) }
          : current,
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(GHAR_DEVICES_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
    },
  });

  const create = useMutation({
    mutationFn: (name: string) => ghar.createRoom(name),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GHAR_ROOMS_KEY });
    },
  });

  const ready = devicesQuery.data !== undefined && (mode === "preview" || roomsQuery.data !== undefined);
  useEffect(() => {
    if (ready) {
      setEntering(false);
    }
  }, [ready]);

  useEffect(() => {
    const device = devicesQuery.data?.devices.find((d) => d.id === focus?.deviceId);
    if (!focus || !device || focusedKey.current === focus.key) {
      return;
    }
    if (showDevice(device)) {
      focusedKey.current = focus.key;
    }
  });

  if (!connected && !devicesQuery.data) {
    return <StateView tone="offline" label="Ghar is offline" detail="The house comes back when dadi reconnects" compact={mode === "preview"} />;
  }
  if (devicesQuery.isError && !devicesQuery.data) {
    return (
      <StateView
        tone="error"
        label="Could not reach Ghar"
        error={devicesQuery.error}
        onRetry={() => void devicesQuery.refetch()}
        compact={mode === "preview"}
      />
    );
  }
  if (mode === "full" && roomsQuery.isError && !roomsQuery.data) {
    return <StateView tone="error" label="Could not load rooms" error={roomsQuery.error} onRetry={() => void roomsQuery.refetch()} />;
  }
  if (!devicesQuery.data || (mode === "full" && !roomsQuery.data)) {
    return mode === "full" ? (
      <div aria-label="Loading Ghar" className="flex h-full min-h-0 flex-col gap-5 px-1 pb-4">
        <span className="h-[220px] animate-pulse rounded-[var(--radius-window)] border border-rule bg-sage-fill/40" />
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,370px),1fr))]">
          {[0, 1].map((i) => (
            <span key={i} className="h-60 animate-pulse rounded-[var(--radius-window)] border border-rule bg-sage-fill/40" />
          ))}
        </div>
      </div>
    ) : (
      <div aria-label="Loading Ghar" className={`h-full ${tileBody}`}>
        <span className="min-h-0 flex-1 animate-pulse rounded-[10px] bg-sage-fill/50" />
        <span className={tileLine}>
          <Ticker value={null} loadingDigits={1} className="text-[12px] text-ink" />
        </span>
      </div>
    );
  }

  const devices = devicesQuery.data.devices;
  const rooms: GharRoom[] = roomsQuery.data?.rooms ?? [];
  const named = namedRooms(rooms, devices);
  const unassigned =
    rooms.find((room) => room.name === "unassigned") ?? devices.find((device) => device.room.name === "unassigned")?.room ?? null;
  const unplacedCount = devices.filter((device) => device.room.name === "unassigned").length;
  const showUnplaced = mode === "full" && unassigned !== null && (unplacedCount > 0 || named.length === 0);
  const panels: RoomRef[] = showUnplaced && unassigned ? [unassigned, ...named] : named;
  const dragged = devices.find((device) => device.id === drag?.id) ?? null;
  const inspected = devices.find((device) => device.id === (hoverId ?? shownId)) ?? null;
  const search = searchHouse(query, panels, devices);

  const stale: Pick<StaleBannerProps, "label" | "error" | "detail"> | null = !connected
    ? { label: "Ghar is offline", detail: "controls come back when it does" }
    : devicesQuery.isError
      ? { label: "Ghar is not answering", error: devicesQuery.error, detail: "the next poll tries again" }
      : null;

  const trouble =
    (command.isError ? shownError(command.error) : null) ??
    (identify.isError ? shownError(identify.error) : null) ??
    (move.isError ? shownError(move.error) : null) ??
    (rename.isError ? shownError(rename.error) : null) ??
    (create.isError ? shownError(create.error) : null) ??
    (roomsQuery.isError ? shownError(roomsQuery.error) : null);

  function toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: clientX, y: clientY };
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function roomAt(clientX: number, clientY: number): string | null {
    const hit = document
      .elementsFromPoint(clientX, clientY)
      .map((node) => (node instanceof Element ? node.closest("[data-room-id]") : null))
      .find((node): node is Element => node !== null);
    return hit?.getAttribute("data-room-id") ?? null;
  }

  function findRoom(id: string): RoomRef | null {
    const fromList = rooms.find((room) => room.id === id);
    if (fromList) {
      return { id: fromList.id, name: fromList.name };
    }
    const fromDevice = devices.find((device) => device.room.id === id)?.room;
    return fromDevice ? { id: fromDevice.id, name: fromDevice.name } : null;
  }

  /** Switch a room's lights: off if any is on, else all on. */
  function toggleRoom(roomId: string): void {
    const lamps = devices.filter((device) => device.room.id === roomId && device.online && isLamp(device));
    if (lamps.length === 0 || !connected) {
      return;
    }
    const lit = lamps.filter(isLit);
    send(
      (lit.length > 0 ? lit : lamps).map((device) => device.id),
      { capability: "on_off", command: lit.length > 0 ? "off" : "on" },
    );
  }

  /** Switch one lamp, unless Ghar or the lamp is unreachable. */
  function toggleLamp(device: GharDevice): void {
    if (!connected || !device.online) {
      return;
    }
    send([device.id], { capability: "on_off", command: "toggle" });
  }

  function clearOpenTimer(): void {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }

  function clearCloseTimer(): void {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function anchorFor(el: HTMLElement): PopoverAnchor {
    const canvas = canvasRef.current?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (!canvas) {
      return { x: rect.right, y: rect.top + rect.height / 2, radius: 0 };
    }
    return { x: rect.right - canvas.left, y: rect.top - canvas.top + rect.height / 2, radius: 0 };
  }

  function scheduleHover(deviceId: string, el: HTMLElement): void {
    if (session.current?.dragging || drag) {
      return;
    }
    clearCloseTimer();
    if (hoverId === deviceId) {
      setAnchor(anchorFor(el));
      return;
    }
    clearOpenTimer();
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      if (session.current?.dragging) {
        return;
      }
      setHoverId(deviceId);
      setAnchor(anchorFor(el));
    }, HOVER_OPEN_MS);
  }

  function scheduleHoverClose(): void {
    clearOpenTimer();
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setHoverId(null);
    }, HOVER_CLOSE_MS);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>, device: GharDevice): void {
    if (mode !== "full" || event.button !== 0 || !connected) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearOpenTimer();
    session.current = { id: device.id, startX: event.clientX, startY: event.clientY, dragging: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    const current = session.current;
    if (!current || !canvasRef.current) {
      return;
    }
    const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (!current.dragging && distance < DRAG_PX) {
      return;
    }
    if (!current.dragging) {
      clearOpenTimer();
      clearCloseTimer();
      setHoverId(null);
    }
    current.dragging = true;
    const local = toLocal(event.clientX, event.clientY);
    setDrag({ id: current.id, x: local.x, y: local.y, overId: roomAt(event.clientX, event.clientY) });
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>, device: GharDevice): void {
    const current = session.current;
    session.current = null;
    if (!current || current.id !== device.id) {
      return;
    }
    event.stopPropagation();
    if (current.dragging) {
      const overId = roomAt(event.clientX, event.clientY);
      setDrag(null);
      if (overId && overId !== device.room.id) {
        const room = findRoom(overId);
        if (room) {
          move.mutate({ id: device.id, room });
        }
      }
      return;
    }
    setDrag(null);
    const primary = familyOf(device).primary(device);
    if (primary === null || !device.online) {
      showDevice(device);
      return;
    }
    if (connected && !pendingIds.has(device.id)) {
      send([device.id], primary);
    }
    scheduleHover(device.id, event.currentTarget);
  }

  function openNewRoom(): void {
    const button = roomButtonRef.current;
    const canvas = canvasRef.current;
    if (!button || !canvas) {
      return;
    }
    const rect = button.getBoundingClientRect();
    const origin = canvas.getBoundingClientRect();
    setRoomAnchor({
      x: rect.right - origin.left + NEW_ROOM_ANCHOR_OFFSET.x,
      y: rect.bottom - origin.top + NEW_ROOM_ANCHOR_OFFSET.y,
      radius: 0,
    });
    setNaming(true);
  }

  /** Open a device's controls as if hovered, e.g. when search narrows to it or a toast points at it; false when it is not on screen. */
  function showDevice(device: GharDevice): boolean {
    const el = canvasRef.current?.querySelector<HTMLElement>(`[data-device-id="${device.id}"]`);
    if (!el) {
      return false;
    }
    clearOpenTimer();
    clearCloseTimer();
    setHoverId(device.id);
    setAnchor(anchorFor(el));
    return true;
  }

  /** Bring a room's panel into view and draw it out for a moment. */
  function pointAtRoom(roomId: string): void {
    canvasRef.current?.querySelector(`[data-room-id="${roomId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(roomId);
    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current);
    }
    flashTimer.current = window.setTimeout(() => setFlashId(null), FLASH_MS);
  }

  function submitRoom(name: string): void {
    const trimmed = name.trim();
    if (!trimmed || create.isPending) {
      return;
    }
    setNaming(false);
    setRoomDraft("");
    create.mutate(trimmed);
  }

  if (mode === "preview") {
    const lamps = devices.filter(isLamp);
    const lightsOn = lamps.filter(isLit).length;
    const locks = devices.filter((device) => typeof device.state.locked?.value === "boolean");
    const unlocked = locks.some((device) => device.state.locked?.value === false);
    const flagged = devices.filter((device) => attention(device) !== null).length;
    return (
      <MotionConfig reducedMotion="user">
        <div className="relative flex h-full min-h-0 flex-col">
          <AnimatePresence initial={false}>
            {stale ? <StaleBanner key="stale" {...stale} since={devicesQuery.dataUpdatedAt} compact className="mx-2 mb-1" /> : null}
          </AnimatePresence>
          {trouble ? <p className="px-3 pt-1 text-[12px] text-error">{trouble}</p> : null}
          <div className={tileBody}>
            <div className="min-h-0 flex-1">
              {named.length === 0 ? (
                <p className="m-0 flex h-full items-center justify-center rounded-[10px] border border-dashed border-sage-line/70 text-[12.5px] text-ink-ghost">
                  {devices.length === 0
                    ? "No devices yet"
                    : devices.length === 1
                      ? "1 device unplaced"
                      : `${devices.length} devices unplaced`}
                </p>
              ) : (
                <HouseMap
                  rooms={named}
                  devices={devices}
                  pendingIds={pendingIds}
                  size="tile"
                  roomAction="switch"
                  onRoom={toggleRoom}
                  onLamp={toggleLamp}
                  live={connected}
                />
              )}
            </div>
            <div className={tileLine}>
              {lamps.length > 0 ? (
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <Ticker value={lightsOn} className="text-[12px] tracking-normal text-ink" />
                  <span className="font-numeric text-[10.5px] tracking-normal text-ink-ghost">/{lamps.length}</span>
                  <span className="truncate">{lamps.length === 1 ? "light on" : "lights on"}</span>
                </span>
              ) : (
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <Ticker value={devices.length} className="text-[12px] tracking-normal text-ink" />
                  <span className="truncate">{devices.length === 1 ? "device" : "devices"}</span>
                </span>
              )}
              <span className="flex shrink-0 items-center gap-3">
                {locks.length > 0 ? (
                  <span className={unlocked ? "text-[var(--clay)]" : undefined}>{unlocked ? "Unlocked" : "Locked"}</span>
                ) : null}
                {flagged > 0 ? (
                  <span className="flex items-center gap-1.5 text-[var(--clay)]">
                    <span aria-hidden className="ghar-mark" />
                    {flagged} to look at
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div ref={canvasRef} className="relative flex h-full min-h-0 flex-col">
        <AnimatePresence initial={false}>
          {stale ? <StaleBanner key="stale" {...stale} since={devicesQuery.dataUpdatedAt} className="mx-3 mb-3" /> : null}
        </AnimatePresence>
        {trouble ? <p className="px-3 pt-1 text-[12px] text-error">{trouble}</p> : null}
        {toolbar
          ? createPortal(
              <>
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder="Search Ghar"
                  matches={search.matches}
                  onPick={() => {
                    if (search.lonelyDevice) {
                      showDevice(search.lonelyDevice);
                    }
                  }}
                />
                <button type="button" onClick={() => setPairing(true)} disabled={!connected} className={toolButton}>
                  <span className="flex size-4 shrink-0">
                    <IconPlus />
                  </span>
                  Add device
                </button>
                <button ref={roomButtonRef} type="button" onClick={openNewRoom} className={toolButton}>
                  <span className="flex size-4 shrink-0">
                    <IconPlus />
                  </span>
                  New room
                </button>
              </>,
              toolbar,
            )
          : null}
        <motion.div
          layoutScroll
          className={`min-h-0 flex-1 overflow-y-auto px-1 pb-4 transition-[opacity,filter] duration-slower ease-dadi ${
            connected ? "" : "opacity-70 saturate-50"
          }`}
        >
          {devices.length === 0 ? (
            <div className="flex flex-col items-center gap-5 px-4 pt-14 pb-10 text-center">
              <div aria-hidden className="ghar-quiet">
                <span />
                <span />
                <b />
              </div>
              <h2 className="m-0 text-[12px] font-medium tracking-[0.3em] text-sage-deep uppercase">The house is quiet</h2>
              <p className="m-0 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-muted">
                Pair a light, plug, lock or sensor with its Matter code. It lands in Unplaced, and you drag it into a room.
              </p>
              <button
                type="button"
                disabled={!connected}
                onClick={() => setPairing(true)}
                className="rounded-full bg-sage-deep px-4 py-2 text-[12.5px] font-medium text-bone transition-opacity duration-slow ease-dadi hover:bg-sage disabled:opacity-40"
              >
                Add the first device
              </button>
              {named.length === 0 ? <FirstRooms onCreate={submitRoom} /> : null}
            </div>
          ) : (
            <>
              <Horizon
                rooms={named}
                devices={devices}
                pendingIds={pendingIds}
                live={connected}
                onRoom={pointAtRoom}
                onLamp={toggleLamp}
                onDevice={(id) => {
                  const device = devices.find((item) => item.id === id);
                  if (device) {
                    showDevice(device);
                  }
                }}
              />
              {search.rooms.length === 0 ? (
                <p className="py-16 text-center text-[13px] text-ink-ghost">No rooms or devices match “{query.trim()}”</p>
              ) : (
                <LayoutGroup>
                  <div className="mt-5 grid content-start items-start gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,370px),1fr))]">
                    <AnimatePresence mode="popLayout">
                      {search.rooms.map(({ room, listed }, index) => (
                        <RoomPanel
                          key={room.id}
                          room={room}
                          index={index}
                          entering={entering}
                          inRoom={devices.filter((device) => device.room.id === room.id)}
                          devices={listed}
                          hot={drag?.overId === room.id}
                          wide={room.name === "unassigned" && named.length === 0}
                          flash={flashId === room.id}
                          pendingIds={pendingIds}
                          draggingId={drag?.id ?? null}
                          onToggleRoom={() => toggleRoom(room.id)}
                          onPair={() => setPairing(true)}
                          onHover={scheduleHover}
                          onHoverEnd={scheduleHoverClose}
                          onPointerDown={onPointerDown}
                          onPointerMove={onPointerMove}
                          onPointerUp={endPointer}
                          onPointerCancel={endPointer}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </LayoutGroup>
              )}
              {named.length === 0 ? <FirstRooms onCreate={submitRoom} /> : null}
            </>
          )}
        </motion.div>
        {inspected && anchor ? (
          <DevicePopover
            device={inspected}
            open={hoverId !== null}
            anchor={anchor}
            containerRef={canvasRef}
            pending={pendingIds.has(inspected.id) || !connected}
            rooms={rooms}
            onClose={() => {
              clearOpenTimer();
              clearCloseTimer();
              setHoverId(null);
            }}
            onHoverStart={clearCloseTimer}
            onHoverEnd={scheduleHoverClose}
            onRename={(name) => rename.mutate({ id: inspected.id, name })}
            onMove={(room) => move.mutate({ id: inspected.id, room })}
            onIdentify={() => {
              if (!pendingIds.has(inspected.id)) {
                identify.mutate(inspected.id);
              }
            }}
            send={(next) => send([inspected.id], next)}
          />
        ) : null}
        <Popover
          open={naming && roomAnchor !== null}
          onClose={() => {
            setNaming(false);
            setRoomDraft("");
          }}
          anchor={roomAnchor ?? { x: 0, y: 0, radius: 0 }}
          containerRef={canvasRef}
          aria-label="New room"
          widthPx={240}
        >
          <form
            className="flex flex-col gap-3 px-3.5 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitRoom(roomDraft);
            }}
          >
            <span className="text-[10px] font-medium tracking-[0.14em] text-sage-deep uppercase">New room</span>
            <input
              value={roomDraft}
              autoFocus
              placeholder="Name"
              aria-label="Room name"
              onChange={(event) => setRoomDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setNaming(false);
                  setRoomDraft("");
                }
              }}
              className="border-b border-sage-line bg-transparent py-1 text-[14px] text-ink outline-none transition-colors duration-slow ease-dadi placeholder:text-ink-ghost focus:border-sage"
            />
            <button
              type="submit"
              disabled={roomDraft.trim().length === 0 || create.isPending}
              className="self-start rounded-full bg-sage-deep px-3 py-1.5 text-[12px] font-medium text-bone transition-opacity duration-slow ease-dadi hover:bg-sage disabled:cursor-default disabled:opacity-40"
            >
              {create.isPending ? "Adding…" : "Add room"}
            </button>
          </form>
        </Popover>
        <AnimatePresence>
          {dragged && drag ? (
            <motion.div
              key="ghost"
              className="pointer-events-none absolute z-20"
              style={{ left: drag.x, top: drag.y, x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
              animate={{ opacity: 1, scale: drag.overId && drag.overId !== dragged.room.id ? 1.06 : 1.02, rotate: -2 }}
              exit={{ opacity: 0, scale: 0.84, rotate: 0 }}
              transition={GLIDE}
            >
              <DeviceFace device={dragged} ghost pending={false} />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>{pairing ? <PairingSheet rooms={rooms} onClose={() => setPairing(false)} /> : null}</AnimatePresence>
      </div>
    </MotionConfig>
  );
}

/** The home tile's body: the house in miniature over its line. */
const tileBody = "flex min-h-0 flex-1 flex-col gap-1.5 px-2.5 pt-1 pb-2";

/** The home tile's line under the map: lights on at the left, locks and what needs a look at the right. */
const tileLine =
  "flex h-4 shrink-0 items-center justify-between gap-3 px-1 text-[10px] font-medium tracking-[0.16em] text-ink-ghost uppercase";

const toolButton =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[7px] border border-dashed border-sage-line bg-[var(--glass-sheet)] px-3 text-[11px] font-medium tracking-[0.14em] whitespace-nowrap text-sage-deep uppercase shadow-[var(--shadow)] transition-[border-color,background-color] duration-slow ease-dadi hover:border-sage hover:bg-sage-active/50 disabled:cursor-default disabled:opacity-50";

/** Dashed room outlines an empty house offers to make in one tap. */
function FirstRooms({ onCreate }: { onCreate: (name: string) => void }) {
  return (
    <div className="mx-auto mt-5 grid w-full max-w-[620px] gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      {FIRST_ROOMS.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onCreate(name)}
          className="h-[74px] rounded-[var(--radius-window)] border border-dashed border-sage-line text-[10.5px] tracking-[0.18em] text-ink-ghost uppercase transition-[border-color,color,background-color] duration-slow ease-dadi hover:border-sage hover:bg-sage-faint hover:text-sage-deep"
        >
          + {name}
        </button>
      ))}
    </div>
  );
}

/** Named rooms from the room list, plus any room a device already sits in. */
function namedRooms(rooms: GharRoom[], devices: GharDevice[]): RoomRef[] {
  const named: RoomRef[] = [];
  const seen = new Set<string>();
  for (const room of rooms) {
    if (room.name === "unassigned" || seen.has(room.id)) {
      continue;
    }
    seen.add(room.id);
    named.push({ id: room.id, name: room.name });
  }
  for (const device of devices) {
    if (device.room.name === "unassigned" || seen.has(device.room.id)) {
      continue;
    }
    seen.add(device.room.id);
    named.push({ id: device.room.id, name: device.room.name });
  }
  return named;
}

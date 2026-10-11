/**
 * Ghar rooms, shared by the page and the home widget: each room glows with the light its
 * lamps are giving off. Widget strips toggle a room and do not navigate.
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { ghar, isMeshOnline } from "../../../shared/api";
import { GHAR_DEVICES_KEY, GHAR_ROOMS_KEY } from "../../../shared/api/ghar";
import type { GharDevice, GharRoom } from "../../../types/ghar";
import { useConnection } from "../../../shared/hooks/useConnection";
import { IconPlus } from "../../../shared/components/IconButton";
import { Popover, type PopoverAnchor } from "../../../shared/components/Popover";
import { SearchField } from "../../../shared/components/SearchField";
import { POLL_MS } from "../../../shared/lib/ux/poll";
import { shownError, roomTitle, UnplacedCommission } from "../commission";
import { DeviceGlyph, glyphFor } from "./icons";
import { DevicePopover } from "./inspector";
import { isOn, isSwitchable, lampColor, lampLevel, PLAIN_LAMP, roomGlow } from "./light";
import { searchHouse, type RoomRef } from "./search";

export type GharHouseProps = {
  /** `preview` is the home widget: room tiles only. `full` is the page. */
  mode: "preview" | "full";
  /** Page header slot for search and New room in `full` mode; null on the home widget. */
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

const DRAG_PX = 4;
/** How long a toggle stays gray even when Ghar answers immediately. */
const TOGGLE_HOLD_MS = 280;
const HOVER_OPEN_MS = 160;
const HOVER_CLOSE_MS = 320;
/**
 * New room form anchor past the button's bottom-right corner. Popover has no room
 * to open rightward at the header's edge, so it flips left and hangs right-aligned
 * just under the button instead of covering the search box.
 */
const NEW_ROOM_ANCHOR_OFFSET = { x: 28, y: 30 };

/** The Matter product string when it says more than the device's own name, else null. */
function productSubtitle(device: GharDevice): string | null {
  const product = device.product_name?.trim() ?? "";
  if (!product) {
    return null;
  }
  if (product.localeCompare(device.name.trim(), undefined, { sensitivity: "accent" }) === 0) {
    return null;
  }
  return product;
}

/**
 * Write confirmed attributes after Ghar accepts a command.
 * The card stays on the previous reading until this runs.
 */
function confirmState(queryClient: QueryClient, id: string, values: Record<string, unknown>): void {
  const changedAt = new Date().toISOString();
  queryClient.setQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY, (current) =>
    current
      ? {
          devices: current.devices.map((device) =>
            device.id === id
              ? {
                  ...device,
                  state: {
                    ...device.state,
                    ...Object.fromEntries(
                      Object.entries(values).map(([key, value]) => [key, { value, changed_at: changedAt }]),
                    ),
                  },
                }
              : device,
          ),
        }
      : current,
  );
}

/**
 * Rooms and devices. Preview tiles toggle a room and do not navigate.
 * Full mode: click a device to switch it, hover for its controls, drag it into a room.
 */
export function GharHouse({ mode, toolbar, focus }: GharHouseProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const session = useRef<PointerSession | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [drag, setDrag] = useState<DragGhost | null>(null);
  const [waiting, setWaiting] = useState<ReadonlySet<string>>(() => new Set());
  const waitingRef = useRef<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const [naming, setNaming] = useState(false);
  const [roomAnchor, setRoomAnchor] = useState<PopoverAnchor | null>(null);
  const [roomDraft, setRoomDraft] = useState("");
  const [query, setQuery] = useState("");
  const roomButtonRef = useRef<HTMLButtonElement>(null);
  const focusedKey = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (openTimer.current !== null) {
        window.clearTimeout(openTimer.current);
      }
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current);
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

  const toggle = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => ghar.toggleSwitch(id))),
    onSuccess: (_data, ids) => {
      const current = queryClient.getQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY);
      for (const id of ids) {
        const device = current?.devices.find((item) => item.id === id);
        confirmState(queryClient, id, { on: device?.state.on?.value !== true });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
    },
  });

  const brightness = useMutation({
    mutationFn: (input: { id: string; level: number }) => ghar.setBrightness(input.id, input.level),
    onSuccess: (_data, input) => {
      confirmState(queryClient, input.id, { brightness: input.level });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
    },
  });

  const paint = useMutation({
    mutationFn: (
      input:
        | { id: string; hue: number; saturation: number }
        | { id: string; colorTemp: number },
    ) =>
      "colorTemp" in input
        ? ghar.setColorTemp(input.id, input.colorTemp)
        : ghar.setHue(input.id, input.hue, input.saturation),
    onSuccess: (_data, input) => {
      if ("colorTemp" in input) {
        confirmState(queryClient, input.id, { color_temp: input.colorTemp });
        return;
      }
      confirmState(queryClient, input.id, { hue: input.hue, saturation: input.saturation });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
    },
  });

  const identify = useMutation({
    mutationFn: (id: string) => ghar.identify(id),
  });

  const pendingIds = new Set<string>([
    ...waiting,
    ...(brightness.isPending && brightness.variables ? [brightness.variables.id] : []),
    ...(paint.isPending && paint.variables ? [paint.variables.id] : []),
    ...(identify.isPending && identify.variables ? [identify.variables] : []),
  ]);

  function beginToggle(ids: string[]): void {
    if (ids.length === 0 || ids.some((id) => waitingRef.current.has(id))) {
      return;
    }
    for (const id of ids) {
      waitingRef.current.add(id);
    }
    setWaiting(new Set(waitingRef.current));
    const started = Date.now();
    toggle.mutate(ids, {
      onSettled: () => {
        const hold = Math.max(0, TOGGLE_HOLD_MS - (Date.now() - started));
        window.setTimeout(() => {
          for (const id of ids) {
            waitingRef.current.delete(id);
          }
          setWaiting(new Set(waitingRef.current));
        }, hold);
      },
    });
  }

  const move = useMutation({
    mutationFn: (input: { id: string; room: RoomRef }) => ghar.moveDevice(input.id, input.room.id),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: GHAR_DEVICES_KEY });
      const previous = queryClient.getQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY);
      queryClient.setQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY, (current) =>
        current
          ? {
              devices: current.devices.map((device) =>
                device.id === input.id ? { ...device, room: input.room } : device,
              ),
            }
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
          ? {
              devices: current.devices.map((device) =>
                device.id === input.id ? { ...device, name: input.name } : device,
              ),
            }
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

  useEffect(() => {
    const device = devicesQuery.data?.devices.find((d) => d.id === focus?.deviceId);
    if (!focus || !device || focusedKey.current === focus.key) {
      return;
    }
    if (showDevice(device)) {
      focusedKey.current = focus.key;
    }
  });

  const create = useMutation({
    mutationFn: (name: string) => ghar.createRoom(name),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: GHAR_ROOMS_KEY });
    },
  });

  if (!connected && !devicesQuery.data) {
    return <StatusNote>Ghar is offline</StatusNote>;
  }
  if (devicesQuery.isError && !devicesQuery.data) {
    return <StatusNote tone="error">{shownError(devicesQuery.error)}</StatusNote>;
  }
  if (mode === "full" && roomsQuery.isError && !roomsQuery.data) {
    return <StatusNote tone="error">{shownError(roomsQuery.error)}</StatusNote>;
  }
  if (!devicesQuery.data || (!roomsQuery.data && roomsQuery.isLoading)) {
    return (
      <div
        aria-label="Loading Ghar"
        className={`grid h-full min-h-0 content-start gap-3 ${
          mode === "full" ? "px-3 pb-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))]" : "px-2 pb-2.5 pt-0.5"
        }`}
      >
        {[0, 1].map((i) => (
          <span
            key={i}
            className={`animate-pulse rounded-[16px] border border-rule bg-sage-fill/40 ${mode === "full" ? "h-56" : "h-14"}`}
          />
        ))}
      </div>
    );
  }

  const devices = devicesQuery.data.devices;
  const rooms = roomsQuery.data?.rooms ?? [];
  const named = namedRooms(rooms, devices);
  const unassigned =
    rooms.find((room) => room.name === "unassigned") ??
    devices.find((device) => device.room.name === "unassigned")?.room ??
    null;
  const panels: RoomRef[] =
    mode === "full" && unassigned ? [unassigned, ...named] : named;
  const dragged = devices.find((device) => device.id === drag?.id) ?? null;
  const hovered = devices.find((device) => device.id === hoverId) ?? null;

  const search = searchHouse(query, panels, devices);

  const trouble =
    (toggle.isError ? shownError(toggle.error) : null) ??
    (brightness.isError ? shownError(brightness.error) : null) ??
    (paint.isError ? shownError(paint.error) : null) ??
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

  function lightsIn(roomId: string): GharDevice[] {
    return devices.filter(
      (device) => device.room.id === roomId && device.online && isSwitchable(device),
    );
  }

  function toggleRoom(roomId: string): void {
    const lights = lightsIn(roomId);
    if (lights.length === 0 || !connected) {
      return;
    }
    if (lights.some((device) => pendingIds.has(device.id))) {
      return;
    }
    const anyOn = lights.some(isOn);
    const ids = (anyOn ? lights.filter(isOn) : lights).map((device) => device.id);
    beginToggle(ids);
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
    return {
      x: rect.right - canvas.left,
      y: rect.top - canvas.top + rect.height / 2,
      radius: 0,
    };
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
      setAnchor(null);
    }, HOVER_CLOSE_MS);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>, device: GharDevice): void {
    if (mode !== "full" || event.button !== 0 || !connected) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearOpenTimer();
    session.current = {
      id: device.id,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
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
      setAnchor(null);
    }
    current.dragging = true;
    const local = toLocal(event.clientX, event.clientY);
    setDrag({
      id: current.id,
      x: local.x,
      y: local.y,
      overId: roomAt(event.clientX, event.clientY),
    });
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
    if (connected && device.online && isSwitchable(device) && !pendingIds.has(device.id)) {
      beginToggle([device.id]);
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

  function submitRoom(): void {
    const name = roomDraft.trim();
    if (!name || create.isPending) {
      return;
    }
    setNaming(false);
    setRoomDraft("");
    create.mutate(name);
  }

  const emptyLabel =
    devices.length === 0 ? "No devices" : mode === "preview" ? "Unplaced" : null;

  return (
    <div ref={canvasRef} className="relative flex h-full min-h-0 flex-col">
      {!connected ? <p className="px-3 pt-1 text-[12px] text-ink-ghost">Ghar is offline</p> : null}
      {trouble ? <p className="px-3 pt-1 text-[12px] text-error">{trouble}</p> : null}
      {mode === "full" && toolbar
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
              <button
                ref={roomButtonRef}
                type="button"
                onClick={openNewRoom}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[7px] border border-dashed border-sage-line bg-[var(--glass-sheet)] px-3 text-[11px] font-medium tracking-[0.14em] whitespace-nowrap text-sage-deep uppercase shadow-[var(--shadow)] transition-[border-color,background-color] duration-slow ease-dadi hover:border-sage hover:bg-sage-active/50"
              >
                <span className="flex size-4 shrink-0">
                  <IconPlus />
                </span>
                New room
              </button>
            </>,
            toolbar,
          )
        : null}
      <div
        className={`min-h-0 flex-1 [container-type:size] ${mode === "full" ? "px-3 pb-3" : "px-2 pb-2.5 pt-0.5"}`}
      >
        {mode === "preview" && panels.length > 0 && search.rooms.length > 0 ? (
          <div className={`grid h-full min-h-0 auto-rows-fr gap-1.5 ${panels.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
            {search.rooms.map(({ room }) => (
              <RoomStrip
                key={room.id}
                room={room}
                lamps={devices.filter((device) => device.room.id === room.id && isSwitchable(device))}
                pendingIds={pendingIds}
                onToggle={() => toggleRoom(room.id)}
              />
            ))}
          </div>
        ) : panels.length === 0 && mode === "preview" ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[13px] text-ink-ghost">{emptyLabel}</p>
          </div>
        ) : panels.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[13px] text-ink-ghost">No rooms yet</p>
          </div>
        ) : search.rooms.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[13px] text-ink-ghost">No rooms or devices match “{query.trim()}”</p>
          </div>
        ) : (
          <div className="grid h-full min-h-0 content-start items-start gap-4 overflow-y-auto pb-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr))]">
            {search.rooms.map(({ room, listed }) => (
              <RoomCard
                key={room.id}
                room={room}
                inRoom={devices.filter((device) => device.room.id === room.id)}
                devices={listed}
                hot={drag?.overId === room.id}
                pendingIds={pendingIds}
                draggingId={drag?.id ?? null}
                onToggleRoom={() => toggleRoom(room.id)}
                onHover={scheduleHover}
                onHoverEnd={scheduleHoverClose}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
              />
            ))}
          </div>
        )}
      </div>
      {mode === "full" && hovered && anchor ? (
        <DevicePopover
          device={hovered}
          open
          anchor={anchor}
          containerRef={canvasRef}
          pending={pendingIds.has(hovered.id)}
          onClose={() => {
            clearOpenTimer();
            clearCloseTimer();
            setHoverId(null);
            setAnchor(null);
          }}
          onHoverStart={clearCloseTimer}
          onHoverEnd={scheduleHoverClose}
          onRename={(name) => rename.mutate({ id: hovered.id, name })}
          onIdentify={() => {
            if (!pendingIds.has(hovered.id)) {
              identify.mutate(hovered.id);
            }
          }}
          onBrightness={(level) => {
            if (!pendingIds.has(hovered.id)) {
              brightness.mutate({ id: hovered.id, level });
            }
          }}
          onHue={(hue, saturation) => {
            if (!pendingIds.has(hovered.id)) {
              paint.mutate({ id: hovered.id, hue, saturation });
            }
          }}
          onColorTemp={(mireds) => {
            if (!pendingIds.has(hovered.id)) {
              paint.mutate({ id: hovered.id, colorTemp: mireds });
            }
          }}
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
            submitRoom();
          }}
        >
          <span className="text-[10px] font-medium tracking-[0.14em] text-sage-deep uppercase">
            New room
          </span>
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
      {dragged && drag ? (
        <div
          className="pointer-events-none absolute z-20"
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -50%)" }}
        >
          <LightCard device={dragged} ghost pending={false} />
        </div>
      ) : null}
    </div>
  );
}

/** What a room's lights are doing, in a few words. */
function lightsSummary(lamps: GharDevice[]): string {
  if (lamps.length === 0) {
    return "No lights";
  }
  const on = lamps.filter((lamp) => lamp.online && isOn(lamp)).length;
  if (on === 0) {
    return lamps.length === 1 ? "Off" : "All off";
  }
  return on === lamps.length ? (on === 1 ? "On" : "All on") : `${on} of ${lamps.length} on`;
}

type LampOrbProps = {
  device: GharDevice;
  /** A command for it is in flight: gray and breathing. */
  pending: boolean;
  /** `sm` a dot in the widget's strip, `lg` the disc on a light card with the device's glyph. */
  size: "sm" | "lg";
};

/** A light as a disc: lit in its own color with a halo as strong as its level, a ring when off. */
function LampOrb({ device, pending, size }: LampOrbProps) {
  const lit = !pending && device.online && isSwitchable(device) && isOn(device);
  const color = lampColor(device);
  const style = lit
    ? ({ "--lamp": color ?? PLAIN_LAMP, "--lamp-level": String(0.35 + 0.65 * lampLevel(device)) } as CSSProperties)
    : undefined;
  return (
    <span
      aria-hidden
      className={`lamp-orb lamp-orb--${size} ${lit ? "lamp-orb--lit" : ""} ${pending ? "animate-breath" : ""}`}
      style={style}
    >
      {size === "lg" ? (
        <DeviceGlyph kind={glyphFor(device.capabilities)} lit={false} className="size-6 shrink-0" />
      ) : null}
    </span>
  );
}

type RoomStripProps = {
  room: RoomRef;
  /** Switchable devices in the room. */
  lamps: GharDevice[];
  pendingIds: ReadonlySet<string>;
  onToggle: () => void;
};

/** Home widget row for one room: its name, what its lights are doing, and each light as an orb. Click switches the room and does not open the page. */
function RoomStrip({ room, lamps, pendingIds, onToggle }: RoomStripProps) {
  const pending = lamps.some((lamp) => pendingIds.has(lamp.id));
  const lit = lamps.some((lamp) => lamp.online && isOn(lamp));
  const glow = roomGlow(lamps);
  return (
    <button
      type="button"
      aria-pressed={lit}
      aria-busy={pending}
      aria-label={`${roomTitle(room.name)} lights`}
      disabled={pending || lamps.length === 0}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className={`room-strip ${lit ? "room-strip--lit" : ""}`}
      style={glow ? { backgroundImage: glow } : undefined}
    >
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="max-w-full truncate text-[13px] font-medium text-ink">{roomTitle(room.name)}</span>
        <span className={`text-[11px] ${lit ? "text-sage-deep" : "text-ink-ghost"}`}>{lightsSummary(lamps)}</span>
      </span>
      <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
        {lamps.map((lamp) => (
          <LampOrb key={lamp.id} device={lamp} pending={pendingIds.has(lamp.id)} size="sm" />
        ))}
      </span>
    </button>
  );
}

type DeviceHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, device: GharDevice) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>, device: GharDevice) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>, device: GharDevice) => void;
  onHover: (deviceId: string, el: HTMLElement) => void;
  onHoverEnd: () => void;
};

type RoomCardProps = DeviceHandlers & {
  room: RoomRef;
  /** Every device in the room, for its summary and glow. */
  inRoom: GharDevice[];
  /** The devices search leaves showing. */
  devices: GharDevice[];
  /** A dragged device is over the room. */
  hot: boolean;
  pendingIds: ReadonlySet<string>;
  draggingId: string | null;
  onToggleRoom: () => void;
};

/**
 * One room: a glass card washed in the light of its lit lamps, its name, what its lights
 * are doing and a switch for all of them, over its devices. Unplaced is the dashed pairing
 * zone instead. Devices are dropped onto any card to move them.
 */
function RoomCard({
  room,
  inRoom,
  devices,
  hot,
  pendingIds,
  draggingId,
  onToggleRoom,
  ...handlers
}: RoomCardProps) {
  const unplaced = room.name === "unassigned";
  const lamps = inRoom.filter(isSwitchable);
  const lit = lamps.some((lamp) => lamp.online && isOn(lamp));
  const pending = lamps.some((lamp) => pendingIds.has(lamp.id));
  const glow = unplaced ? null : roomGlow(lamps);
  return (
    <section
      data-room-id={room.id}
      aria-label={roomTitle(room.name)}
      className={`room-card ${unplaced ? "room-card--unplaced" : ""} ${hot ? "room-card--hot" : ""}`}
    >
      <span aria-hidden className="room-card__glow" style={{ backgroundImage: glow ?? "none", opacity: glow ? 1 : 0 }} />
      <header className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium text-ink">{roomTitle(room.name)}</h2>
          <p className={`text-[12px] ${lit ? "text-sage-deep" : "text-ink-ghost"}`}>
            {unplaced ? "New devices land here · drag one into a room" : lightsSummary(lamps)}
          </p>
        </div>
        {!unplaced && lamps.length > 0 ? (
          <button
            type="button"
            role="switch"
            aria-checked={lit}
            aria-label={`${roomTitle(room.name)} lights`}
            disabled={pending}
            onClick={onToggleRoom}
            className={`room-switch ${lit ? "room-switch--on" : ""} ${pending ? "animate-breath" : ""}`}
          >
            <span className="room-switch__knob" />
          </button>
        ) : null}
      </header>
      {unplaced ? <UnplacedCommission /> : null}
      {devices.length > 0 ? (
        <div className="relative grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
          {devices.map((device) => (
            <DeviceMark
              key={device.id}
              device={device}
              pending={pendingIds.has(device.id)}
              dimmed={draggingId === device.id}
              {...handlers}
            />
          ))}
        </div>
      ) : unplaced ? null : (
        <p className="relative rounded-[12px] border border-dashed border-sage-line px-3 py-5 text-center text-[12px] text-ink-ghost">
          Drag a device here
        </p>
      )}
    </section>
  );
}

type DeviceMarkProps = DeviceHandlers & {
  device: GharDevice;
  pending: boolean;
  /** It is the one being dragged, so its place shows faded. */
  dimmed: boolean;
};

/**
 * A device's card where it sits. Click switches it. Hover opens controls. A move drags it to another room.
 */
function DeviceMark({
  device,
  pending,
  dimmed,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onHover,
  onHoverEnd,
}: DeviceMarkProps) {
  return (
    <div
      data-device-id={device.id}
      onPointerDown={(event) => onPointerDown(event, device)}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => onPointerUp(event, device)}
      onPointerCancel={(event) => onPointerCancel(event, device)}
      onMouseEnter={(event) => onHover(device.id, event.currentTarget)}
      onMouseLeave={onHoverEnd}
      onClick={(event) => event.stopPropagation()}
      className={`touch-none transition-opacity duration-slow ease-dadi ${dimmed ? "opacity-30" : ""}`}
    >
      <LightCard device={device} pending={pending} />
    </div>
  );
}

type LightCardProps = {
  device: GharDevice;
  pending: boolean;
  /** The copy that follows the pointer while dragging. */
  ghost?: boolean;
};

/**
 * One device: its orb, name and state (level when on), and for a dimmable light a bar as
 * full as its brightness in its own color; a lit card picks up a tint of its light.
 */
function LightCard({ device, pending, ghost = false }: LightCardProps) {
  const lit = !pending && device.online && isSwitchable(device) && isOn(device);
  const color = lampColor(device);
  const level = lampLevel(device);
  const dimmable = device.capabilities.some((cap) => cap.capability === "dimmable");
  const state = !device.online
    ? "Offline"
    : pending
      ? "Switching…"
      : !isSwitchable(device)
        ? (productSubtitle(device) ?? "Device")
        : lit
          ? dimmable
            ? `On · ${Math.round(level * 100)}%`
            : "On"
          : "Off";
  return (
    <div
      aria-busy={pending}
      title={productSubtitle(device) ?? undefined}
      className={`light-card ${lit ? "light-card--lit" : ""} ${pending ? "light-card--pending" : ""} ${
        ghost ? "w-44 cursor-grabbing" : "w-full cursor-grab"
      } ${device.online ? "" : "opacity-50"}`}
      style={lit ? ({ "--lamp": color ?? PLAIN_LAMP } as CSSProperties) : undefined}
    >
      <LampOrb device={device} pending={pending} size="lg" />
      <div className="min-w-0">
        <p className="truncate text-[13px] leading-tight font-medium text-ink">{device.name}</p>
        <p className={`mt-0.5 truncate text-[11.5px] ${lit ? "text-sage-deep" : "text-ink-ghost"}`}>{state}</p>
      </div>
      {dimmable ? (
        <span aria-hidden className="light-card__level">
          <span style={{ width: `${lit ? Math.round(level * 100) : 0}%` }} />
        </span>
      ) : null}
    </div>
  );
}

function StatusNote({
  children,
  tone = "quiet",
}: {
  children: string;
  tone?: "quiet" | "error";
}) {
  return (
    <div className="flex h-full items-center justify-center px-3">
      <p className={`text-center text-[13px] ${tone === "error" ? "text-error" : "text-ink-ghost"}`}>
        {children}
      </p>
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

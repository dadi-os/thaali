/**
 * Device inspector: the device's family and name, where it is and what it is, its family's
 * controls, and what last happened to it and who did it. Values stay at the last confirmed
 * reading until Ghar accepts a command. Its sections settle in turn as it opens and new events
 * slide in at the top.
 */

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { ghar } from "../../../shared/api";
import type { GharCommand, GharDevice, GharEvent, GharRoom } from "../../../types/ghar";
import { Popover, type PopoverAnchor } from "../../../shared/components/Popover";
import { EASE, SLOW_S } from "../../../shared/lib/ux/motion";
import { POLL_MS } from "../../../shared/lib/ux/poll";
import { roomTitle, shownError } from "../commission";
import { familyOf } from "./families";
import { words } from "./families/kit";

/** How many recent events the inspector lists. */
const RECENT_EVENTS = 3;

/** Seconds between the inspector's sections settling as it opens. */
const SECTION_STAGGER_S = 0.05;

type SectionProps = {
  /** Place from the top, to settle in turn. */
  order: number;
  className: string;
  children: ReactNode;
};

/** One band of the inspector, rising into place a beat after the one above it. */
function Section({ order, className, children }: SectionProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: SLOW_S, ease: EASE, delay: 0.06 + order * SECTION_STAGGER_S }}
    >
      {children}
    </motion.div>
  );
}

export type DevicePopoverProps = {
  device: GharDevice;
  open: boolean;
  anchor: PopoverAnchor;
  containerRef: RefObject<HTMLElement | null>;
  /** A command for this device is in flight. Controls wait in gray. */
  pending: boolean;
  /** Every room, for moving the device. */
  rooms: GharRoom[];
  onClose: () => void;
  /** Pointer is on the panel or the gap to it, so a hover-close should wait. Fires on every move. */
  onHoverStart: () => void;
  /** Pointer left the panel and the gap to it. */
  onHoverEnd: () => void;
  onRename: (name: string) => void;
  onMove: (room: GharRoom) => void;
  onIdentify: () => void;
  send: (command: GharCommand) => void;
};

/** An event's new value in a few words. */
function eventWords(event: GharEvent): string {
  const value = event.new_value;
  if (event.attribute_key === "on" && typeof value === "boolean") {
    return value ? "Turned on" : "Turned off";
  }
  if (event.attribute_key === "locked" && typeof value === "boolean") {
    return value ? "Locked" : "Unlocked";
  }
  const key = words(event.attribute_key);
  if (typeof value === "boolean") {
    return `${key} ${value ? "yes" : "no"}`;
  }
  if (typeof value === "number") {
    return `${key} ${Math.round(value * 10) / 10}`;
  }
  if (typeof value === "string") {
    return `${key} ${words(value).toLowerCase()}`;
  }
  if (typeof value === "object" && value !== null && "action" in value && typeof value.action === "string") {
    return `${key}: ${words(value.action).toLowerCase()}`;
  }
  return key;
}

/** Who made a change, as the inspector says it. */
const CAUSE = { agent: "Agent", user: "You", external: "At the device" } as const;

/** "4m", "2h", "3d" since an event. */
function ago(at: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

/** Device detail panel. Uses the shared popover for position and dismiss. */
export function DevicePopover({
  device,
  open,
  anchor,
  containerRef,
  pending,
  rooms,
  onClose,
  onHoverStart,
  onHoverEnd,
  onRename,
  onMove,
  onIdentify,
  send,
}: DevicePopoverProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(device.name);
  const family = familyOf(device);
  const { Controls } = family;
  const battery = device.state.battery?.value;

  useEffect(() => {
    if (document.activeElement === nameRef.current) {
      return;
    }
    setName(device.name);
  }, [device.id, device.name]);

  const events = useQuery({
    queryKey: ["ghar", "events", device.id],
    queryFn: () => ghar.listDeviceEvents(device.id, RECENT_EVENTS),
    enabled: open,
    refetchInterval: open ? POLL_MS : false,
  });

  function commitName(): void {
    const trimmed = name.trim();
    if (!trimmed || trimmed === device.name) {
      setName(device.name);
      return;
    }
    onRename(trimmed);
  }

  return (
    <Popover
      open={open}
      onClose={onClose}
      anchor={anchor}
      containerRef={containerRef}
      aria-label={`${device.name} controls`}
      widthPx={312}
      contentKey={device.id}
      hover={{ onInside: onHoverStart, onOutside: onHoverEnd }}
    >
      <Section order={0} className="flex flex-col gap-1.5 border-b border-dashed border-sage-line/70 px-3.5 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium tracking-[0.16em] text-sage-deep uppercase">{family.label(device)}</span>
          <button type="button" onClick={onClose} className="text-[11px] tracking-wide text-ink-ghost hover:text-ink-muted">
            ESC
          </button>
        </div>
        <input
          ref={nameRef}
          value={name}
          aria-label={`Name of ${device.name}`}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setName(device.name);
              onClose();
            }
          }}
          className="w-full border-b border-sage-line bg-transparent pb-0.5 text-[15px] text-ink outline-none transition-colors duration-slow ease-dadi hover:border-sage focus:border-sage"
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-faint">
          {device.product_name ? <span>{device.product_name}</span> : null}
          {device.bridge_name ? <span>via {device.bridge_name}</span> : null}
          {typeof battery === "number" ? <span className="font-numeric">battery {Math.round(battery)}%</span> : null}
          {!device.online ? <span className="text-error">offline</span> : null}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <select
            aria-label="Room"
            value={device.room.id}
            onChange={(event) => {
              const room = rooms.find((item) => item.id === event.target.value);
              if (room) {
                onMove(room);
              }
            }}
            className="min-w-0 flex-1 rounded-[6px] border border-[var(--glass-border)] bg-transparent px-1.5 py-1 text-[12px] text-ink-muted"
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {roomTitle(room.name)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !device.online}
            onClick={onIdentify}
            className="rounded-full border border-dashed border-sage-line px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-sage-deep uppercase transition-[border-color,background-color] duration-slow ease-dadi hover:border-sage hover:bg-sage-active/50 disabled:cursor-default disabled:opacity-50"
          >
            Identify
          </button>
        </div>
      </Section>
      <Section order={1} className="px-3.5 py-3">
        <div className={`flex flex-col gap-3.5 transition-opacity duration-slow ease-dadi ${pending ? "opacity-60" : ""}`}>
          {!device.online ? (
            <p className="m-0 text-[11.5px] text-ink-ghost">
              Offline. Ghar shows its last reading and sends nothing until it is back.
            </p>
          ) : null}
          <Controls device={device} pending={pending} send={send} />
        </div>
      </Section>
      <Section order={2} className="flex flex-col gap-1.5 border-t border-dashed border-sage-line/70 px-3.5 pt-2.5 pb-3">
        <span className="text-[10px] font-medium tracking-[0.16em] text-ink-faint uppercase">Recent</span>
        {events.isError ? (
          <p className="m-0 text-[11.5px] text-error">{shownError(events.error)}</p>
        ) : !events.data ? (
          <span className="h-4 animate-pulse rounded bg-sage-fill/50" />
        ) : events.data.events.length === 0 ? (
          <p className="m-0 text-[11.5px] text-ink-ghost">Nothing has changed yet.</p>
        ) : (
          <AnimatePresence initial={false}>
            {events.data.events.map((event) => (
              <motion.div
                key={event.id}
                layout="position"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: SLOW_S, ease: EASE }}
                className="flex min-w-0 items-baseline gap-2 text-[12px] text-ink-muted"
              >
                <time className="w-7 shrink-0 font-numeric text-[10.5px] text-ink-faint">{ago(event.created_at)}</time>
                <span className="min-w-0 flex-1 truncate">{eventWords(event)}</span>
                <span
                  className={`shrink-0 rounded-full border px-1.5 text-[9.5px] tracking-[0.1em] uppercase ${
                    event.cause === "agent"
                      ? "border-sage-line bg-sage-faint text-sage-deep"
                      : event.cause === "external"
                        ? "border-[color-mix(in_srgb,var(--clay)_40%,transparent)] text-[var(--clay)]"
                        : "border-[var(--glass-border)] text-ink-faint"
                  }`}
                >
                  {CAUSE[event.cause]}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </Section>
    </Popover>
  );
}

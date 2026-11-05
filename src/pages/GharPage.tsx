import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../chrome/PageHeader";
import { Inspector, type InspectorPick } from "../features/ghar/Inspector";
import {
  allOff,
  countLights,
  evening,
  groupNames,
  isLight,
  isOn,
  levelCommand,
  roomSections,
  sectionLevelCommands,
  sectionSwitch,
  sectionsFor,
  switchCommand,
  UNASSIGNED_ROOM,
  type Filter,
} from "../features/ghar/model";
import { PairingSheet } from "../features/ghar/PairingSheet";
import { RoomSection, SECTION_SHUT, type SectionUi } from "../features/ghar/RoomSection";
import { useHouse } from "../features/ghar/useHouse";
import { ghar } from "../shared/api";
import { Button, ButtonGroup, Pill } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";
import { Icon } from "../shared/ui/Icon";
import { StaleBanner, StateView } from "../shared/states/ModuleState";
import { Skeleton } from "../shared/ui/Skeleton";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { useSize } from "../shared/hooks/useSize";
import { failureProps } from "../shared/lib/ux/moduleState";
import { formatRelative } from "../shared/lib/ux/time";
import type { GharCommand, GharDevice } from "../types/ghar";

/** The page is wider than this before the inspector sits beside the rooms; narrower, it is a drawer over them. */
const DOCK_ABOVE = 900;

/** How long the pairing sheet takes to leave, in ms. */
const LEAVE_MS = 200;

/** The room whose options are open and what they show. */
type OpenRoom = { id: string; ui: SectionUi } | null;

/** The page while Ghar answers: rooms of the loaded page's tile sizes, so nothing shifts when it arrives. */
function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 18 }}>
      {[0, 1].map((group) => (
        <div key={group} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Skeleton width={130} height={20} />
            <Skeleton width={44} height={28} radius={14} style={{ marginLeft: "auto" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
            {[0, 1, 2].map((tile) => (
              <div key={tile} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderRadius: 16, border: "1px solid var(--glass-border)", background: "var(--glass-veil)" }}>
                <Skeleton width={36} height={36} radius={12} />
                <Skeleton width="60%" height={15} />
                <Skeleton width="40%" height={12} />
                <Skeleton width="100%" height={6} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Ghar: the house as rooms of device tiles under the chips that filter them, with the selected device's inspector docked beside
 * them (a drawer over them when the page is narrow). A room opens its options from its name; a tile switches from its switch and
 * is chosen for the inspector from its name; the header's buttons switch everything off, set Evening and add a device. `?device=`
 * (from a toast) selects that device; `?room=` and `?group=` open the page filtered to a room or a group.
 */
export function GharPage() {
  const house = useHouse();
  const { connected, devicesQuery, roomsQuery } = house;
  const { state: connection } = useConnection();
  const location = useLocation();
  const [params] = useSearchParams();
  const [page, { width }] = useSize<HTMLDivElement>();
  const focusId = params.get("device");
  const [filter, setFilter] = useState<Filter>(() => (params.get("room") !== null ? { kind: "room", id: params.get("room") as string } : params.get("group") !== null ? { kind: "group", name: params.get("group") as string } : { kind: "everywhere" }));
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState<OpenRoom>(null);
  const [pick, setPick] = useState<InspectorPick>(null);
  const [renaming, setRenaming] = useState(false);
  const [newRoom, setNewRoom] = useState(false);
  const [pairing, setPairing] = useState<{ room: string } | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (focusId !== null) {
      setSelectedId(focusId);
      setClosed(false);
      setFilter({ kind: "everywhere" });
    }
  }, [focusId, location.key]);

  const devicesState = useModuleState(devicesQuery, (answer) => answer.devices.length === 0);
  const roomsState = useModuleState(roomsQuery, () => false);
  const failed = [devicesState, roomsState].find((state_) => state_.kind === "error" || state_.kind === "module-offline");
  const state = failed ?? (roomsState.kind === "loading" ? roomsState : devicesState);
  const retry = () => void [devicesQuery, roomsQuery].find((query) => query.isError)?.refetch();

  const devices = devicesQuery.data?.devices ?? [];
  const rooms = roomsQuery.data?.rooms ?? [];
  const groups = groupNames(devices);
  const everyRoom = roomSections(devices, rooms).filter((section) => section.kind !== "unassigned" || section.devices.length > 0);
  const shown: Filter =
    (filter.kind === "room" && !everyRoom.some((section) => section.room?.id === filter.id)) || (filter.kind === "group" && !groups.includes(filter.name)) ? { kind: "everywhere" } : filter;
  const sections = sectionsFor(shown, devices, rooms);
  const { lights, on } = countLights(devices);
  const docked = width > DOCK_ABOVE;
  const chosen = devices.find((device) => device.id === selectedId) ?? null;
  const inspected = closed ? null : docked ? (chosen ?? devices.find(isOn) ?? devices.find(isLight) ?? null) : chosen;
  const kept = state.kind === "ready" || state.kind === "empty";
  const disabled = !connected;

  const sheeted = inspected !== null && !docked;
  useEffect(() => {
    if (!sheeted) {
      return undefined;
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setClosed(true);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sheeted]);

  const select = (device: GharDevice) => {
    setSelectedId(device.id);
    setClosed(false);
    setPick(null);
    setRenaming(false);
  };
  const send = (device: GharDevice, command: GharCommand) => void house.run([{ id: device.id, command }]);
  const openPairing = (room: string) => {
    setLeaving(false);
    setPairing({ room });
  };
  const closePairing = () => {
    setLeaving(true);
    window.setTimeout(() => {
      setPairing(null);
      setLeaving(false);
    }, LEAVE_MS);
  };

  const createRoom = async (name: string) => {
    setNewRoom(false);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    const made = [] as Awaited<ReturnType<typeof ghar.createRoom>>[];
    const ok = await house.write(`Creating ${trimmed}`, async () => {
      made.push(await ghar.createRoom(trimmed));
    });
    if (ok && made[0]) {
      setFilter({ kind: "room", id: made[0].id });
    }
  };

  const removeRoom = async (id: string, name: string, inside: GharDevice[]) => {
    const unassigned = rooms.find((room) => room.name === UNASSIGNED_ROOM);
    setOpen(null);
    const ok = await house.write(`Deleting ${name}`, async () => {
      if (inside.length > 0) {
        if (!unassigned) {
          throw new Error("Ghar has no unassigned room to move this room's devices into");
        }
        for (const device of inside) {
          await ghar.moveDevice(device.id, unassigned.id);
        }
      }
      await ghar.deleteRoom(id);
    });
    if (ok) {
      setFilter({ kind: "everywhere" });
    }
  };

  let body;
  if (state.kind === "loading") {
    body = <Loading />;
  } else if (state.kind === "offline") {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="offline" title="dadi is unreachable" detail="Waiting for the mesh to reconnect" />
      </Card>
    );
  } else if (state.kind === "module-offline") {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="module-offline" title="Ghar isn’t answering" detail="The home service is down. The other modules still work." service={`${state.error.service}.dadi`} status={state.error.status} onRetry={retry} />
      </Card>
    );
  } else if (state.kind === "error") {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="error" title="Ghar failed to answer" {...failureProps(state.error)} onRetry={retry} />
      </Card>
    );
  } else if (state.kind === "empty") {
    body = (
      <Card style={{ flex: 1, minWidth: 0 }}>
        <StateView kind="empty" title="No devices yet" detail="Add a device and it appears here, in its room." />
      </Card>
    );
  } else {
    body = (
      <div className="scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 22, paddingRight: 4 }}>
        {sections.map((section) => {
          const roomId = section.room?.id ?? null;
          const ui = open !== null && open.id === roomId ? open.ui : SECTION_SHUT;
          const room = section.room;
          return (
            <RoomSection
              key={section.key}
              section={section}
              elsewhere={room === null ? [] : devices.filter((device) => device.room.id !== room.id)}
              ui={ui}
              onUi={(next) => setOpen(roomId !== null && next.open ? { id: roomId, ui: next } : null)}
              selectedId={inspected?.id ?? null}
              busy={house.pending}
              disabled={disabled}
              minTile={width < 800 ? 200 : 210}
              onToggle={(device, next) => send(device, switchCommand(next))}
              onLevel={(device, level) => send(device, levelCommand(level))}
              onSelect={select}
              onSwitch={() => void house.run(sectionSwitch(section.devices))}
              onSectionLevel={(level) => void house.run(sectionLevelCommands(section.devices, level))}
              onRename={(name) => {
                if (room !== null && name.trim().length > 0 && name.trim() !== room.name) {
                  void house.write(`Renaming ${room.name}`, () => ghar.renameRoom(room.id, name.trim()));
                }
              }}
              onMoveHere={(device) => room !== null && void house.write(`Moving ${device.name}`, () => ghar.moveDevice(device.id, room.id))}
              onAddHere={() => openPairing(room !== null && room.name !== UNASSIGNED_ROOM ? room.id : "")}
              onDelete={() => room !== null && void removeRoom(room.id, section.title, section.devices)}
            />
          );
        })}
      </div>
    );
  }

  const inspector =
    inspected === null ? null : (
      <Inspector
        device={inspected}
        rooms={rooms}
        groups={groups}
        width={360}
        pick={pick}
        onPick={setPick}
        renaming={renaming}
        onRenaming={setRenaming}
        disabled={disabled}
        onClose={() => setClosed(true)}
        onSend={(command) => send(inspected, command)}
        onRename={(name) => void house.write(`Renaming ${inspected.name}`, () => ghar.renameDevice(inspected.id, name))}
        onMove={(room) => void house.write(`Moving ${inspected.name}`, () => ghar.moveDevice(inspected.id, room.id))}
        onTags={(names) => void house.write(`Grouping ${inspected.name}`, () => ghar.setDeviceTags(inspected.id, names))}
        onIdentify={() => void house.write(`Identifying ${inspected.name}`, () => ghar.identify(inspected.id))}
      />
    );

  return (
    <div ref={page} data-page="ghar" style={{ display: "flex", alignItems: "stretch", flex: 1, minWidth: 0, gap: 16, padding: "18px 20px 20px", minHeight: 0, position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 14, minHeight: 0 }}>
        <PageHeader
          title="Ghar"
          meta={state.kind === "ready" ? (lights > 0 ? `${on} of ${lights} lights on` : "No lights yet") : undefined}
          trailing={
            kept ? (
              <ButtonGroup>
                <Button tone="outline" size="lg" disabled={disabled || on === 0} onClick={() => void house.run(allOff(devices))}>
                  All off
                </Button>
                <Button tone="outline" size="lg" disabled={disabled || lights === 0} onClick={() => void house.run(evening(devices))}>
                  Evening
                </Button>
                <Button tone="fill" size="lg" icon="plus" disabled={disabled} onClick={() => openPairing("")}>
                  Add device
                </Button>
              </ButtonGroup>
            ) : undefined
          }
        />
        {kept ? (
          <div role="toolbar" aria-label="Rooms and groups" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flex: "none" }}>
            <Pill active={shown.kind === "everywhere"} onClick={() => setFilter({ kind: "everywhere" })}>
              Everywhere
            </Pill>
            {everyRoom.map((section) => (
              <Pill key={section.key} active={shown.kind === "room" && shown.id === section.room?.id} onClick={() => section.room && setFilter({ kind: "room", id: section.room.id })}>
                {section.title}
              </Pill>
            ))}
            {groups.map((name) => (
              <Pill key={name} active={shown.kind === "group" && shown.name === name} onClick={() => setFilter({ kind: "group", name })}>
                <Icon name="grid" size={13} />
                {name}
              </Pill>
            ))}
            {newRoom ? (
              <div style={{ display: "flex", alignItems: "center", gap: 7, height: 32, width: 168, padding: "0 13px", borderRadius: 999, border: "1px dashed var(--sage-line)", color: "var(--sage-text)", flex: "none" }}>
                <Icon name="plus" size={13} />
                <input
                  className="cinp"
                  placeholder="Room name"
                  aria-label="New room name"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  style={{ fontSize: 13, color: "var(--ink)" }}
                  onBlur={(event) => void createRoom(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      event.currentTarget.value = "";
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                className="ui-trans ui-hover-fill"
                disabled={disabled}
                onClick={() => setNewRoom(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 13px", borderRadius: 999, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", border: "1px dashed var(--sage-line)", color: "var(--sage-text)", ...(disabled ? { opacity: 0.45 } : {}) }}
              >
                <Icon name="plus" size={13} />
                New room
              </button>
            )}
          </div>
        ) : null}
        {state.kind === "ready" && state.stale !== null && connection === "connected" ? <StaleBanner text={`Showing what Ghar reported ${formatRelative(new Date(state.stale.since).toISOString())}`} onRetry={retry} /> : null}
        {house.failure ? (
          <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--error)", flex: "none" }}>
            <span style={{ flex: 1, minWidth: 0 }}>{house.failure}</span>
            <Button tone="quiet" size="sm" onClick={house.dismiss}>
              Dismiss
            </Button>
          </div>
        ) : null}
        {body}
      </div>
      {docked ? inspector : null}
      {docked || inspector === null ? null : (
        <>
          <div onClick={() => setClosed(true)} style={{ position: "absolute", inset: 0, zIndex: 4 }} />
          <div style={{ position: "absolute", top: 18, right: 20, bottom: 20, display: "flex", zIndex: 5 }}>{inspector}</div>
        </>
      )}
      {pairing !== null ? (
        <PairingSheet
          rooms={rooms}
          devices={devices}
          startRoom={pairing.room}
          leaving={leaving}
          onClose={closePairing}
          onToggle={(device, next) => send(device, switchCommand(next))}
          onLevel={(device, level) => send(device, levelCommand(level))}
        />
      ) : null}
    </div>
  );
}

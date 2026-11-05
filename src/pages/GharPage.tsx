import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../shared/layout/shell/PageHeader";
import { deviceActions } from "../features/ghar/deviceActions";
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
import { Page } from "../shared/layout/Page";
import { ConfirmDialog } from "../shared/overlay/ConfirmDialog";
import { Button, ButtonGroup, Pill } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";
import { Icon } from "../shared/ui/Icon";
import { StaleBanner, StateView } from "../shared/states/ModuleState";
import { Skeleton } from "../shared/ui/Skeleton";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { useRetained } from "../shared/hooks/useRetained";
import { failureProps } from "../shared/lib/ux/moduleState";
import { formatRelative } from "../shared/lib/ux/time";
import type { GharCommand, GharDevice } from "../types/ghar";

/** The page is wider than this before the inspector sits beside the rooms; narrower, it is a drawer over them. */
const DOCK_ABOVE = 900;

/** The inspector's width in px. */
const INSPECTOR_WIDTH = 360;

/** The rooms' column is narrower than this before its device tiles shrink a little, in px. */
const NARROW_ROOMS = 520;

/** A room waiting on the answer to "delete it?", with what it holds. */
type DeletingRoom = { id: string; name: string; inside: GharDevice[] };

/** Tells the page whether the inspector is docked, which only the page's frame knows; it draws nothing. */
function ReportDocked({ docked, onChange }: { docked: boolean; onChange: (docked: boolean) => void }) {
  useEffect(() => onChange(docked), [docked, onChange]);
  return null;
}

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
  const focusId = params.get("device");
  const [filter, setFilter] = useState<Filter>(() => (params.get("room") !== null ? { kind: "room", id: params.get("room") as string } : params.get("group") !== null ? { kind: "group", name: params.get("group") as string } : { kind: "everywhere" }));
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [closed, setClosed] = useState(false);
  const [open, setOpen] = useState<OpenRoom>(null);
  const [pick, setPick] = useState<InspectorPick>(null);
  const [renaming, setRenaming] = useState(false);
  const [newRoom, setNewRoom] = useState(false);
  const [pairing, setPairing] = useState<{ room: string; run: number } | null>(null);
  const [deleting, setDeleting] = useState<DeletingRoom | null>(null);
  const [docked, setDocked] = useState(false);

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
  const chosen = devices.find((device) => device.id === selectedId) ?? null;
  const inspected = closed ? null : docked ? (chosen ?? devices.find(isOn) ?? devices.find(isLight) ?? null) : chosen;
  const kept = state.kind === "ready" || state.kind === "empty";
  const disabled = !connected;

  const select = (device: GharDevice) => {
    setSelectedId(device.id);
    setClosed(false);
    setPick(null);
    setRenaming(false);
  };
  const send = (device: GharDevice, command: GharCommand) => void house.run([{ id: device.id, command }]);
  const openPairing = (room: string) => setPairing((current) => ({ room, run: (current?.run ?? 0) + 1 }));
  const actionsFor = (device: GharDevice) =>
    deviceActions(device, {
      rooms,
      disabled,
      onToggle: (on) => send(device, switchCommand(on)),
      onIdentify: () => void house.write(`Identifying ${device.name}`, () => ghar.identify(device.id)),
      onRename: () => {
        select(device);
        setRenaming(true);
      },
      onMove: (room) => void house.write(`Moving ${device.name}`, () => ghar.moveDevice(device.id, room.id)),
      onInspect: () => select(device),
    });

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
    setDeleting(null);
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

  const renderBody = (narrow: boolean) => {
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
                minTile={narrow ? 200 : 210}
                onToggle={(device, next) => send(device, switchCommand(next))}
                onLevel={(device, level) => send(device, levelCommand(level))}
                onSelect={select}
                deviceActions={actionsFor}
                onSwitch={() => void house.run(sectionSwitch(section.devices))}
                onSectionLevel={(level) => void house.run(sectionLevelCommands(section.devices, level))}
                onRename={(name) => {
                  if (room !== null && name.trim().length > 0 && name.trim() !== room.name) {
                    void house.write(`Renaming ${room.name}`, () => ghar.renameRoom(room.id, name.trim()));
                  }
                }}
                onMoveHere={(device) => room !== null && void house.write(`Moving ${device.name}`, () => ghar.moveDevice(device.id, room.id))}
                onAddHere={() => openPairing(room !== null && room.name !== UNASSIGNED_ROOM ? room.id : "")}
                onDelete={() => room !== null && setDeleting({ id: room.id, name: section.title, inside: section.devices })}
              />
            );
          })}
        </div>
      );
    }

    return body;
  };

  const shownInspector = useRetained(inspected);
  const inspector =
    shownInspector === null ? undefined : (
      <Inspector
        device={shownInspector}
        rooms={rooms}
        groups={groups}
        width={INSPECTOR_WIDTH}
        pick={pick}
        onPick={setPick}
        renaming={renaming}
        onRenaming={setRenaming}
        disabled={disabled}
        onClose={() => setClosed(true)}
        onSend={(command) => send(shownInspector, command)}
        onRename={(name) => void house.write(`Renaming ${shownInspector.name}`, () => ghar.renameDevice(shownInspector.id, name))}
        onMove={(room) => void house.write(`Moving ${shownInspector.name}`, () => ghar.moveDevice(shownInspector.id, room.id))}
        onTags={(names) => void house.write(`Grouping ${shownInspector.name}`, () => ghar.setDeviceTags(shownInspector.id, names))}
        onIdentify={() => void house.write(`Identifying ${shownInspector.name}`, () => ghar.identify(shownInspector.id))}
      />
    );
  const shownPairing = useRetained(pairing);
  const shownDeleting = useRetained(deleting);

  return (
    <Page name="ghar" aside={inspector} asideOpen={inspected !== null} onAsideClose={() => setClosed(true)} asideWidth={INSPECTOR_WIDTH} dockAbove={DOCK_ABOVE}>
      {(room) => (
        <>
          <ReportDocked docked={room.docked} onChange={setDocked} />
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
                <div className="pill" style={{ width: 168, border: "1px dashed var(--sage-line)", background: "transparent" }}>
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
                <Pill disabled={disabled} onClick={() => setNewRoom(true)} style={{ border: "1px dashed var(--sage-line)", background: "transparent" }}>
                  <Icon name="plus" size={13} />
                  New room
                </Pill>
              )}
            </div>
          ) : null}
          {state.kind === "ready" && state.stale !== null && connection === "connected" ? <StaleBanner text={`Showing what Ghar reported ${formatRelative(new Date(state.stale.since).toISOString())}`} onRetry={retry} /> : null}
          {house.failure ? (
            <div role="alert" data-selectable style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--error)", flex: "none" }}>
              <span style={{ flex: 1, minWidth: 0 }}>{house.failure}</span>
              <Button tone="quiet" size="sm" onClick={house.dismiss}>
                Dismiss
              </Button>
            </div>
          ) : null}
          {renderBody(room.width < NARROW_ROOMS)}
          {shownPairing === null ? null : (
            <PairingSheet
              key={shownPairing.run}
              open={pairing !== null}
              rooms={rooms}
              devices={devices}
              startRoom={shownPairing.room}
              onClose={() => setPairing(null)}
              onToggle={(device, next) => send(device, switchCommand(next))}
              onLevel={(device, level) => send(device, levelCommand(level))}
            />
          )}
          <ConfirmDialog
            open={deleting !== null}
            title={shownDeleting === null ? "" : `Delete ${shownDeleting.name}?`}
            detail={shownDeleting === null ? "" : shownDeleting.inside.length === 0 ? "The room is empty." : `Its ${shownDeleting.inside.length === 1 ? "device goes" : `${shownDeleting.inside.length} devices go`} to Unassigned.`}
            confirmLabel="Delete room"
            onCancel={() => setDeleting(null)}
            onConfirm={() => shownDeleting !== null && void removeRoom(shownDeleting.id, shownDeleting.name, shownDeleting.inside)}
          />
        </>
      )}
    </Page>
  );
}

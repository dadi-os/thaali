import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../shared/layout/shell/PageHeader";
import { deviceActions } from "../features/ghar/deviceActions";
import { Inspector } from "../features/ghar/Inspector";
import {
  allOff,
  countLights,
  devicesFor,
  evening,
  isLight,
  isOn,
  levelCommand,
  sectionLevelCommands,
  sectionSwitch,
  switchCommand,
  tagGroups,
  type Filter,
} from "../features/ghar/model";
import { PairingSheet } from "../features/ghar/PairingSheet";
import { SECTION_SHUT, TagSection, type SectionUi } from "../features/ghar/TagSection";
import { useHouse } from "../features/ghar/useHouse";
import { ghar } from "../shared/api";
import { Page } from "../shared/layout/Page";
import { ConfirmDialog } from "../shared/overlay/ConfirmDialog";
import { Button, ButtonGroup, Pill } from "../shared/ui/Button";
import { Card } from "../shared/ui/Card";
import { StaleBanner, StateView } from "../shared/states/ModuleState";
import { Skeleton } from "../shared/ui/Skeleton";
import { useConnection } from "../shared/hooks/useConnection";
import { useModuleState } from "../shared/hooks/useModuleState";
import { useRetained } from "../shared/hooks/useRetained";
import { failureProps } from "../shared/lib/ux/moduleState";
import { formatRelative } from "../shared/lib/ux/time";
import type { GharCommand, GharDevice, GharTag } from "../types/ghar";

/** The page is wider than this before the inspector sits beside the tags' devices; narrower, it is a drawer over them. */
const DOCK_ABOVE = 900;

/** The inspector's width in px. */
const INSPECTOR_WIDTH = 360;

/** The devices' column is narrower than this before its device tiles shrink a little, in px. */
const NARROW_TILES = 520;

/** A tag waiting on the answer to "delete it?", with how many devices carry it. */
type DeletingTag = { tag: GharTag; count: number };

/** Tells the page whether the inspector is docked, which only the page's frame knows; it draws nothing. */
function ReportDocked({ docked, onChange }: { docked: boolean; onChange: (docked: boolean) => void }) {
  useEffect(() => onChange(docked), [docked, onChange]);
  return null;
}

/** The page while Ghar answers: sections of the loaded page's tile sizes, so nothing shifts when it arrives. */
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
 * Ghar: the house browsed by tag. A row of chips (All, each tag with its device count) filters the device tiles; a tag's
 * view has a header with whole-tag controls (switch, brightness, rename, add devices, delete). A device is under every tag it
 * carries and shows them as chips; one with none carries no chip. The selected device's inspector docks beside the tiles (a
 * drawer over them when the page is narrow). A tile switches from its switch and is chosen for the inspector from its name; the
 * header's buttons switch everything off, set Evening and add a device. `?device=` (from a toast) selects that device; `?tag=`
 * opens the page filtered to a tag.
 */
export function GharPage() {
  const house = useHouse();
  const { connected, devicesQuery } = house;
  const { state: connection } = useConnection();
  const location = useLocation();
  const [params] = useSearchParams();
  const focusId = params.get("device");
  const [filter, setFilter] = useState<Filter>(() => (params.get("tag") !== null ? { kind: "tag", name: params.get("tag") as string } : { kind: "all" }));
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [closed, setClosed] = useState(false);
  const [ui, setUi] = useState<SectionUi>(SECTION_SHUT);
  const [renaming, setRenaming] = useState(false);
  const [pairing, setPairing] = useState<{ tag: string; run: number } | null>(null);
  const [deleting, setDeleting] = useState<DeletingTag | null>(null);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    if (focusId !== null) {
      setSelectedId(focusId);
      setClosed(false);
      setFilter({ kind: "all" });
    }
  }, [focusId, location.key]);

  const state = useModuleState(devicesQuery, (answer) => answer.devices.length === 0);
  const retry = () => void devicesQuery.refetch();

  const devices = devicesQuery.data?.devices ?? [];
  const groups = tagGroups(devices);
  const tagNames = groups.map((group) => group.tag.name);
  const shown: Filter = filter.kind === "tag" && !tagNames.includes(filter.name) ? { kind: "all" } : filter;
  const group = shown.kind === "tag" ? (groups.find((candidate) => candidate.tag.name === shown.name) ?? null) : null;
  const listed = devicesFor(shown, devices);
  const title = shown.kind === "tag" ? shown.name : "All devices";
  const { lights, on } = countLights(devices);
  const chosen = devices.find((device) => device.id === selectedId) ?? null;
  const inspected = closed ? null : docked ? (chosen ?? devices.find(isOn) ?? devices.find(isLight) ?? null) : chosen;
  const kept = state.kind === "ready" || state.kind === "empty";
  const disabled = !connected;

  const choose = (next: Filter) => {
    setFilter(next);
    setUi(SECTION_SHUT);
  };
  const select = (device: GharDevice) => {
    setSelectedId(device.id);
    setClosed(false);
    setRenaming(false);
  };
  const send = (device: GharDevice, command: GharCommand) => void house.run([{ id: device.id, command }]);
  const openPairing = (tag: string) => setPairing((current) => ({ tag, run: (current?.run ?? 0) + 1 }));
  const actionsFor = (device: GharDevice) =>
    deviceActions(device, {
      disabled,
      inTag: group?.tag.name,
      onToggle: (on) => send(device, switchCommand(on)),
      onIdentify: () => void house.write(`Identifying ${device.name}`, () => ghar.identify(device.id)),
      onRename: () => {
        select(device);
        setRenaming(true);
      },
      onRemoveFromTag: () => group !== null && void house.write(`Removing ${device.name} from ${group.tag.name}`, () => ghar.removeTagDevice(group.tag.id, device.id)),
      onInspect: () => select(device),
    });

  const renameTag = async (tag: GharTag, name: string) => {
    const trimmed = name.trim();
    if (trimmed.length > 0 && trimmed !== tag.name && (await house.write(`Renaming ${tag.name}`, () => ghar.renameTag(tag.id, trimmed)))) {
      setFilter({ kind: "tag", name: trimmed });
    }
  };

  const removeTag = async (tag: GharTag) => {
    setUi(SECTION_SHUT);
    setDeleting(null);
    if (await house.write(`Deleting ${tag.name}`, () => ghar.deleteTag(tag.id))) {
      setFilter({ kind: "all" });
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
          <StateView kind="empty" title="No devices yet" detail="Add a device and it appears here, under its tags." />
        </Card>
      );
    } else {
      body = (
        <div className="scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 22, paddingRight: 4 }}>
          <TagSection
            key={title}
            title={title}
            tag={group?.tag ?? null}
            devices={listed}
            elsewhere={group === null ? [] : devices.filter((device) => !device.tags.some((tag) => tag.id === group.tag.id))}
            ui={ui}
            onUi={setUi}
            selectedId={inspected?.id ?? null}
            busy={house.pending}
            disabled={disabled}
            minTile={narrow ? 200 : 210}
            onToggle={(device, next) => send(device, switchCommand(next))}
            onLevel={(device, level) => send(device, levelCommand(level))}
            onSelect={select}
            deviceActions={actionsFor}
            onSwitch={() => void house.run(sectionSwitch(listed))}
            onSectionLevel={(level) => void house.run(sectionLevelCommands(listed, level))}
            onRename={(name) => group !== null && void renameTag(group.tag, name)}
            onAddDevice={(device) => group !== null && void house.write(`Adding ${device.name} to ${group.tag.name}`, () => ghar.addTagDevices(group.tag.id, [device.id]))}
            onDelete={() => group !== null && setDeleting({ tag: group.tag, count: group.devices.length })}
          />
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
        tags={tagNames}
        width={INSPECTOR_WIDTH}
        renaming={renaming}
        onRenaming={setRenaming}
        disabled={disabled}
        onClose={() => setClosed(true)}
        onSend={(command) => send(shownInspector, command)}
        onRename={(name) => void house.write(`Renaming ${shownInspector.name}`, () => ghar.renameDevice(shownInspector.id, name))}
        onTags={(names) => void house.write(`Tagging ${shownInspector.name}`, () => ghar.setDeviceTags(shownInspector.id, names))}
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
                  <Button tone="fill" size="lg" icon="plus" disabled={disabled} onClick={() => openPairing(group?.tag.name ?? "")}>
                    Add device
                  </Button>
                </ButtonGroup>
              ) : undefined
            }
          />
          {kept && groups.length > 0 ? (
            <div role="toolbar" aria-label="Tags" className="overflow-x-auto" style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
              <Pill className="shrink-0" active={shown.kind === "all"} count={devices.length} onClick={() => choose({ kind: "all" })}>
                All
              </Pill>
              {groups.map((entry) => (
                <Pill key={entry.tag.id} className="shrink-0" active={shown.kind === "tag" && shown.name === entry.tag.name} count={entry.devices.length} onClick={() => choose({ kind: "tag", name: entry.tag.name })}>
                  {entry.tag.name}
                </Pill>
              ))}
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
          {renderBody(room.width < NARROW_TILES)}
          {shownPairing === null ? null : (
            <PairingSheet
              key={shownPairing.run}
              open={pairing !== null}
              known={tagNames}
              devices={devices}
              startTag={shownPairing.tag}
              onClose={() => setPairing(null)}
              onToggle={(device, next) => send(device, switchCommand(next))}
              onLevel={(device, level) => send(device, levelCommand(level))}
            />
          )}
          <ConfirmDialog
            open={deleting !== null}
            title={shownDeleting === null ? "" : `Delete ${shownDeleting.tag.name}?`}
            detail={shownDeleting === null ? "" : `It is removed from ${shownDeleting.count === 1 ? "its device" : `its ${shownDeleting.count} devices`}, which stay.`}
            confirmLabel="Delete tag"
            onCancel={() => setDeleting(null)}
            onConfirm={() => shownDeleting !== null && void removeTag(shownDeleting.tag)}
          />
        </>
      )}
    </Page>
  );
}

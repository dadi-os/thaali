/**
 * Doors and alarms: a lock's ring that opens its gap when unlocked, a contact's two leaves that
 * part, presence rings that breathe while someone is there, a drop that fills on a leak, and
 * halos that call out on smoke.
 */

import type { GharDevice } from "../../../../types/ghar";
import { Actions, bool, changedAt, Note, Readouts, since, str, words, type ControlsProps, type Family } from "./kit";

function RingForm() {
  return (
    <svg className="ghar-ring" viewBox="0 0 46 46" aria-hidden>
      <circle className="ghar-ring__band" cx="23" cy="23" r="15" />
      <circle className="ghar-ring__core" cx="23" cy="23" r="3.5" />
    </svg>
  );
}

function LeavesForm() {
  return (
    <span className="ghar-leaves">
      <i />
      <i />
    </span>
  );
}

function PresenceForm() {
  return (
    <span className="ghar-presence">
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}

function DropForm() {
  return (
    <>
      <svg className="ghar-drop" viewBox="0 0 30 40" aria-hidden>
        <path d="M15 2 C 15 2, 3 17, 3 26 a12 12 0 0 0 24 0 C 27 17, 15 2, 15 2 Z" />
      </svg>
      <span aria-hidden className="ghar-puddle" />
    </>
  );
}

function HaloForm() {
  return (
    <span className="ghar-halo">
      <i />
      <i />
    </span>
  );
}

/** What a leak, freeze or rain detector reports under its own key. */
function detected(device: GharDevice): boolean | null {
  return bool(device, device.kind === "freeze" ? "freeze" : device.kind === "rain" ? "rain" : "leak");
}

/** True while either alarm on a smoke and CO alarm is past normal. */
function alarming(device: GharDevice): boolean {
  const smoke = str(device, "smoke_state");
  const co = str(device, "co_state");
  return (smoke !== null && smoke !== "normal") || (co !== null && co !== "normal");
}

function LockControls({ device }: ControlsProps) {
  const locked = bool(device, "locked");
  const door = str(device, "door_state");
  const operation = device.state.lock_operation?.value;
  const last =
    typeof operation === "object" && operation !== null && "operation" in operation && "source" in operation
      ? `${words(String(operation.operation))} · ${words(String(operation.source))}`
      : null;
  return (
    <>
      <Readouts
        rows={[
          ["Lock", locked === null ? null : locked ? "Locked" : "Unlocked"],
          ["Door", door === null ? null : words(door)],
          ["Last", last],
        ]}
      />
      <Note>Lock and unlock it at the door; Ghar shows its state and who last used it.</Note>
    </>
  );
}

function ContactControls({ device }: ControlsProps) {
  const closed = bool(device, "contact");
  const at = changedAt(device, "contact");
  return (
    <Readouts
      rows={[
        ["Now", closed === null ? null : closed ? "Closed" : "Open"],
        ["For", at === null ? null : since(at)],
      ]}
    />
  );
}

function OccupancyControls({ device }: ControlsProps) {
  const occupied = bool(device, "occupancy");
  const at = changedAt(device, "occupancy");
  return (
    <Readouts
      rows={[
        ["Now", occupied === null ? null : occupied ? "Someone here" : "Clear"],
        [occupied ? "Since" : "Clear for", at === null ? null : since(at)],
      ]}
    />
  );
}

function LeakControls({ device }: ControlsProps) {
  const wet = detected(device);
  return <Readouts rows={[["Now", wet === null ? null : wet ? "Water detected" : "Dry"]]} />;
}

function SmokeControls({ device, pending, send }: ControlsProps) {
  const smoke = str(device, "smoke_state");
  const co = str(device, "co_state");
  return (
    <>
      <Readouts
        rows={[
          ["Smoke", smoke === null ? null : words(smoke)],
          ["CO", co === null ? null : words(co)],
          ["Self-test", bool(device, "testing") === true ? "Running" : null],
        ]}
      />
      <Actions
        disabled={pending || !device.online}
        actions={[{ label: "Run self-test", onPress: () => send({ capability: "alarm", command: "self_test" }) }]}
      />
    </>
  );
}

export const lock: Family = {
  label: () => "Door lock",
  Form: RingForm,
  reading: (device) => {
    const locked = bool(device, "locked");
    return locked === null ? "No reading yet" : locked ? "Locked" : "Unlocked";
  },
  tone: (device) => ({ on: bool(device, "locked") === true, alert: device.online && bool(device, "locked") === false }),
  primary: () => null,
  Controls: LockControls,
};

export const contact: Family = {
  label: () => "Contact sensor",
  Form: LeavesForm,
  reading: (device) => {
    const closed = bool(device, "contact");
    return closed === null ? "No reading yet" : closed ? "Closed" : "Open";
  },
  tone: (device) => ({ alert: device.online && bool(device, "contact") === false }),
  primary: () => null,
  Controls: ContactControls,
};

export const occupancy: Family = {
  label: () => "Occupancy sensor",
  Form: PresenceForm,
  reading: (device) => {
    const occupied = bool(device, "occupancy");
    const at = changedAt(device, "occupancy");
    if (occupied === null) {
      return "No reading yet";
    }
    return occupied ? "Someone here" : at ? `Clear ${since(at)}` : "Clear";
  },
  tone: (device) => ({ on: device.online && bool(device, "occupancy") === true }),
  primary: () => null,
  Controls: OccupancyControls,
};

export const leak: Family = {
  label: (device) => (device.kind === "freeze" ? "Freeze detector" : device.kind === "rain" ? "Rain sensor" : "Leak detector"),
  Form: DropForm,
  reading: (device) => {
    const wet = detected(device);
    if (wet === null) {
      return "No reading yet";
    }
    if (device.kind === "freeze") {
      return wet ? "Freezing" : "Above freezing";
    }
    if (device.kind === "rain") {
      return wet ? "Raining" : "Dry";
    }
    return wet ? "Leak" : "Dry";
  },
  tone: (device) => ({ danger: device.online && detected(device) === true && device.kind !== "rain" }),
  primary: () => null,
  Controls: LeakControls,
};

export const smoke: Family = {
  label: () => "Smoke and CO alarm",
  Form: HaloForm,
  reading: (device) => {
    const smokeState = str(device, "smoke_state");
    const co = str(device, "co_state");
    if (smokeState === null && co === null) {
      return "No reading yet";
    }
    if (smokeState !== null && smokeState !== "normal") {
      return `Smoke · ${words(smokeState)}`;
    }
    if (co !== null && co !== "normal") {
      return `CO · ${words(co)}`;
    }
    return "All clear";
  },
  tone: (device) => ({ danger: device.online && alarming(device) }),
  primary: () => null,
  Controls: SmokeControls,
};

/** Speakers, TVs and cameras: an equalizer as tall as the volume, a screen that lights, an iris privacy closes. */

import type { GharDevice } from "../../../../types/ghar";
import {
  Actions,
  bool,
  capability,
  choices,
  ChoiceRow,
  has,
  Note,
  num,
  PowerRow,
  Slider,
  str,
  vars,
  words,
  type ControlsProps,
  type Family,
} from "./kit";

/** Relative heights of the speaker's five bars. */
const BARS = [0.6, 1, 0.75, 0.9, 0.5];

/** Remote keys a TV's controls offer. */
const KEYS = [
  ["up", "Up"],
  ["down", "Down"],
  ["left", "Left"],
  ["right", "Right"],
  ["select", "OK"],
  ["back", "Back"],
] as const;

function EqForm() {
  return (
    <span className="ghar-eq">
      {BARS.map((height, n) => (
        <i key={n} style={vars({ "--h": height, "--n": n })} />
      ))}
    </span>
  );
}

function ScreenForm() {
  return <span className="ghar-screen" />;
}

function IrisForm() {
  return (
    <span className="ghar-iris">
      <span />
    </span>
  );
}

/** True while media plays. */
function playing(device: GharDevice): boolean {
  return str(device, "playback") === "playing";
}

/** True when a TV or speaker is on: playing, or its power on. */
function mediaOn(device: GharDevice): boolean {
  return playing(device) || device.state.on?.value === true;
}

function SpeakerControls({ device, pending, send }: ControlsProps) {
  const disabled = pending || !device.online;
  const play = playing(device);
  return (
    <>
      {capability(device, "media")?.playback === true ? (
        <Actions
          disabled={disabled}
          actions={[
            { label: "Previous", onPress: () => send({ capability: "media", command: "previous" }) },
            {
              label: play ? "Pause" : "Play",
              primary: true,
              onPress: () => send({ capability: "media", command: play ? "pause" : "play" }),
            },
            { label: "Next", onPress: () => send({ capability: "media", command: "next" }) },
          ]}
        />
      ) : null}
      {has(device, "level") ? (
        <Slider
          label="Volume"
          min={0}
          max={100}
          value={num(device, "volume")}
          format={(value) => `${Math.round(value)}%`}
          disabled={disabled}
          onCommit={(level) => send({ capability: "level", command: "move_to", params: { level: Math.round(level) } })}
        />
      ) : null}
    </>
  );
}

function TvControls(props: ControlsProps) {
  const { device, pending, send } = props;
  const disabled = pending || !device.online;
  const config = capability(device, "media");
  const inputs = choices(config, "inputs");
  const input = inputs.find((choice) => choice.label === str(device, "input"))?.id ?? null;
  return (
    <>
      {has(device, "on_off") ? (
        <PowerRow
          name={`${device.name} power`}
          on={device.state.on?.value === true}
          status={device.state.on?.value === true ? "On" : "Off"}
          disabled={disabled}
          onToggle={() => send({ capability: "on_off", command: "toggle" })}
        />
      ) : null}
      <ChoiceRow
        label="Input"
        options={inputs.map((choice) => ({ value: choice.id, label: choice.label }))}
        current={input}
        disabled={disabled}
        onPick={(index) => send({ capability: "media", command: "select_input", params: { index } })}
      />
      {config?.keypad === true ? (
        <Actions
          disabled={disabled}
          actions={KEYS.map(([key, label]) => ({
            label,
            onPress: () => send({ capability: "media", command: "send_key", params: { key } }),
          }))}
        />
      ) : null}
      <SpeakerControls {...props} />
    </>
  );
}

function CameraControls({ device, pending, send }: ControlsProps) {
  const privacy = bool(device, "privacy");
  const hard = bool(device, "hard_privacy");
  return (
    <>
      {has(device, "camera") ? (
        <PowerRow
          name="Privacy mode"
          on={privacy === true}
          status={privacy === true ? "Privacy on: not streaming or recording" : "Privacy off"}
          disabled={pending || !device.online || hard === true}
          onToggle={() => send({ capability: "camera", command: "set_privacy", params: { enabled: privacy !== true } })}
        />
      ) : null}
      {hard === true ? <Note>The camera's own privacy switch is on.</Note> : null}
      <Note>Live video is not in Ghar yet; it shows the camera's state and privacy.</Note>
    </>
  );
}

export const speaker: Family = {
  label: () => "Speaker",
  Form: EqForm,
  style: (device) => vars({ "--ghar-level": (num(device, "volume") ?? 0) / 100 }),
  reading: (device) => {
    const volume = num(device, "volume");
    const playback = str(device, "playback");
    if (playback === null) {
      return volume === null ? "No reading yet" : `${Math.round(volume)}%`;
    }
    return volume === null ? words(playback) : `${words(playback)} · ${Math.round(volume)}%`;
  },
  tone: (device) => ({ on: device.online && playing(device) }),
  primary: (device) =>
    capability(device, "media")?.playback === true ? { capability: "media", command: playing(device) ? "pause" : "play" } : null,
  Controls: SpeakerControls,
};

export const tv: Family = {
  label: () => "TV",
  Form: ScreenForm,
  reading: (device) => {
    if (!mediaOn(device)) {
      return "Off";
    }
    return str(device, "input") ?? str(device, "app") ?? "On";
  },
  tone: (device) => ({ on: device.online && mediaOn(device) }),
  primary: (device) => (has(device, "on_off") ? { capability: "on_off", command: "toggle" } : null),
  Controls: TvControls,
};

export const camera: Family = {
  label: (device) => (device.kind === "doorbell" ? "Doorbell camera" : "Camera"),
  Form: IrisForm,
  reading: (device) => {
    const privacy = bool(device, "privacy") === true || bool(device, "hard_privacy") === true;
    return privacy ? "Privacy on" : "Watching";
  },
  tone: (device) => ({
    on: device.online && bool(device, "privacy") !== true && bool(device, "hard_privacy") !== true,
  }),
  primary: () => null,
  Controls: CameraControls,
};

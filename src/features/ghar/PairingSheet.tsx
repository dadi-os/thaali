import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ghar, isMeshOnline } from "../../shared/api";
import { GHAR_DEVICES_KEY } from "../../shared/api/ghar";
import { isTauriRuntime } from "../../shared/api/runtime";
import { Button, ButtonGroup } from "../../shared/components/Button";
import { Icon } from "../../shared/components/Icon";
import { Segmented } from "../../shared/components/Segmented";
import { Skeleton } from "../../shared/components/Skeleton";
import { useConnection } from "../../shared/hooks/useConnection";
import type { GharDevice, GharRoom } from "../../types/ghar";
import { DeviceTile } from "./DeviceTile";
import { UNASSIGNED_ROOM } from "./model";
import { startDeviceRadio } from "./radio";
import { shownError } from "./useHouse";

/** How the sheet and its scrim ease in, and out when it leaves. */
const EASE_IN = "320ms cubic-bezier(.22,.61,.36,1)";
const EASE_OUT = "200ms cubic-bezier(.22,.61,.36,1)";

/** How the device reaches Ghar: over the network, or through this computer's Bluetooth radio. */
type RadioMode = "network" | "nearby";

const RADIO_LABEL = { network: "On the network", nearby: "This computer" } as const satisfies Record<RadioMode, string>;
const RADIOS = [RADIO_LABEL.network, RADIO_LABEL.nearby] as const;

/** Where pairing is: the code form, Ghar looking for the device, Ghar joining it, the device landed, or a failure. */
export type PairingStep = "code" | "seek" | "pair" | "done" | "failed";

const TITLE = { code: "Add a device", seek: "Looking for the device", pair: "Pairing", done: "Paired", failed: "Pairing failed" } as const satisfies Record<PairingStep, string>;

export type PairingViewProps = {
  step: PairingStep;
  radio: RadioMode;
  onRadio: (radio: RadioMode) => void;
  code: string;
  onCode: (code: string) => void;
  ssid: string;
  onSsid: (ssid: string) => void;
  password: string;
  onPassword: (password: string) => void;
  /** What the radio is doing, when it is the computer's. */
  radioNote: string;
  /** The room id the device lands in; empty is Unassigned. */
  room: string;
  onRoom: (room: string) => void;
  /** The named rooms to choose from. */
  rooms: GharRoom[];
  /** The devices the job made, once they are in Ghar's list. */
  landed: GharDevice[];
  /** The name of the room the device landed in. */
  landedIn: string;
  /** Why pairing failed. */
  failure: string;
  /** The code form can be sent. */
  canSubmit: boolean;
  /** Leaves with its exit animation. */
  leaving: boolean;
  onSubmit: () => void;
  onRetry: () => void;
  onClose: () => void;
  onToggle: (device: GharDevice, on: boolean) => void;
  onLevel: (device: GharDevice, level: number) => void;
};

/** A field's caps name over its control. */
function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="ui-label" style={{ fontSize: 10.5 }}>
        {name}
      </span>
      {children}
    </div>
  );
}

/** The bone box a field's text sits in. */
function Box({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 14px", borderRadius: 12, background: "var(--bone)", border: "1px solid var(--glass-border)" }}>{children}</div>;
}

/**
 * The pairing sheet over the Ghar page, one view per step: the setup code with how the device reaches Ghar and the room it lands in,
 * then a ring while Ghar looks for it and joins it, then the device itself, or what went wrong.
 */
export function PairingView({ step, radio, onRadio, code, onCode, ssid, onSsid, password, onPassword, radioNote, room, onRoom, rooms, landed, landedIn, failure, canSubmit, leaving, onSubmit, onRetry, onClose, onToggle, onLevel }: PairingViewProps) {
  const reached = step === "code" ? 0 : step === "seek" ? 1 : 2;
  const busy = step === "seek" || step === "pair";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a device"
      onClick={busy ? undefined : onClose}
      style={{ position: "absolute", inset: 0, background: "rgba(44,48,42,.22)", display: "flex", alignItems: "center", justifyContent: "center", animation: leaving ? `fade-out ${EASE_OUT} both` : `fade ${EASE_IN} both`, zIndex: 30 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", width: 440, maxWidth: "100%", padding: 22, gap: 16, borderRadius: 20, background: "var(--bone)", border: "1px solid var(--glass-border)", boxShadow: "var(--shadow-deep)", animation: leaving ? `slide-down ${EASE_OUT} both` : `slide-up ${EASE_IN} both` }}
      >
        <div aria-hidden="true" style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((index) => (
            <span key={index} style={{ flex: 1, height: 2, borderRadius: 2, background: index <= reached ? "var(--sage)" : "var(--rule)" }} />
          ))}
        </div>
        <span className="ui-label" style={{ fontSize: 11, color: "var(--sage-deep)" }}>
          {TITLE[step]}
        </span>
        {step === "code" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <span style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: "19px" }}>Use the 11-digit code or the QR text on the device or its box. Put the device in pairing mode first.</span>
            <Field name="Setup code">
              <Box>
                <input
                  className="cinp"
                  aria-label="Setup code"
                  placeholder="3497-011-2332"
                  value={code}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  style={{ fontSize: 17, letterSpacing: "0.12em", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}
                  onChange={(event) => onCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && canSubmit) {
                      onSubmit();
                    }
                  }}
                />
              </Box>
            </Field>
            <Field name="How it reaches Ghar">
              <div style={{ display: "flex" }}>
                <Segmented options={RADIOS} value={RADIO_LABEL[radio]} onChange={(label) => onRadio(label === RADIO_LABEL.nearby ? "nearby" : "network")} />
              </div>
            </Field>
            {radio === "nearby" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: "18px" }}>{radioNote}</span>
                <Box>
                  <input className="cinp" aria-label="Wi-Fi name" placeholder="Wi-Fi name" value={ssid} autoComplete="off" spellCheck={false} style={{ fontSize: 14.5, color: "var(--ink)" }} onChange={(event) => onSsid(event.target.value)} />
                </Box>
                <Box>
                  <input className="cinp" type="password" aria-label="Wi-Fi password" placeholder="Wi-Fi password" value={password} autoComplete="off" spellCheck={false} style={{ fontSize: 14.5, color: "var(--ink)" }} onChange={(event) => onPassword(event.target.value)} />
                </Box>
              </div>
            ) : null}
            <Field name="Room">
              <Box>
                <select className="cinp" aria-label="Room" value={room} style={{ fontSize: 14.5, color: "var(--ink)", appearance: "none" }} onChange={(event) => onRoom(event.target.value)}>
                  <option value="">Unassigned</option>
                  {rooms.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <Icon name="chevDown" size={14} />
              </Box>
            </Field>
          </div>
        ) : step === "done" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {landed.length === 0 ? (
                <Skeleton width={150} height={150} radius={16} />
              ) : (
                landed.map((device) => (
                  <div key={device.id} style={{ width: 150 }}>
                    <DeviceTile device={device} selected={false} busy={false} disabled={false} onToggle={(on) => onToggle(device, on)} onLevel={(level) => onLevel(device, level)} onSelect={onClose} />
                  </div>
                ))
              )}
            </div>
            <span style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: "19px" }}>{`In ${landedIn}. Move it to another room from its controls any time.`}</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div aria-hidden="true" style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <span
                style={{ width: step === "pair" ? 56 : 88, height: step === "pair" ? 56 : 88, borderRadius: "50%", border: `1.5px solid ${step === "failed" ? "var(--error-line)" : "var(--sage-line)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <span style={{ width: 14, height: 14, borderRadius: "50%", background: step === "failed" ? "var(--error)" : "var(--sage)", ...(busy ? { animation: "ui-pulse 1.6s ease-in-out infinite" } : {}) }} />
              </span>
            </div>
            <span style={{ fontSize: 13, color: step === "failed" ? "var(--error)" : "var(--ink-muted)", lineHeight: "19px" }}>
              {step === "seek" ? "Ghar is listening for a device with that code." : step === "pair" ? "Found it. Exchanging certificates and joining the house." : `${failure} Check the device is in pairing mode (power-cycle it if it was paired before) and try again.`}
            </span>
          </div>
        )}
        {step === "code" ? (
          <ButtonGroup justify="flex-end">
            <Button tone="quiet" size="xl" onClick={onClose}>
              Cancel
            </Button>
            <Button tone="fill" size="xl" disabled={!canSubmit} onClick={onSubmit}>
              Pair
            </Button>
          </ButtonGroup>
        ) : step === "failed" ? (
          <ButtonGroup justify="flex-end">
            <Button tone="quiet" size="xl" onClick={onRetry}>
              Try again
            </Button>
            <Button tone="fill" size="xl" onClick={onClose}>
              Close
            </Button>
          </ButtonGroup>
        ) : step === "done" ? (
          <ButtonGroup justify="flex-end">
            <Button tone="fill" size="xl" onClick={onClose}>
              Done
            </Button>
          </ButtonGroup>
        ) : null}
      </div>
    </div>
  );
}

export type PairingSheetProps = {
  /** Every room, so a device can land straight in one. */
  rooms: GharRoom[];
  /** Every device Ghar lists, to show the ones the job made. */
  devices: GharDevice[];
  /** The room the sheet opens on; empty for Unassigned. */
  startRoom: string;
  leaving: boolean;
  onClose: () => void;
  onToggle: (device: GharDevice, on: boolean) => void;
  onLevel: (device: GharDevice, level: number) => void;
};

/**
 * Pair a Matter device: its setup code, how it reaches Ghar and the room it lands in, then Ghar looks for it and joins it,
 * then the device itself. Pairing through this computer makes it the Bluetooth radio, so the Wi-Fi it joins is asked for too.
 */
export function PairingSheet({ rooms, devices, startRoom, leaving, onClose, onToggle, onLevel }: PairingSheetProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const queryClient = useQueryClient();
  const named = rooms.filter((room) => room.name !== UNASSIGNED_ROOM);
  const [code, setCode] = useState("");
  const [roomId, setRoomId] = useState(startRoom);
  const [radio, setRadio] = useState<RadioMode>("network");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [radioReady, setRadioReady] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setRadioReady(false);
    setRadioError(null);
    if (radio !== "nearby") {
      return undefined;
    }
    if (!isTauriRuntime()) {
      setRadioError("Bluetooth pairing needs the dadi desktop app on this computer.");
      return undefined;
    }
    if (!connected) {
      setRadioError("Ghar is offline.");
      return undefined;
    }
    const handle = startDeviceRadio(ghar, {
      onReady: () => {
        setRadioReady(true);
        setRadioError(null);
      },
      onError: (message) => {
        setRadioReady(false);
        setRadioError(message);
      },
    });
    return () => handle.stop();
  }, [radio, connected]);

  const jobQuery = useQuery({
    queryKey: ["ghar", "commission", jobId],
    queryFn: () => ghar.getCommission(jobId as string),
    enabled: connected && jobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "succeeded" || status === "failed" ? false : 400;
    },
  });
  const job = jobQuery.data ?? null;

  useEffect(() => {
    if (job?.status === "succeeded") {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
    }
  }, [job?.status, queryClient]);

  const running = pending || (job !== null && job.status !== "succeeded" && job.status !== "failed");
  const failure = job?.status === "failed" ? job.error : (submitError ?? (jobQuery.isError ? shownError(jobQuery.error) : null));
  const nearbyBlocked = radio === "nearby" && (!radioReady || ssid.trim().length === 0);
  const canSubmit = connected && code.trim().length > 0 && !running && !nearbyBlocked;
  const step: PairingStep = failure !== null ? "failed" : job?.status === "succeeded" ? "done" : job?.status === "commissioning" ? "pair" : jobId !== null || pending ? "seek" : "code";

  async function submit(): Promise<void> {
    if (!canSubmit) {
      return;
    }
    setSubmitError(null);
    setPending(true);
    try {
      const started = await ghar.startCommission({
        code: code.trim(),
        radio,
        ...(roomId !== "" ? { room_id: roomId } : {}),
        ...(radio === "nearby" ? { wifi: { ssid: ssid.trim(), password } } : {}),
      });
      setJobId(started.job_id);
    } catch (err) {
      setSubmitError(shownError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <PairingView
      step={step}
      radio={radio}
      onRadio={setRadio}
      code={code}
      onCode={setCode}
      ssid={ssid}
      onSsid={setSsid}
      password={password}
      onPassword={setPassword}
      radioNote={radioError ?? (radioReady ? "Hold this computer next to the device. The Wi-Fi password is sent once and not saved." : "Opening this computer's radio…")}
      room={roomId}
      onRoom={setRoomId}
      rooms={named}
      landed={devices.filter((device) => job?.device_ids?.includes(device.id))}
      landedIn={named.find((room) => room.id === roomId)?.name ?? "Unassigned"}
      failure={failure ?? ""}
      canSubmit={canSubmit}
      leaving={leaving}
      onSubmit={() => void submit()}
      onRetry={() => {
        setJobId(null);
        setSubmitError(null);
      }}
      onClose={onClose}
      onToggle={onToggle}
      onLevel={onLevel}
    />
  );
}

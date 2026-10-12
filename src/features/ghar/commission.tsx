/**
 * Pair a Matter device from a sheet over the Ghar page, and the room and error words the
 * house shares. Nearby pairing uses this computer as the Bluetooth radio.
 */

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ghar, isMeshOnline } from "../../shared/api";
import { GHAR_DEVICES_KEY } from "../../shared/api/ghar";
import { isTauriRuntime } from "../../shared/api/runtime";
import type { GharRoom } from "../../types/ghar";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { DeviceFace } from "./house/rooms";
import { startDeviceRadio } from "./radio";

type RadioMode = "network" | "nearby";

const caps = "text-[10px] font-medium tracking-[0.14em] text-ink-faint uppercase";

const field =
  "rounded-[var(--radius)] border border-dashed border-sage-line bg-[var(--glass-sheet)] px-3 py-2.5 text-ink outline-none transition-[border-color,background-color] duration-slow ease-dadi placeholder:text-ink-ghost hover:border-sage focus:border-sage disabled:cursor-default disabled:opacity-50";

/** Human label for a room. The seeded room is the unplaced pile. */
export function roomTitle(name: string): string {
  return name === "unassigned" ? "Unplaced" : name;
}

/** First sentence of a transport or Ghar error, for the sheet. */
export function shownError(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  const match = err.message.match(/"message":"((?:\\.|[^"\\])*)"/);
  if (!match?.[1]) {
    return err.message;
  }
  return match[1].replace(/\\"/g, '"');
}

export type PairingSheetProps = {
  /** Every room, so a device can land straight in one. */
  rooms: GharRoom[];
  onClose: () => void;
};

/**
 * Pair a Matter device: its setup code, how it reaches Ghar and the room it lands in, then
 * rings reaching out while Ghar looks for it and closing in while it pairs, then the device
 * itself. Nearby pairing makes this computer the Bluetooth radio.
 */
export function PairingSheet({ rooms, onClose }: PairingSheetProps) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const queryClient = useQueryClient();
  const named = rooms.filter((room) => room.name !== "unassigned");
  const [code, setCode] = useState("");
  /** The room picked for the device; empty lands it in Unplaced. */
  const [roomId, setRoomId] = useState("");
  const [radio, setRadio] = useState<RadioMode>("network");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [radioReady, setRadioReady] = useState(false);
  const [radioError, setRadioError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (radio !== "nearby") {
      setRadioReady(false);
      setRadioError(null);
      return;
    }
    if (!isTauriRuntime()) {
      setRadioReady(false);
      setRadioError("Bluetooth pairing needs the dadi desktop app on this computer.");
      return;
    }
    if (!connected) {
      setRadioReady(false);
      setRadioError("Ghar is offline.");
      return;
    }
    setRadioReady(false);
    setRadioError(null);
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
    return () => {
      handle.stop();
    };
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
  const devicesQuery = useQuery({
    queryKey: GHAR_DEVICES_KEY,
    queryFn: () => ghar.listDevices(),
    enabled: connected && jobQuery.data?.status === "succeeded",
  });

  useEffect(() => {
    if (jobQuery.data?.status === "succeeded") {
      void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
    }
  }, [jobQuery.data?.status, queryClient]);

  const job = jobQuery.data ?? null;
  const running = pending || (job !== null && job.status !== "succeeded" && job.status !== "failed");
  const failure = job?.status === "failed" ? job.error : (submitError ?? (jobQuery.isError ? shownError(jobQuery.error) : null));
  const nearbyBlocked = radio === "nearby" && (!radioReady || ssid.trim().length === 0);
  const canSubmit = connected && code.trim().length > 0 && !running && !nearbyBlocked;
  const step: "code" | "seek" | "pair" | "done" | "failed" =
    failure !== null
      ? "failed"
      : job?.status === "succeeded"
        ? "done"
        : job?.status === "commissioning"
          ? "pair"
          : jobId !== null || pending
            ? "seek"
            : "code";
  const landed = devicesQuery.data ? devicesQuery.data.devices.filter((device) => job?.device_ids?.includes(device.id)) : null;
  const landedIn = named.find((room) => room.id === roomId);

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

  function retry(): void {
    setJobId(null);
    setSubmitError(null);
  }

  const steps = step === "code" ? 0 : step === "seek" ? 1 : 2;
  return (
    <motion.div
      className="frost-scrim absolute inset-0 z-30 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      onClick={() => {
        if (!running) {
          onClose();
        }
      }}
    >
      <motion.div
        role="dialog"
        aria-label="Add a device"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: SLOW_S, ease: EASE }}
        className="glass-sheet flex w-[420px] max-w-full flex-col gap-4 rounded-[16px] px-[22px] pt-5 pb-[18px]"
      >
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-slow ease-dadi ${index <= steps ? "bg-sage" : "bg-rule"}`}
            />
          ))}
        </div>
        <h3 className="m-0 text-[11px] font-medium tracking-[0.2em] text-sage-deep uppercase">
          {step === "code"
            ? "Add a device"
            : step === "seek"
              ? "Looking for the device"
              : step === "pair"
                ? "Pairing"
                : step === "done"
                  ? "Paired"
                  : "Pairing failed"}
        </h3>
        <AnimatePresence mode="wait" initial={false}>
          {step === "code" ? (
            <motion.form
              key="code"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: SLOW_S, ease: EASE }}
              className="flex flex-col gap-3.5"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
                Use the 11-digit code or the QR text on the device or its box. Put the device in pairing mode first.
              </p>
              <label className="flex flex-col gap-1.5">
                <span className={caps}>Setup code</span>
                <input
                  value={code}
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="3497-011-2332"
                  onChange={(event) => setCode(event.target.value)}
                  className={`${field} font-numeric text-[17px] tracking-[0.12em]`}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className={caps}>How it reaches Ghar</span>
                <RadioGlider value={radio} disabled={false} onChange={setRadio} />
              </div>
              {radio === "nearby" ? (
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-[12px] text-ink-muted">
                    {radioError ??
                      (radioReady
                        ? "Hold this computer next to the device. The Wi-Fi password is sent once and not saved."
                        : "Opening this computer's radio…")}
                  </p>
                  <input
                    value={ssid}
                    placeholder="Wi-Fi name"
                    autoCapitalize="none"
                    autoCorrect="off"
                    onChange={(event) => setSsid(event.target.value)}
                    className={`${field} text-[13px]`}
                  />
                  <input
                    value={password}
                    type="password"
                    placeholder="Wi-Fi password"
                    autoComplete="off"
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${field} text-[13px]`}
                  />
                </div>
              ) : null}
              <label className="flex flex-col gap-1.5">
                <span className={caps}>Room</span>
                <select value={roomId} onChange={(event) => setRoomId(event.target.value)} className={`${field} text-[13px]`}>
                  <option value="">Unplaced</option>
                  {named.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={onClose} className="px-2 py-2 text-[12.5px] text-ink-muted hover:text-ink">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-full bg-sage-deep px-4 py-2 text-[12.5px] font-medium text-bone transition-opacity duration-slow ease-dadi hover:bg-sage disabled:cursor-default disabled:opacity-40"
                >
                  Pair
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="link"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: SLOW_S, ease: EASE }}
              className="flex flex-col gap-3.5"
            >
              {step === "done" ? (
                <div className="flex flex-wrap justify-center gap-2 py-2">
                  {devicesQuery.isError ? (
                    <p className="m-0 text-[12px] text-error">{shownError(devicesQuery.error)}</p>
                  ) : landed === null ? (
                    <span className="h-32 w-32 animate-pulse rounded-[var(--radius)] bg-sage-fill/50" />
                  ) : (
                    landed.map((device) => (
                      <div key={device.id} className="w-[132px]">
                        <DeviceFace device={device} pending={false} />
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div
                  aria-hidden
                  className={`ghar-seek ${step === "pair" ? "ghar-seek--pairing" : ""} ${step === "failed" ? "ghar-seek--failed" : ""}`}
                >
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
              )}
              <p className={`m-0 text-[13px] leading-relaxed ${step === "failed" ? "text-error" : "text-ink-muted"}`}>
                {step === "seek"
                  ? "Ghar is listening for a device with that code."
                  : step === "pair"
                    ? "Found it. Exchanging certificates and joining the house."
                    : step === "done"
                      ? `In ${landedIn ? landedIn.name : "Unplaced"}. Drag it to another room any time.`
                      : `${failure} Check the device is in pairing mode (power-cycle it if it was paired before) and try again.`}
              </p>
              {step === "failed" || step === "done" ? (
                <div className="flex items-center justify-end gap-2">
                  {step === "failed" ? (
                    <button type="button" onClick={retry} className="px-2 py-2 text-[12.5px] text-ink-muted hover:text-ink">
                      Try again
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full bg-sage-deep px-4 py-2 text-[12.5px] font-medium text-bone transition-opacity duration-slow ease-dadi hover:bg-sage"
                  >
                    {step === "done" ? "Done" : "Close"}
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/** Sliding track — same glider as log severity. */
function RadioGlider({
  value,
  disabled,
  onChange,
}: {
  value: RadioMode;
  disabled: boolean;
  onChange: (value: RadioMode) => void;
}) {
  const index = value === "network" ? 0 : 1;
  return (
    <div
      role="radiogroup"
      aria-label="Radio"
      className="relative grid grid-cols-2 rounded-full bg-sage-fill p-0.5"
    >
      <motion.div
        className="absolute inset-y-0.5 rounded-full bg-bone shadow-[var(--shadow)] ring-1 ring-sage-line/80"
        initial={false}
        animate={{
          left: `calc(${index} * 50% + 2px)`,
          width: "calc(50% - 4px)",
        }}
        transition={{ duration: SLOW_S, ease: EASE }}
      />
      {(
        [
          ["network", "On the network"],
          ["nearby", "This computer"],
        ] as const
      ).map(([mode, label]) => {
        const on = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={`relative z-10 px-2.5 py-1.5 text-[12px] tracking-wide transition-colors duration-slow ease-dadi ${
              on ? "text-sage-deep" : "text-ink-ghost hover:text-ink-muted"
            } disabled:cursor-default`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}


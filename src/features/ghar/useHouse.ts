import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ghar, isMeshOnline } from "../../shared/api";
import { GHAR_DEVICES_KEY, GHAR_ROOMS_KEY } from "../../shared/api/ghar";
import { useConnection } from "../../shared/hooks/useConnection";
import type { GharDevice } from "../../types/ghar";
import { shownError } from "./commission";
import { applyCommand, type DeviceCommand } from "./model";

/**
 * The house as the Ghar page and the home widget use it: devices and rooms under the shared
 * Ghar keys (kept live by Ghar's /changes stream), commands that run per device in order and
 * show their result as soon as Ghar accepts them, and writes whose failures surface as
 * `failure` until the next success or `dismiss`.
 */
export function useHouse() {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [failure, setFailure] = useState<string | null>(null);

  const devicesQuery = useQuery({
    queryKey: GHAR_DEVICES_KEY,
    queryFn: () => ghar.listDevices(),
    enabled: connected,
  });
  const roomsQuery = useQuery({
    queryKey: GHAR_ROOMS_KEY,
    queryFn: () => ghar.listRooms(),
    enabled: connected,
  });

  const accept = (id: string, command: DeviceCommand["command"]) => {
    queryClient.setQueryData<{ devices: GharDevice[] }>(GHAR_DEVICES_KEY, (current) =>
      current ? { devices: current.devices.map((device) => (device.id === id ? applyCommand(device, command) : device)) } : current,
    );
  };

  /** Sends each device its commands in order, every device at once; resolves when all have settled. */
  async function run(commands: DeviceCommand[]): Promise<void> {
    if (commands.length === 0) {
      return;
    }
    const byDevice = new Map<string, DeviceCommand["command"][]>();
    for (const { id, command } of commands) {
      byDevice.set(id, [...(byDevice.get(id) ?? []), command]);
    }
    const ids = [...byDevice.keys()];
    setPending((current) => new Set([...current, ...ids]));
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        for (const command of byDevice.get(id)!) {
          await ghar.command(id, command);
          accept(id, command);
        }
      }),
    );
    setPending((current) => new Set([...current].filter((id) => !byDevice.has(id))));
    const names = new Map(devicesQuery.data?.devices.map((device) => [device.id, device.name]));
    const failed = results.flatMap((result, index) =>
      result.status === "rejected" ? [`${names.get(ids[index]!) ?? "A device"}: ${shownError(result.reason)}`] : [],
    );
    setFailure(failed.length > 0 ? failed.join(" · ") : null);
    void queryClient.invalidateQueries({ queryKey: GHAR_DEVICES_KEY });
  }

  /** Runs one registry write (a rename, a move, rooms, groups); true when Ghar accepted it. */
  async function write(label: string, action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      setFailure(null);
      return true;
    } catch (err) {
      setFailure(`${label}: ${shownError(err)}`);
      return false;
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["ghar"] });
    }
  }

  return {
    connected,
    devicesQuery,
    roomsQuery,
    pending,
    failure,
    dismiss: () => setFailure(null),
    run,
    write,
  };
}

/** What {@link useHouse} returns. */
export type House = ReturnType<typeof useHouse>;

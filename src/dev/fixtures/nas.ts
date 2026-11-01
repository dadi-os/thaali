import type { HeadscalePublishStatus, NasLogEntry, NasStatus } from "../../shared/api/nas";
import type { Scenario } from "../scenario";
import { ago, DAY, HOUR, MIN } from "./time";

const SERVICES = ["chaavi", "dwar", "ghar", "hath", "nas", "yaad"] as const;

const GB = 1_000_000_000;

/** Nas `GET /status`; in `module-offline` three modules are down and say why. */
export function status(scenario: Scenario): NasStatus {
  const down: readonly string[] = scenario === "module-offline" ? ["ghar", "yaad", "chaavi"] : [];
  return {
    uptime_seconds: 11 * 86_400 + 4 * 3600,
    services: SERVICES.map((name) => ({ name, healthy: !down.includes(name) })),
    disk: { free_bytes: 211 * GB, total_bytes: 248 * GB, used_percent: 14.9 },
    disks: [
      { name: "nvme0n1", model: "KINGSTON RBUSNS8154P3256GJ3", transport: "nvme", mount: "/sysroot", free_bytes: 211 * GB, total_bytes: 248 * GB, used_percent: 14.9 },
      { name: "sda", model: "ST1000LM035-1RK172", transport: "sata", mount: "/var/home", free_bytes: 904 * GB, total_bytes: 983 * GB, used_percent: scenario === "many" ? 91.3 : 8.0 },
    ],
    cpu: { name: "AMD Ryzen 7 3750H with Radeon Vega Mobile Gfx", used_percent: scenario === "many" ? 83.4 : 6.2 },
    memory: { name: "System memory", used_bytes: 26.8 * GB, total_bytes: 33.5 * GB, used_percent: 80.1 },
    gpu: [{ name: "AMD Radeon Vega Mobile", used_percent: 3 }],
    errors: down.map((name) => `${name}: health check failed: connection refused`),
  };
}

/** Nas `GET /logs/services`. */
export function logServices(): string[] {
  return [...SERVICES];
}

const MESSAGES: Array<[NasLogEntry["level"], string]> = [
  ["info", "request"],
  ["info", "wake finished"],
  ["info", "lane started"],
  ["warn", "slow response from dwar: 4.2s"],
  ["error", "lane_failed: dwar returned 529 overloaded"],
  ["info", "ingest applied 3 operations"],
  ["debug", "poll"],
  ["error", "helper task task/browser/3f2a91 closed with an unfinished job"],
];

/** Nas `GET /logs`: a spread of services and levels, newest first. */
export function logEntries(scenario: Scenario): NasLogEntry[] {
  if (scenario === "empty") {
    return [];
  }
  return Array.from({ length: 160 }, (_, i): NasLogEntry => {
    const service = SERVICES[i % SERVICES.length]!;
    const [level, msg] = MESSAGES[i % MESSAGES.length]!;
    const time = ago(i * 47_000 + 12_000);
    const long = scenario === "long" && i % 9 === 0;
    const text = long ? `${msg}: ${"upstream said ".repeat(30)}` : msg;
    return {
      time,
      service,
      level,
      msg: text,
      raw: JSON.stringify({ level, msg: text, service, time, request_id: `req-${i.toString(16).padStart(8, "0")}` }),
    };
  });
}

/** Nas `GET /clients`: the devices on dadi. */
export function clients(): { clients: Array<{ node_name: string; online: boolean; pending: boolean; last_seen: string | null; ip_addresses: string[] }> } {
  return {
    clients: [
      { node_name: "mac", online: true, pending: false, last_seen: ago(2 * MIN), ip_addresses: ["100.64.0.8", "fd7a:115c:a1e0::8"] },
      { node_name: "os", online: true, pending: false, last_seen: null, ip_addresses: ["100.64.0.1", "fd7a:115c:a1e0::1"] },
      { node_name: "phone", online: false, pending: false, last_seen: ago(3 * HOUR), ip_addresses: ["100.64.0.5", "fd7a:115c:a1e0::5"] },
      { node_name: "ipad", online: false, pending: true, last_seen: ago(2 * DAY), ip_addresses: [] },
    ],
  };
}

/** Nas `GET /headscale/publish`. */
export function headscalePublish(): HeadscalePublishStatus {
  return { control_url: "https://dadi.example.test", hostname: "dadi.example.test" };
}

/** Nas `GET /terminals/:id/capture`: the tail of a pane. */
export function terminalCapture(): { output: string } {
  return {
    output: [
      "dadi@os:~/projects/thaali$ npm run build",
      "",
      "> thaali@0.0.0 build",
      "> tsc && vite build",
      "",
      "src/dev/fixtures/hath.ts(88,14): error TS2322: Type 'string' is not assignable to type 'TaskStatus'.",
      "",
      "dadi@os:~/projects/thaali$ ",
    ].join("\n"),
  };
}

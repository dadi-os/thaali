import type { ChaaviFolder, ChaaviHealth, ChaaviItem, ChaaviTotp } from "../../types/chaavi";
import type { Scenario } from "../scenario";
import { ago, DAY } from "./time";

const FOLDERS: ChaaviFolder[] = [
  { id: "f0000000-0000-4000-8000-000000000001", name: "Development" },
  { id: "f0000000-0000-4000-8000-000000000002", name: "Development/dadi" },
  { id: "f0000000-0000-4000-8000-000000000003", name: "Banking" },
  { id: "f0000000-0000-4000-8000-000000000004", name: "School" },
];

function id(n: number): string {
  return `c0000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
}

function login(n: number, name: string, host: string, extra: { folder?: number; totp?: boolean; passkey?: boolean; favorite?: boolean } = {}): ChaaviItem {
  return {
    id: id(n),
    name,
    type: "login",
    folderId: extra.folder === undefined ? null : FOLDERS[extra.folder]!.id,
    favorite: extra.favorite ?? false,
    hasNotes: false,
    fields: [],
    revisionDate: ago(n * DAY),
    login: {
      username: "ankur@example.test",
      uris: [{ uri: host, match: "default" }],
      hasPassword: true,
      hasTotp: extra.totp ?? false,
      passkeys: extra.passkey ? [{ rpId: host, userName: "ankur@example.test", creationDate: ago(40 * DAY) }] : [],
    },
  };
}

/** Chaavi `GET /v1/folders`. */
export function folders(scenario: Scenario): ChaaviFolder[] {
  return scenario === "empty" ? [] : FOLDERS;
}

/** Chaavi `GET /v1/items`. */
export function items(scenario: Scenario): ChaaviItem[] {
  if (scenario === "empty") {
    return [];
  }
  const base: ChaaviItem[] = [
    login(1, "Apple", "apple.com", { favorite: true }),
    login(2, "GitHub", "github.com", { folder: 0, totp: true, passkey: true, favorite: true }),
    login(3, "Northwind careers", "careers.northwind.example", { folder: 3 }),
    login(4, "Okta", "msu.okta.example", { folder: 3, passkey: true }),
    login(5, scenario === "long" ? "A login whose name is as long as the ones people paste in from a password manager export" : "Cloudflare", "dash.cloudflare.example", { folder: 1, totp: true }),
    {
      id: id(6),
      name: "Checking account",
      type: "bankAccount",
      folderId: FOLDERS[2]!.id,
      favorite: false,
      hasNotes: true,
      fields: [{ name: "Online banking", type: "text", value: "bank.example/login" }, { name: "Security answer", type: "hidden", hasValue: true }],
      revisionDate: ago(6 * DAY),
      bankAccount: { bankName: "Example Bank", nameOnAccount: "Ankur Desai", accountType: "checking", routingNumber: "000000000", branchNumber: null, swiftCode: null, bankContactPhone: null, hasAccountNumber: true, hasIban: false, hasPin: true },
    },
    { id: id(7), name: "Wi-Fi at home", type: "note", folderId: null, favorite: false, hasNotes: true, fields: [], revisionDate: ago(30 * DAY) },
  ];
  if (scenario !== "many") {
    return base;
  }
  return Array.from({ length: 120 }, (_, i) => login(100 + i, `Service ${i + 1}`, `service-${i + 1}.example.test`, { folder: i % 4 }));
}

/** Chaavi `GET /health`. */
export function health(): ChaaviHealth {
  return { status: "ok", vault: "ready" };
}

/** Chaavi `POST /v1/items/:id/totp`. */
export function totp(): ChaaviTotp {
  return { code: "482 913", period: 30, remaining: 19 };
}

/** Domains whose icon the fixture proxy has. */
const ICON_COLORS: Record<string, string> = { "apple.com": "#2c302a", "github.com": "#5c6b52" };

/** Chaavi `GET /icons/:domain/icon.png`: a plain coloured square for a known domain, and the generic icon (a different image, as the real proxy's) for any other. */
export function siteIcon(domain: string): Blob {
  const color = ICON_COLORS[domain];
  const svg = color === undefined ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" fill="#b9c9ab"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${color}"/><path d="M8 20l8-10 8 10z" fill="#fafaf7"/></svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}

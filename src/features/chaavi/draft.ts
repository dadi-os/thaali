/**
 * The vault page's pure logic: what each item type is called, search and folder scopes,
 * and the editor's draft of an item turned into Chaavi create and update bodies. Secrets in
 * a draft are sent only when the person typed them.
 */

import type {
  ChaaviCreateItem,
  ChaaviSecretField,
  ChaaviFieldInput,
  ChaaviFolder,
  ChaaviItem,
  ChaaviItemType,
  ChaaviLinkedTarget,
  ChaaviUpdateItem,
  ChaaviUriMatch,
} from "../../types/chaavi";
import { isWithin } from "./folders";

/** Display names per item type. */
export const TYPE_META: Record<ChaaviItemType, { one: string; many: string }> = {
  login: { one: "Login", many: "Logins" },
  note: { one: "Secure note", many: "Notes" },
  card: { one: "Card", many: "Cards" },
  identity: { one: "Identity", many: "Identities" },
  sshKey: { one: "SSH key", many: "SSH keys" },
  bankAccount: { one: "Bank account", many: "Bank accounts" },
  driversLicense: { one: "Driver's license", many: "Licenses" },
  passport: { one: "Passport", many: "Passports" },
};

/** Item types in ledger order. */
export const ITEM_TYPES: ChaaviItemType[] = ["login", "note", "card", "identity", "sshKey", "bankAccount", "driversLicense", "passport"];

/** The item types whose data is a flat set of named strings, each public or secret. */
export type FlatType = "bankAccount" | "driversLicense" | "passport";

/** True for a bank account, driver's license or passport. */
export function isFlatType(type: ChaaviItemType): type is FlatType {
  return type === "bankAccount" || type === "driversLicense" || type === "passport";
}

/**
 * The fields of each flat type with their labels: `text` are shown and edited as values,
 * `secret` are masked, revealed one at a time by the same name.
 */
export const FLAT_FIELDS: Record<
  FlatType,
  { text: Array<{ key: string; label: string }>; secret: Array<{ key: ChaaviSecretField; label: string }> }
> = {
  bankAccount: {
    text: [
      { key: "bankName", label: "Bank" },
      { key: "nameOnAccount", label: "Name on account" },
      { key: "accountType", label: "Account type" },
      { key: "routingNumber", label: "Routing number" },
      { key: "branchNumber", label: "Branch number" },
      { key: "swiftCode", label: "SWIFT / BIC" },
      { key: "bankContactPhone", label: "Bank phone" },
    ],
    secret: [
      { key: "accountNumber", label: "Account number" },
      { key: "iban", label: "IBAN" },
      { key: "pin", label: "PIN" },
    ],
  },
  driversLicense: {
    text: [
      { key: "firstName", label: "First name" },
      { key: "middleName", label: "Middle name" },
      { key: "lastName", label: "Last name" },
      { key: "dateOfBirth", label: "Date of birth" },
      { key: "licenseClass", label: "Class" },
      { key: "issuingState", label: "Issuing state" },
      { key: "issuingCountry", label: "Issuing country" },
      { key: "issuingAuthority", label: "Issuing authority" },
      { key: "issueDate", label: "Issued" },
      { key: "expirationDate", label: "Expires" },
    ],
    secret: [{ key: "licenseNumber", label: "License number" }],
  },
  passport: {
    text: [
      { key: "givenName", label: "Given name" },
      { key: "surname", label: "Surname" },
      { key: "dateOfBirth", label: "Date of birth" },
      { key: "sex", label: "Sex" },
      { key: "birthPlace", label: "Place of birth" },
      { key: "nationality", label: "Nationality" },
      { key: "passportType", label: "Type" },
      { key: "issuingCountry", label: "Issuing country" },
      { key: "issuingAuthority", label: "Issuing authority" },
      { key: "issueDate", label: "Issued" },
      { key: "expirationDate", label: "Expires" },
    ],
    secret: [
      { key: "passportNumber", label: "Passport number" },
      { key: "nationalIdentificationNumber", label: "National ID number" },
    ],
  },
};

/** A flat item's data object, read by field name. */
export function flatData(item: ChaaviItem): Record<string, string | boolean | null> | null {
  if (!isFlatType(item.type)) {
    return null;
  }
  return (item as unknown as Record<FlatType, Record<string, string | boolean | null>>)[item.type];
}

/** `has` + the field name with its first letter raised: `accountNumber` → `hasAccountNumber`. */
export function hasKey(field: string): string {
  return `has${field[0]!.toUpperCase()}${field.slice(1)}`;
}

/** Item properties a linked field may point at, by item type, with their labels. */
export const LINK_TARGETS: Record<ChaaviItemType, Array<{ id: ChaaviLinkedTarget; label: string }>> = {
  login: [
    { id: "username", label: "Username" },
    { id: "password", label: "Password" },
  ],
  card: [
    { id: "cardholderName", label: "Cardholder" },
    { id: "brand", label: "Brand" },
    { id: "number", label: "Number" },
    { id: "expMonth", label: "Expiry month" },
    { id: "expYear", label: "Expiry year" },
    { id: "code", label: "Security code" },
  ],
  identity: [
    { id: "fullName", label: "Full name" },
    { id: "firstName", label: "First name" },
    { id: "lastName", label: "Last name" },
    { id: "email", label: "Email" },
    { id: "phone", label: "Phone" },
    { id: "username", label: "Username" },
    { id: "address1", label: "Address 1" },
    { id: "city", label: "City" },
    { id: "state", label: "State" },
    { id: "postalCode", label: "Postal code" },
    { id: "country", label: "Country" },
    { id: "company", label: "Company" },
    { id: "ssn", label: "Social Security number" },
    { id: "passportNumber", label: "Passport number" },
    { id: "licenseNumber", label: "License number" },
  ],
  note: [],
  sshKey: [],
  bankAccount: [],
  driversLicense: [],
  passport: [],
};

/** How a login website is matched, with labels. */
export const URI_MATCHES: Array<{ id: ChaaviUriMatch; label: string }> = [
  { id: "default", label: "Default match" },
  { id: "domain", label: "Base domain" },
  { id: "host", label: "Host" },
  { id: "startsWith", label: "Starts with" },
  { id: "exact", label: "Exact" },
  { id: "regex", label: "Regular expression" },
  { id: "never", label: "Never" },
];

/** Which part of the vault the list shows. */
export type VaultScope =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "none" }
  | { kind: "folder"; path: string };

/** True when `item` belongs to `scope`; a folder scope takes its subfolders too. */
export function inScope(item: ChaaviItem, scope: VaultScope, folders: ChaaviFolder[]): boolean {
  if (scope.kind === "all") {
    return true;
  }
  if (scope.kind === "favorites") {
    return item.favorite;
  }
  if (scope.kind === "none") {
    return item.folderId === null;
  }
  const own = folders.find((folder) => folder.id === item.folderId);
  return own !== undefined && isWithin(own.name, scope.path);
}

/**
 * Items whose name, username, websites, card brand or holder, identity name or email, or
 * text fields contain `query`, ignoring case. An empty query keeps every item.
 */
export function searchItems(items: ChaaviItem[], query: string): ChaaviItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return items;
  }
  return items.filter((item) => searchText(item).some((text) => text.toLowerCase().includes(needle)));
}

/** The words search looks at for one item. */
function searchText(item: ChaaviItem): string[] {
  const out = [item.name];
  if (item.type === "login") {
    out.push(item.login.username ?? "", ...item.login.uris.map((entry) => entry.uri));
  }
  if (item.type === "card") {
    out.push(item.card.brand ?? "", item.card.cardholderName ?? "");
  }
  if (item.type === "identity") {
    out.push(fullName(item) ?? "", item.identity.email ?? "", item.identity.company ?? "");
  }
  const flat = flatData(item);
  if (flat !== null && isFlatType(item.type)) {
    for (const field of FLAT_FIELDS[item.type].text) {
      const value = flat[field.key];
      if (typeof value === "string") {
        out.push(value);
      }
    }
  }
  for (const field of item.fields) {
    out.push(field.name);
    if (field.type === "text") {
      out.push(field.value);
    }
  }
  return out;
}

/** An identity's first, middle and last name, or null when it has none. */
export function fullName(item: ChaaviItem): string | null {
  if (item.type !== "identity") {
    return null;
  }
  const parts = [item.identity.firstName, item.identity.middleName, item.identity.lastName].filter(
    (part): part is string => part !== null,
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Host of a website for a list row, or the text itself when it is not a URL. */
export function hostOf(uri: string): string {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(uri);
  return match ? match[1]! : uri;
}

/** One quiet line under an item's name in the list; never a secret. */
export function itemSubtitle(item: ChaaviItem): string {
  if (item.type === "login") {
    const parts = [item.login.username, item.login.uris[0] ? hostOf(item.login.uris[0].uri) : null];
    const shown = parts.filter((part): part is string => part !== null && part.length > 0);
    return shown.length > 0 ? shown.join(" · ") : "No username";
  }
  if (item.type === "card") {
    const parts = [item.card.brand, item.card.expMonth && item.card.expYear ? `${item.card.expMonth.padStart(2, "0")}/${item.card.expYear.slice(-2)}` : null];
    const shown = parts.filter((part): part is string => part !== null);
    return shown.length > 0 ? shown.join(" · ") : "Card";
  }
  if (item.type === "identity") {
    return [fullName(item), item.identity.email].filter((part): part is string => part !== null).join(" · ") || "Identity";
  }
  if (item.type === "sshKey") {
    return item.sshKey.keyFingerprint ?? "SSH key";
  }
  const flat = flatData(item);
  if (flat !== null) {
    const pick = (key: string) => (typeof flat[key] === "string" ? (flat[key] as string) : null);
    const parts =
      item.type === "bankAccount"
        ? [pick("bankName"), pick("accountType")]
        : item.type === "driversLicense"
          ? [[pick("firstName"), pick("lastName")].filter(Boolean).join(" ") || null, pick("issuingState")]
          : [[pick("givenName"), pick("surname")].filter(Boolean).join(" ") || null, pick("nationality")];
    const shown = parts.filter((part): part is string => part !== null);
    return shown.length > 0 ? shown.join(" · ") : TYPE_META[item.type].one;
  }
  const hidden = item.fields.filter((field) => field.type === "hidden").map((field) => field.name);
  return hidden.length > 0 ? `Hidden: ${hidden.join(", ")}` : "Secure note";
}

/** A secret in the editor. `dirty` is set when the person typed it; only then is it sent. */
export type SecretDraft = {
  value: string;
  dirty: boolean;
};

/** A custom field in the editor. */
export type FieldDraft = {
  /** Stable React key. */
  key: string;
  name: string;
  type: "text" | "hidden" | "boolean" | "linked";
  /** Text or hidden value. */
  value: SecretDraft;
  bool: boolean;
  linkedTo: ChaaviLinkedTarget | null;
  /** Name under which a hidden value is stored; null for a new field or one with no value. */
  storedAs: string | null;
};

/** The editor's working copy of an item of any type. */
export type ItemDraft = {
  type: ChaaviItemType;
  name: string;
  folderId: string | null;
  favorite: boolean;
  notes: SecretDraft;
  /** True when the stored item has notes the person has not revealed. */
  notesStored: boolean;
  fields: FieldDraft[];
  login: { username: string; password: SecretDraft; totp: SecretDraft; uris: Array<{ key: string; uri: string; match: ChaaviUriMatch }> };
  card: { cardholderName: string; brand: string; number: SecretDraft; expMonth: string; expYear: string; code: SecretDraft };
  identity: {
    title: string;
    firstName: string;
    middleName: string;
    lastName: string;
    address1: string;
    address2: string;
    address3: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    company: string;
    email: string;
    phone: string;
    username: string;
    ssn: SecretDraft;
    passportNumber: SecretDraft;
    licenseNumber: SecretDraft;
  };
  sshKey: { privateKey: SecretDraft; publicKey: string; keyFingerprint: string };
  /** Text fields of a bank account, driver's license or passport, by Bitwarden name. */
  flat: Record<string, string>;
  /** Secret fields of a bank account, driver's license or passport, by Bitwarden name. */
  flatSecrets: Record<string, SecretDraft>;
};

const clean = (): SecretDraft => ({ value: "", dirty: false });

let keySeq = 0;

/** A fresh React key for a draft row. */
export function draftKey(): string {
  keySeq += 1;
  return `k${keySeq}`;
}

/** An empty draft of `type` in `folderId`. */
export function emptyDraft(type: ChaaviItemType, folderId: string | null): ItemDraft {
  return {
    type,
    name: "",
    folderId,
    favorite: false,
    notes: clean(),
    notesStored: false,
    fields: [],
    login: { username: "", password: clean(), totp: clean(), uris: [] },
    card: { cardholderName: "", brand: "", number: clean(), expMonth: "", expYear: "", code: clean() },
    identity: {
      title: "",
      firstName: "",
      middleName: "",
      lastName: "",
      address1: "",
      address2: "",
      address3: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      company: "",
      email: "",
      phone: "",
      username: "",
      ssn: clean(),
      passportNumber: clean(),
      licenseNumber: clean(),
    },
    sshKey: { privateKey: clean(), publicKey: "", keyFingerprint: "" },
    flat: isFlatType(type) ? Object.fromEntries(FLAT_FIELDS[type].text.map((field) => [field.key, ""])) : {},
    flatSecrets: isFlatType(type) ? Object.fromEntries(FLAT_FIELDS[type].secret.map((field) => [field.key, clean()])) : {},
  };
}

/** Switch a new item's draft to `type`, keeping what it shares and fresh fields for the rest. */
export function retype(draft: ItemDraft, type: ChaaviItemType): ItemDraft {
  const fresh = emptyDraft(type, draft.folderId);
  return { ...draft, type, flat: fresh.flat, flatSecrets: fresh.flatSecrets };
}

/** The draft of an existing item: every public value, secrets blank and untouched. */
export function draftFromItem(item: ChaaviItem): ItemDraft {
  const draft = emptyDraft(item.type, item.folderId);
  draft.name = item.name;
  draft.favorite = item.favorite;
  draft.notesStored = item.hasNotes;
  draft.fields = item.fields.map((field) => ({
    key: draftKey(),
    name: field.name,
    type: field.type,
    value: { value: field.type === "text" ? field.value : "", dirty: false },
    bool: field.type === "boolean" ? field.value : false,
    linkedTo: field.type === "linked" ? field.linkedTo : null,
    storedAs: field.type === "hidden" && field.hasValue ? field.name : null,
  }));
  if (item.type === "login") {
    draft.login.username = item.login.username ?? "";
    draft.login.uris = item.login.uris.map((entry) => ({ key: draftKey(), uri: entry.uri, match: entry.match }));
  }
  if (item.type === "card") {
    draft.card.cardholderName = item.card.cardholderName ?? "";
    draft.card.brand = item.card.brand ?? "";
    draft.card.expMonth = item.card.expMonth ?? "";
    draft.card.expYear = item.card.expYear ?? "";
  }
  if (item.type === "identity") {
    for (const key of IDENTITY_TEXT) {
      draft.identity[key] = item.identity[key] ?? "";
    }
  }
  if (item.type === "sshKey") {
    draft.sshKey.publicKey = item.sshKey.publicKey ?? "";
    draft.sshKey.keyFingerprint = item.sshKey.keyFingerprint ?? "";
  }
  const flat = flatData(item);
  if (flat !== null && isFlatType(item.type)) {
    for (const field of FLAT_FIELDS[item.type].text) {
      const value = flat[field.key];
      draft.flat[field.key] = typeof value === "string" ? value : "";
    }
  }
  return draft;
}

const IDENTITY_TEXT = [
  "title",
  "firstName",
  "middleName",
  "lastName",
  "address1",
  "address2",
  "address3",
  "city",
  "state",
  "postalCode",
  "country",
  "company",
  "email",
  "phone",
  "username",
] as const;

const IDENTITY_SECRETS = ["ssn", "passportNumber", "licenseNumber"] as const;

/**
 * What stops the draft from saving, or null when it can: a name, field names that are
 * present and unique, a value for a new or renamed hidden field, and a link target.
 */
export function draftProblem(draft: ItemDraft): string | null {
  if (!draft.name.trim()) {
    return "Give the item a name.";
  }
  const names = new Set<string>();
  for (const field of draft.fields) {
    const name = field.name.trim();
    if (!name) {
      return "Every custom field needs a name.";
    }
    if (names.has(name)) {
      return `Two custom fields are named “${name}”.`;
    }
    names.add(name);
    if (field.type === "hidden" && !field.value.dirty && field.storedAs !== name) {
      return `Type a value for the hidden field “${name}”.`;
    }
    if (field.type === "linked" && field.linkedTo === null) {
      return `Choose what “${name}” links to.`;
    }
  }
  if (draft.type === "sshKey") {
    const given = [draft.sshKey.privateKey.dirty, draft.sshKey.publicKey.trim() !== "", draft.sshKey.keyFingerprint.trim() !== ""];
    if (given.some(Boolean) && !given.every(Boolean)) {
      return "Give the private key, public key and fingerprint together, or leave all three empty to generate a key.";
    }
  }
  return null;
}

/** Custom fields for a write: a hidden field the person did not retype keeps its stored value. */
function fieldInputs(draft: ItemDraft): ChaaviFieldInput[] {
  return draft.fields.map((field): ChaaviFieldInput => {
    const name = field.name.trim();
    if (field.type === "text") {
      return { name, type: "text", value: field.value.value };
    }
    if (field.type === "boolean") {
      return { name, type: "boolean", value: field.bool };
    }
    if (field.type === "linked") {
      if (field.linkedTo === null) {
        throw new Error(`linked field “${name}” has no target`);
      }
      return { name, type: "linked", linkedTo: field.linkedTo };
    }
    return field.value.dirty ? { name, type: "hidden", value: field.value.value } : { name, type: "hidden" };
  });
}

/** Body for `POST /v1/items`. Blank secrets are left out, so a login password or SSH key is generated. */
export function createBody(draft: ItemDraft): ChaaviCreateItem {
  const base = {
    name: draft.name.trim(),
    folderId: draft.folderId,
    favorite: draft.favorite,
    ...(draft.notes.value ? { notes: draft.notes.value } : {}),
    ...(draft.fields.length > 0 ? { fields: fieldInputs(draft) } : {}),
  };
  if (draft.type === "login") {
    const login = draft.login;
    return {
      ...base,
      type: "login",
      login: {
        ...(login.username.trim() ? { username: login.username.trim() } : {}),
        ...(login.password.value ? { password: login.password.value } : {}),
        ...(login.totp.value.trim() ? { totp: login.totp.value.trim() } : {}),
        uris: uriInputs(draft),
      },
    };
  }
  if (draft.type === "card") {
    const card = draft.card;
    return {
      ...base,
      type: "card",
      card: present({
        cardholderName: card.cardholderName.trim(),
        brand: card.brand.trim(),
        number: card.number.value.trim(),
        expMonth: card.expMonth.trim(),
        expYear: card.expYear.trim(),
        code: card.code.value.trim(),
      }),
    };
  }
  if (draft.type === "identity") {
    const identity: Record<string, string> = {};
    for (const key of IDENTITY_TEXT) {
      identity[key] = draft.identity[key].trim();
    }
    for (const key of IDENTITY_SECRETS) {
      identity[key] = draft.identity[key].value.trim();
    }
    return { ...base, type: "identity", identity: present(identity) };
  }
  if (draft.type === "sshKey") {
    const key = draft.sshKey;
    return key.privateKey.dirty
      ? {
          ...base,
          type: "sshKey",
          sshKey: { privateKey: key.privateKey.value, publicKey: key.publicKey.trim(), keyFingerprint: key.keyFingerprint.trim() },
        }
      : { ...base, type: "sshKey" };
  }
  if (isFlatType(draft.type)) {
    const values: Record<string, string> = {};
    for (const field of FLAT_FIELDS[draft.type].text) {
      values[field.key] = draft.flat[field.key]!.trim();
    }
    for (const field of FLAT_FIELDS[draft.type].secret) {
      values[field.key] = draft.flatSecrets[field.key]!.value.trim();
    }
    return { ...base, type: draft.type, [draft.type]: present(values) } as ChaaviCreateItem;
  }
  return { ...base, type: "note" };
}

/**
 * Body for `PATCH /v1/items/:id` with only what the person changed, or null when nothing
 * did. Secrets go only when typed; an emptied one is sent as "" and cleared.
 */
export function updateBody(item: ChaaviItem, draft: ItemDraft): ChaaviUpdateItem | null {
  const before = draftFromItem(item);
  const body: ChaaviUpdateItem = {};
  if (draft.name.trim() !== item.name) {
    body.name = draft.name.trim();
  }
  if (draft.folderId !== item.folderId) {
    body.folderId = draft.folderId;
  }
  if (draft.favorite !== item.favorite) {
    body.favorite = draft.favorite;
  }
  if (draft.notes.dirty) {
    body.notes = draft.notes.value;
  }
  if (fieldsChanged(before, draft)) {
    body.fields = fieldInputs(draft);
  }
  if (item.type === "login") {
    const login: NonNullable<ChaaviUpdateItem["login"]> = {};
    if (draft.login.username.trim() !== before.login.username) {
      login.username = draft.login.username.trim();
    }
    if (draft.login.password.dirty) {
      login.password = draft.login.password.value;
    }
    if (draft.login.totp.dirty) {
      login.totp = draft.login.totp.value.trim();
    }
    if (JSON.stringify(uriInputs(draft)) !== JSON.stringify(uriInputs(before))) {
      login.uris = uriInputs(draft);
    }
    if (Object.keys(login).length > 0) {
      body.login = login;
    }
  }
  if (item.type === "card") {
    const card: Record<string, string> = {};
    for (const key of ["cardholderName", "brand", "expMonth", "expYear"] as const) {
      if (draft.card[key].trim() !== before.card[key]) {
        card[key] = draft.card[key].trim();
      }
    }
    for (const key of ["number", "code"] as const) {
      if (draft.card[key].dirty) {
        card[key] = draft.card[key].value.trim();
      }
    }
    if (Object.keys(card).length > 0) {
      body.card = card;
    }
  }
  if (item.type === "identity") {
    const identity: Record<string, string> = {};
    for (const key of IDENTITY_TEXT) {
      if (draft.identity[key].trim() !== before.identity[key]) {
        identity[key] = draft.identity[key].trim();
      }
    }
    for (const key of IDENTITY_SECRETS) {
      if (draft.identity[key].dirty) {
        identity[key] = draft.identity[key].value.trim();
      }
    }
    if (Object.keys(identity).length > 0) {
      body.identity = identity;
    }
  }
  if (item.type === "sshKey") {
    const sshKey: Record<string, string> = {};
    if (draft.sshKey.privateKey.dirty) {
      sshKey.privateKey = draft.sshKey.privateKey.value;
    }
    if (draft.sshKey.publicKey.trim() !== before.sshKey.publicKey) {
      sshKey.publicKey = draft.sshKey.publicKey.trim();
    }
    if (draft.sshKey.keyFingerprint.trim() !== before.sshKey.keyFingerprint) {
      sshKey.keyFingerprint = draft.sshKey.keyFingerprint.trim();
    }
    if (Object.keys(sshKey).length > 0) {
      body.sshKey = sshKey;
    }
  }
  if (isFlatType(item.type)) {
    const values: Record<string, string> = {};
    for (const field of FLAT_FIELDS[item.type].text) {
      if (draft.flat[field.key]!.trim() !== before.flat[field.key]) {
        values[field.key] = draft.flat[field.key]!.trim();
      }
    }
    for (const field of FLAT_FIELDS[item.type].secret) {
      const secret = draft.flatSecrets[field.key]!;
      if (secret.dirty) {
        values[field.key] = secret.value.trim();
      }
    }
    if (Object.keys(values).length > 0) {
      body[item.type] = values;
    }
  }
  return Object.keys(body).length > 0 ? body : null;
}

/** True when the custom field list differs from the stored one in any way that is saved. */
function fieldsChanged(before: ItemDraft, draft: ItemDraft): boolean {
  if (draft.fields.some((field) => field.value.dirty)) {
    return true;
  }
  const shape = (fields: FieldDraft[]) =>
    JSON.stringify(fields.map((field) => [field.name.trim(), field.type, field.type === "text" ? field.value.value : "", field.bool, field.linkedTo]));
  return shape(before.fields) !== shape(draft.fields);
}

/** Login websites for a write, blanks left out. */
function uriInputs(draft: ItemDraft): Array<{ uri: string; match: ChaaviUriMatch }> {
  return draft.login.uris
    .map((entry) => ({ uri: entry.uri.trim(), match: entry.match }))
    .filter((entry) => entry.uri.length > 0);
}

/** Keep only the non-empty values, for a create body. */
function present(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.length > 0));
}

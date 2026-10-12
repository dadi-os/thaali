/** Chaavi `/v1` contract. An item never carries a secret value; reveals return one at a time. */

/** Every Bitwarden item type. */
export type ChaaviItemType = "login" | "note" | "card" | "identity" | "sshKey" | "bankAccount" | "driversLicense" | "passport";

/** How the Bitwarden extension matches a login website; `default` follows the account setting. */
export type ChaaviUriMatch = "default" | "domain" | "host" | "startsWith" | "exact" | "regex" | "never";

/** Item property a linked custom field points at. Valid targets depend on the item type. */
export type ChaaviLinkedTarget =
  | "username"
  | "password"
  | "cardholderName"
  | "expMonth"
  | "expYear"
  | "code"
  | "brand"
  | "number"
  | "title"
  | "firstName"
  | "middleName"
  | "lastName"
  | "fullName"
  | "address1"
  | "address2"
  | "address3"
  | "city"
  | "state"
  | "postalCode"
  | "country"
  | "company"
  | "email"
  | "phone"
  | "ssn"
  | "passportNumber"
  | "licenseNumber";

/** A custom field as listed: a hidden field only says whether it holds a value. */
export type ChaaviField =
  | { name: string; type: "text"; value: string }
  | { name: string; type: "hidden"; hasValue: boolean }
  | { name: string; type: "boolean"; value: boolean }
  | { name: string; type: "linked"; linkedTo: ChaaviLinkedTarget };

/** A custom field to write. A hidden field without `value` on update keeps its stored value. */
export type ChaaviFieldInput =
  | { name: string; type: "text"; value: string }
  | { name: string; type: "hidden"; value?: string }
  | { name: string; type: "boolean"; value: boolean }
  | { name: string; type: "linked"; linkedTo: ChaaviLinkedTarget };

/** A login website. */
export type ChaaviUri = {
  uri: string;
  match: ChaaviUriMatch;
};

/** A passkey on a login, without its key. */
export type ChaaviPasskeyInfo = {
  rpId: string;
  userName: string | null;
  creationDate: string | null;
};

/** Login fields that are not secret, plus which secrets it holds. */
export type ChaaviLogin = {
  username: string | null;
  uris: ChaaviUri[];
  hasPassword: boolean;
  hasTotp: boolean;
  passkeys: ChaaviPasskeyInfo[];
};

/** Card fields that are not secret, plus which secrets it holds. */
export type ChaaviCard = {
  cardholderName: string | null;
  brand: string | null;
  /** `1`–`12`. */
  expMonth: string | null;
  /** Four digits. */
  expYear: string | null;
  hasNumber: boolean;
  hasCode: boolean;
};

/** Identity fields that are not secret, plus which secrets it holds. */
export type ChaaviIdentity = {
  title: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  username: string | null;
  hasSsn: boolean;
  hasPassportNumber: boolean;
  hasLicenseNumber: boolean;
};

/** SSH key fields that are not secret. */
export type ChaaviSshKey = {
  publicKey: string | null;
  keyFingerprint: string | null;
  hasPrivateKey: boolean;
};

/** Bank account fields that are not secret, plus which secrets it holds. */
export type ChaaviBankAccount = {
  bankName: string | null;
  nameOnAccount: string | null;
  accountType: string | null;
  routingNumber: string | null;
  branchNumber: string | null;
  swiftCode: string | null;
  bankContactPhone: string | null;
  hasAccountNumber: boolean;
  hasPin: boolean;
  hasIban: boolean;
};

/** Driver's license fields that are not secret, plus which secrets it holds. */
export type ChaaviDriversLicense = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  issuingCountry: string | null;
  issuingState: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  issuingAuthority: string | null;
  licenseClass: string | null;
  hasLicenseNumber: boolean;
};

/** Passport fields that are not secret, plus which secrets it holds. */
export type ChaaviPassport = {
  surname: string | null;
  givenName: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  birthPlace: string | null;
  nationality: string | null;
  issuingCountry: string | null;
  passportType: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  hasPassportNumber: boolean;
  hasNationalIdentificationNumber: boolean;
};

type ChaaviItemBase = {
  /** Vault item id. */
  id: string;
  name: string;
  /** Null when the item is in no folder. */
  folderId: string | null;
  favorite: boolean;
  /** True when the notes hold text; the text is revealed on demand. */
  hasNotes: boolean;
  fields: ChaaviField[];
  /** ISO time of the last change. */
  revisionDate: string | null;
};

/** Catalog item from Chaavi `GET /v1/items`. */
export type ChaaviItem = ChaaviItemBase &
  (
    | { type: "login"; login: ChaaviLogin }
    | { type: "note" }
    | { type: "card"; card: ChaaviCard }
    | { type: "identity"; identity: ChaaviIdentity }
    | { type: "sshKey"; sshKey: ChaaviSshKey }
    | { type: "bankAccount"; bankAccount: ChaaviBankAccount }
    | { type: "driversLicense"; driversLicense: ChaaviDriversLicense }
    | { type: "passport"; passport: ChaaviPassport }
  );

/** A vault folder. */
export type ChaaviFolder = {
  id: string;
  name: string;
};

/** Login fields on write. On create, an omitted password is generated. */
export type ChaaviLoginInput = {
  username?: string;
  password?: string;
  totp?: string;
  uris?: Array<{ uri: string; match?: ChaaviUriMatch }>;
};

/** Card fields on write; empty clears. */
export type ChaaviCardInput = Partial<Record<"cardholderName" | "brand" | "number" | "expMonth" | "expYear" | "code", string>>;

/** Identity fields on write; empty clears. */
export type ChaaviIdentityInput = Partial<
  Record<Exclude<keyof ChaaviIdentity, "hasSsn" | "hasPassportNumber" | "hasLicenseNumber"> | "ssn" | "passportNumber" | "licenseNumber", string>
>;

/** SSH key fields on write: all three, or none on create to generate an Ed25519 key. */
export type ChaaviSshKeyInput = Partial<Record<"privateKey" | "publicKey" | "keyFingerprint", string>>;

/** Fields of a bank account, driver's license or passport on write; empty clears. */
export type ChaaviFlatInput = Record<string, string>;

type ChaaviCreateBase = {
  name: string;
  folderId?: string | null;
  favorite?: boolean;
  notes?: string;
  fields?: ChaaviFieldInput[];
};

/** Body for Chaavi `POST /v1/items`. */
export type ChaaviCreateItem = ChaaviCreateBase &
  (
    | { type: "login"; login?: ChaaviLoginInput }
    | { type: "note" }
    | { type: "card"; card?: ChaaviCardInput }
    | { type: "identity"; identity?: ChaaviIdentityInput }
    | { type: "sshKey"; sshKey?: ChaaviSshKeyInput }
    | { type: "bankAccount"; bankAccount?: ChaaviFlatInput }
    | { type: "driversLicense"; driversLicense?: ChaaviFlatInput }
    | { type: "passport"; passport?: ChaaviFlatInput }
  );

/**
 * Body for Chaavi `PATCH /v1/items/:id`: only given keys change, `fields` replaces the list,
 * `{ folderId }` alone moves the item.
 */
export type ChaaviUpdateItem = {
  name?: string;
  folderId?: string | null;
  favorite?: boolean;
  notes?: string;
  fields?: ChaaviFieldInput[];
  login?: ChaaviLoginInput;
  card?: ChaaviCardInput;
  identity?: ChaaviIdentityInput;
  sshKey?: ChaaviSshKeyInput;
  bankAccount?: ChaaviFlatInput;
  driversLicense?: ChaaviFlatInput;
  passport?: ChaaviFlatInput;
};

/** A secret an item can reveal. */
export type ChaaviSecretField =
  | "password"
  | "totp"
  | "number"
  | "code"
  | "ssn"
  | "passportNumber"
  | "licenseNumber"
  | "privateKey"
  | "accountNumber"
  | "pin"
  | "iban"
  | "nationalIdentificationNumber"
  | "notes";

/** Body for Chaavi `POST /v1/items/:id/reveal`. */
export type ChaaviReveal = { field: ChaaviSecretField } | { field: "custom"; name: string };

/** Current one-time code (`POST /v1/items/:id/totp`). */
export type ChaaviTotp = {
  code: string;
  period: number;
  remaining: number;
};

/** GET /health — process is up; vault may still be unconfigured. */
export type ChaaviHealth = {
  /** Process liveness string from Chaavi. */
  status: string;
  /** Whether a vault is configured on this node. */
  vault: "ready" | "unconfigured";
};

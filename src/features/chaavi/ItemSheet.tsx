import { useState, type ReactNode } from "react";
import { chaavi } from "../../shared/api";
import { Button, ButtonGroup, IconButton } from "../../shared/components/Button";
import { Icon } from "../../shared/components/Icon";
import { confirmOwner } from "../../shared/lib/platform/owner";
import { pushToast } from "../../store/toasts";
import type { ChaaviFolder, ChaaviItemType, ChaaviReveal } from "../../types/chaavi";
import {
  draftKey,
  draftProblem,
  FLAT_FIELDS,
  IDENTITY_SECRETS,
  IDENTITY_TEXT,
  isFlatType,
  LINK_TARGETS,
  retype,
  TYPE_META,
  URI_MATCHES,
  type FieldDraft,
  type ItemDraft,
  type SecretDraft,
} from "./draft";

/** How the sheet and its scrim ease in. */
const EASE_IN = "320ms cubic-bezier(.22,.61,.36,1)";

/** How they ease out; the page removes the sheet when it is over. */
const EASE_OUT = "200ms cubic-bezier(.22,.61,.36,1)";

/** The card brands a card's brand can be. */
const BRANDS = ["Visa", "Mastercard", "Amex", "Discover", "Diners Club", "JCB", "Maestro", "UnionPay", "RuPay", "Other"];

/** The months an expiry month can be, from 1. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** What an input on the sheet edits. A secret is sent only once it is typed, and `reveal` names how the stored one is read into it. */
type FormField =
  | { kind: "text"; label: string; get: (draft: ItemDraft) => string; set: (draft: ItemDraft, value: string) => void; date?: boolean; placeholder?: string; numeric?: boolean }
  | { kind: "secret"; label: string; get: (draft: ItemDraft) => SecretDraft; set: (draft: ItemDraft, value: SecretDraft) => void; reveal: ChaaviReveal; generate?: boolean; area?: boolean; placeholder?: string }
  | { kind: "choice"; label: string; options: Array<[string, string]>; get: (draft: ItemDraft) => string; set: (draft: ItemDraft, value: string) => void }
  | { kind: "websites" };

const text = (label: string, get: (draft: ItemDraft) => string, set: (draft: ItemDraft, value: string) => void, more: Partial<Extract<FormField, { kind: "text" }>> = {}): FormField => ({ kind: "text", label, get, set, ...more });
const secret = (label: string, get: (draft: ItemDraft) => SecretDraft, set: (draft: ItemDraft, value: SecretDraft) => void, reveal: ChaaviReveal, more: Partial<Extract<FormField, { kind: "secret" }>> = {}): Extract<FormField, { kind: "secret" }> => ({ kind: "secret", label, get, set, reveal, ...more });

/** The labels of an identity's text fields. */
const IDENTITY_LABELS: Record<(typeof IDENTITY_TEXT)[number], string> = {
  title: "Title",
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  address1: "Address",
  address2: "Address 2",
  address3: "Address 3",
  city: "City",
  state: "State",
  postalCode: "Postal code",
  country: "Country",
  company: "Company",
  email: "Email",
  phone: "Phone",
  username: "Username",
};

/** The labels of an identity's secrets. */
const IDENTITY_SECRET_LABELS: Record<(typeof IDENTITY_SECRETS)[number], string> = { ssn: "Social Security number", passportNumber: "Passport number", licenseNumber: "License number" };

/** The inputs each kind of item has, after its name and before its notes. */
function fieldsFor(type: ChaaviItemType): FormField[] {
  if (type === "login") {
    return [
      text("Username", (d) => d.login.username, (d, v) => void (d.login.username = v)),
      secret("Password", (d) => d.login.password, (d, v) => void (d.login.password = v), { field: "password" }, { generate: true, placeholder: "Leave blank to generate" }),
      secret("Authenticator key", (d) => d.login.totp, (d, v) => void (d.login.totp = v), { field: "totp" }, { placeholder: "otpauth:// URI or base32 key" }),
      { kind: "websites" },
    ];
  }
  if (type === "card") {
    return [
      text("Cardholder", (d) => d.card.cardholderName, (d, v) => void (d.card.cardholderName = v)),
      { kind: "choice", label: "Brand", options: [["", "—"], ...BRANDS.map((brand): [string, string] => [brand, brand])], get: (d) => d.card.brand, set: (d, v) => void (d.card.brand = v) },
      secret("Number", (d) => d.card.number, (d, v) => void (d.card.number = v), { field: "number" }),
      { kind: "choice", label: "Expiry month", options: [["", "—"], ...MONTHS.map((month, i): [string, string] => [String(i + 1), `${String(i + 1).padStart(2, "0")} · ${month}`])], get: (d) => d.card.expMonth, set: (d, v) => void (d.card.expMonth = v) },
      text("Expiry year", (d) => d.card.expYear, (d, v) => void (d.card.expYear = v.replace(/\D/g, "")), { placeholder: "YYYY", numeric: true }),
      secret("Security code", (d) => d.card.code, (d, v) => void (d.card.code = v), { field: "code" }),
    ];
  }
  if (type === "identity") {
    return [
      ...IDENTITY_TEXT.map((key) => text(IDENTITY_LABELS[key], (d) => d.identity[key], (d, v) => void (d.identity[key] = v))),
      ...IDENTITY_SECRETS.map((key) => secret(IDENTITY_SECRET_LABELS[key], (d) => d.identity[key], (d, v) => void (d.identity[key] = v), { field: key })),
    ];
  }
  if (type === "sshKey") {
    return [
      text("Public key", (d) => d.sshKey.publicKey, (d, v) => void (d.sshKey.publicKey = v)),
      text("Fingerprint", (d) => d.sshKey.keyFingerprint, (d, v) => void (d.sshKey.keyFingerprint = v)),
      secret("Private key", (d) => d.sshKey.privateKey, (d, v) => void (d.sshKey.privateKey = v), { field: "privateKey" }, { area: true, placeholder: "Leave blank to generate an Ed25519 key, or paste one" }),
    ];
  }
  if (isFlatType(type)) {
    return [
      ...FLAT_FIELDS[type].text.map((field) => text(field.label, (d) => d.flat[field.key]!, (d, v) => void (d.flat[field.key] = v), { date: /date/i.test(field.key) })),
      ...FLAT_FIELDS[type].secret.map((field) => secret(field.label, (d) => d.flatSecrets[field.key]!, (d, v) => void (d.flatSecrets[field.key] = v), { field: field.key })),
    ];
  }
  return [];
}

type SheetFieldProps = {
  label: string;
  /** Whether the box grows with its text, as notes do. */
  tall?: boolean;
  children: ReactNode;
  /** Drawn at the end of the box, such as a button or a chevron. */
  extra?: ReactNode;
};

/** A label over a box that holds one input. */
function SheetField({ label, tall = false, children, extra }: SheetFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="ui-label" style={{ fontSize: 10.5 }}>
        {label}
      </span>
      <div
        style={{
          display: "flex",
          alignItems: tall ? "flex-start" : "center",
          gap: 8,
          ...(tall ? { minHeight: 96, padding: "10px 14px" } : { height: 44, padding: "0 14px" }),
          borderRadius: 12,
          background: "var(--bone)",
          border: "1px solid var(--glass-border)",
        }}
      >
        {children}
        {extra}
      </div>
    </div>
  );
}

type BoxProps = {
  children: ReactNode;
};

/** A one-line box holding inputs, as a field's own is. */
function Box({ children }: BoxProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 14px", borderRadius: 12, background: "var(--bone)", border: "1px solid var(--glass-border)" }}>{children}</div>
  );
}

export type ItemSheetProps = {
  /** `create` lets the kind change; `edit` keeps it. */
  mode: "create" | "edit";
  /** The starting draft: empty for create, the item's public values for edit. */
  initial: ItemDraft;
  /** The item being edited, whose stored secrets the eye reads into the form. */
  itemId: string | null;
  folders: ChaaviFolder[];
  /** A save is in flight. */
  pending: boolean;
  /** Leaves with its exit animation. */
  leaving?: boolean;
  onClose: () => void;
  onSubmit: (draft: ItemDraft) => void;
};

/** The order the kind select lists kinds in. */
const KINDS: ChaaviItemType[] = ["login", "note", "card", "bankAccount", "identity", "sshKey", "driversLicense", "passport"];

type EyeProps = {
  name: string;
  editing: boolean;
  loaded: boolean;
  shown: boolean;
  onClick: () => void;
};

/** Shows or hides what is typed; on an edit of a secret not yet read, it reads the stored value in. */
function Eye({ name, editing, loaded, shown, onClick }: EyeProps) {
  return <IconButton icon="eye" label={shown ? `Hide ${name}` : editing && !loaded ? `Reveal ${name}` : `Show ${name}`} size={28} iconSize={15} selected={shown ? true : undefined} onClick={onClick} />;
}

/**
 * The item sheet over the page: a dim scrim and a panel from the right edge holding the item's kind (a new item picks one), its name, its fields, its notes, its
 * custom fields and its folder. A stored secret starts blank and untouched, so a blank one keeps its value; the eye reads it in after the computer's owner check,
 * and typing replaces it. What stops a save is told in a toast.
 */
export function ItemSheet({ mode, initial, itemId, folders, pending, leaving = false, onClose, onSubmit }: ItemSheetProps) {
  const [draft, setDraft] = useState<ItemDraft>(initial);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const editing = mode === "edit";
  const title = editing ? "Edit item" : "New item";

  const update = (change: (next: ItemDraft) => void) =>
    setDraft((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });

  const show = (key: string, on: boolean) =>
    setShown((current) => {
      const next = new Set(current);
      if (on) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });

  const fail = (title_: string, err: unknown) => pushToast({ key: `chaavi-${title_}`, tone: "error", title: title_, body: err instanceof Error ? err.message : String(err) });

  /** Reads a stored secret into the draft without marking it typed. */
  const reveal = (key: string, label: string, request: ChaaviReveal, apply: (next: ItemDraft, value: string) => void) => {
    if (itemId === null) {
      return;
    }
    confirmOwner(`show ${label.toLowerCase()} to edit it`)
      .then(() => chaavi.reveal(itemId, request))
      .then(({ value }) => {
        update((next) => apply(next, value));
        show(key, true);
      })
      .catch((err: unknown) => fail(`Couldn't show ${label.toLowerCase()}`, err));
  };

  const generate = () =>
    chaavi
      .generatePassword({ length: 20, special: true })
      .then(({ password }) => {
        update((next) => void (next.login.password = { value: password, dirty: true }));
        show("Password", true);
      })
      .catch((err: unknown) => fail("Couldn't generate a password", err));

  const submit = () => {
    const problem = draftProblem(draft, !editing);
    if (problem !== null) {
      pushToast({ key: "chaavi-draft", tone: "error", title: "Can't save yet", body: problem });
      return;
    }
    onSubmit(draft);
  };

  const addField = (type: FieldDraft["type"]) =>
    update((next) => void next.fields.push({ key: draftKey(), name: "", type, value: { value: "", dirty: type === "text" }, bool: false, linkedTo: null, storedAs: null }));
  const targets = LINK_TARGETS[draft.type];
  const notesField = secret("Notes", (d) => d.notes, (d, v) => void (d.notes = v), { field: "notes" }, { area: true });

  const renderSecret = (field: Extract<FormField, { kind: "secret" }>) => {
    const area = field.area === true;
    const masked = field.reveal.field !== "notes";
    const value = field.get(draft);
    const loaded = value.value !== "" || value.dirty;
    const visible = shown.has(field.label);
    const placeholder = editing ? "Leave blank to keep it" : field.placeholder;
    const eye = <Eye name={field.label} editing={editing} loaded={loaded} shown={visible} onClick={() => (visible || !editing || loaded ? show(field.label, !visible) : reveal(field.label, field.label, field.reveal, (next, v) => field.set(next, { value: v, dirty: false })))} />;
    const extra = (
      <>
        {field.generate ? (
          <Button tone="sage" size="md" pill onClick={() => void generate()}>
            Generate
          </Button>
        ) : null}
        {masked || editing ? eye : null}
      </>
    );
    return (
      <SheetField key={`${draft.type}-${field.label}`} label={field.label} tall={area} extra={extra}>
        {area ? (
          <textarea
            className="cinp"
            aria-label={field.label}
            rows={4}
            spellCheck={false}
            placeholder={placeholder}
            value={value.value}
            onChange={(event) => update((next) => field.set(next, { value: event.target.value, dirty: true }))}
            style={{ fontSize: 14.5, color: "var(--ink)", resize: "none", lineHeight: "20px", ...(masked ? { WebkitTextSecurity: visible || !loaded ? "none" : "disc" } : {}) }}
          />
        ) : (
          <input
            className="cinp"
            type={visible ? "text" : "password"}
            aria-label={field.label}
            autoComplete="new-password"
            spellCheck={false}
            placeholder={placeholder}
            value={value.value}
            onChange={(event) => update((next) => field.set(next, { value: event.target.value, dirty: true }))}
            style={{ fontSize: 14.5, color: "var(--ink)" }}
          />
        )}
      </SheetField>
    );
  };

  const renderField = (field: FormField): ReactNode => {
    if (field.kind === "text") {
      return (
        <SheetField key={`${draft.type}-${field.label}`} label={field.label}>
          <input
            className="cinp"
            type={field.date ? "date" : "text"}
            aria-label={field.label}
            autoComplete="off"
            spellCheck={false}
            placeholder={field.placeholder}
            inputMode={field.numeric ? "numeric" : undefined}
            maxLength={field.numeric ? 4 : undefined}
            value={field.get(draft)}
            onChange={(event) => update((next) => field.set(next, event.target.value))}
            style={{ fontSize: 14.5, color: "var(--ink)" }}
          />
        </SheetField>
      );
    }
    if (field.kind === "choice") {
      return (
        <SheetField key={`${draft.type}-${field.label}`} label={field.label} extra={<Icon name="chevDown" size={14} />}>
          <select className="cinp" aria-label={field.label} value={field.get(draft)} onChange={(event) => update((next) => field.set(next, event.target.value))} style={{ fontSize: 14.5, color: "var(--ink)", appearance: "none" }}>
            {field.options.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </SheetField>
      );
    }
    if (field.kind === "websites") {
      return (
        <div key="websites" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="ui-label" style={{ fontSize: 10.5 }}>
            Websites
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draft.login.uris.map((entry, i) => (
              <Box key={entry.key}>
                <input className="cinp" type="text" aria-label={`Website ${i + 1}`} autoComplete="off" spellCheck={false} placeholder="https://" value={entry.uri} onChange={(event) => update((next) => void (next.login.uris[i]!.uri = event.target.value))} style={{ fontSize: 14.5, color: "var(--ink)" }} />
                <select
                  className="cinp"
                  aria-label={`Website ${i + 1} match`}
                  value={entry.match}
                  onChange={(event) => update((next) => void (next.login.uris[i]!.match = event.target.value as (typeof URI_MATCHES)[number]["id"]))}
                  style={{ fontSize: 13, color: "var(--ink)", appearance: "none", flex: "none", width: 112 }}
                >
                  {URI_MATCHES.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevDown" size={14} />
                <IconButton icon="close" label={`Remove website ${i + 1}`} size={28} iconSize={14} onClick={() => update((next) => void next.login.uris.splice(i, 1))} />
              </Box>
            ))}
            <div style={{ alignSelf: "flex-start" }}>
              <Button tone="sage" size="md" pill icon="plus" aria-label="Add website" onClick={() => update((next) => void next.login.uris.push({ key: draftKey(), uri: "", match: "default" }))}>
                Website
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return renderSecret(field);
  };

  const renderCustom = (field: FieldDraft, i: number) => {
    const key = `field:${field.key}`;
    const visible = shown.has(key);
    const stored = field.storedAs;
    const loaded = field.value.value !== "" || field.value.dirty;
    return (
      <div key={field.key} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 14, background: "rgba(250,250,247,.8)", border: "1px solid var(--glass-border)" }}>
        <Box>
          <span className="ui-label" style={{ fontSize: 10.5, width: 56, flex: "none" }}>
            {field.type}
          </span>
          <input className="cinp" type="text" aria-label={`Field ${i + 1} name`} autoComplete="off" spellCheck={false} placeholder="Name" value={field.name} onChange={(event) => update((next) => void (next.fields[i]!.name = event.target.value))} style={{ fontSize: 14.5, color: "var(--ink)" }} />
          <IconButton icon="close" label={`Remove field ${i + 1}`} size={28} iconSize={14} onClick={() => update((next) => void next.fields.splice(i, 1))} />
        </Box>
        {field.type === "text" ? (
          <Box>
            <input className="cinp" type="text" aria-label={`Field ${i + 1} value`} autoComplete="off" spellCheck={false} value={field.value.value} onChange={(event) => update((next) => void (next.fields[i]!.value = { value: event.target.value, dirty: true }))} style={{ fontSize: 14.5, color: "var(--ink)" }} />
          </Box>
        ) : null}
        {field.type === "hidden" ? (
          <Box>
            <input
              className="cinp"
              type={visible ? "text" : "password"}
              aria-label={`Field ${i + 1} value`}
              autoComplete="new-password"
              spellCheck={false}
              placeholder={stored !== null ? "Leave blank to keep it" : undefined}
              value={field.value.value}
              onChange={(event) => update((next) => void (next.fields[i]!.value = { value: event.target.value, dirty: true }))}
              style={{ fontSize: 14.5, color: "var(--ink)" }}
            />
            <Eye
              name={`field ${i + 1}`}
              editing={stored !== null}
              loaded={loaded}
              shown={visible}
              onClick={() => (visible || stored === null || loaded ? show(key, !visible) : reveal(key, field.name, { field: "custom", name: stored }, (next, v) => void (next.fields[i]!.value = { value: v, dirty: false })))}
            />
          </Box>
        ) : null}
        {field.type === "boolean" ? (
          <Box>
            <input type="checkbox" aria-label={`Field ${i + 1} value`} checked={field.bool} onChange={(event) => update((next) => void (next.fields[i]!.bool = event.target.checked))} style={{ width: 16, height: 16, margin: 0, accentColor: "var(--sage)", flex: "none" }} />
            <span style={{ fontSize: 14.5, flex: 1 }}>{field.bool ? "Yes" : "No"}</span>
          </Box>
        ) : null}
        {field.type === "linked" ? (
          <Box>
            <select className="cinp" aria-label={`Field ${i + 1} links to`} value={field.linkedTo ?? ""} onChange={(event) => update((next) => void (next.fields[i]!.linkedTo = (event.target.value || null) as FieldDraft["linkedTo"]))} style={{ fontSize: 14.5, color: "var(--ink)", appearance: "none" }}>
              <option value="">Links to…</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
            <Icon name="chevDown" size={14} />
          </Box>
        ) : null}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={pending ? undefined : onClose}
      style={{ position: "absolute", inset: 0, background: "rgba(44,48,42,.18)", display: "flex", justifyContent: "flex-end", animation: leaving ? `fade-out ${EASE_OUT} both` : `fade ${EASE_IN} both`, zIndex: 30 }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ display: "flex", flexDirection: "column", width: 420, height: "100%", background: "var(--bone)", borderLeft: "1px solid var(--glass-border)", boxShadow: "var(--shadow-deep)", padding: 22, gap: 16, animation: leaving ? `slide-out ${EASE_OUT} both` : `slide-in ${EASE_IN} both` }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 600, flex: 1, minWidth: 0 }}>{title}</span>
          <IconButton icon="close" label="Close" disabled={pending || undefined} onClick={onClose} />
        </div>
        {editing ? null : (
          <SheetField label="Kind" extra={<Icon name="chevDown" size={14} />}>
            <select className="cinp" aria-label="Kind" value={draft.type} onChange={(event) => setDraft((current) => retype(current, event.target.value as ChaaviItemType))} style={{ fontSize: 14.5, color: "var(--ink)", appearance: "none" }}>
              {KINDS.map((type) => (
                <option key={type} value={type}>
                  {TYPE_META[type].one}
                </option>
              ))}
            </select>
          </SheetField>
        )}
        <div className="scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16, padding: 2, margin: -2 }}>
          <SheetField label="Name">
            <input className="cinp" type="text" aria-label="Name" autoComplete="off" spellCheck={false} autoFocus value={draft.name} onChange={(event) => update((next) => void (next.name = event.target.value))} style={{ fontSize: 14.5, color: "var(--ink)" }} />
          </SheetField>
          {fieldsFor(draft.type).map(renderField)}
          {renderSecret(notesField)}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="ui-label" style={{ fontSize: 10.5 }}>
              Custom fields
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {draft.fields.map(renderCustom)}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {(["text", "hidden", "boolean", "linked"] as const).map((type) => (
                  <Button key={type} tone="sage" size="md" pill icon="plus" aria-label={`Add ${type} field`} disabled={type === "linked" && targets.length === 0} onClick={() => addField(type)}>
                    {type[0]!.toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <SheetField label="Folder" extra={<Icon name="chevDown" size={14} />}>
            <select className="cinp" aria-label="Folder" value={draft.folderId ?? ""} onChange={(event) => update((next) => void (next.folderId = event.target.value === "" ? null : event.target.value))} style={{ fontSize: 14.5, color: "var(--ink)", appearance: "none" }}>
              <option value="">No folder</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </SheetField>
        </div>
        <ButtonGroup justify="flex-end">
          <Button tone="quiet" size="xl" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button tone="fill" size="xl" disabled={pending} onClick={submit}>
            {editing ? "Save" : "Create"}
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}

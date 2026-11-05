import { useState, type ReactNode } from "react";
import { chaavi } from "../../shared/api";
import { Button, ButtonGroup, IconButton } from "../../shared/ui/Button";
import { Field, FieldGroup, FIELD_INPUT, SelectField, TextField } from "../../shared/ui/Field";
import { Icon } from "../../shared/ui/Icon";
import { Sheet } from "../../shared/overlay/Sheet";
import { confirmOwner } from "../../shared/desktop/owner";
import { pushToast } from "../../contexts/toasts";
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
  /** Whether the sheet is showing; closing plays its exit. */
  open: boolean;
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
  return <IconButton icon="eye" label={shown ? `Hide ${name}` : editing && !loaded ? `Reveal ${name}` : `Show ${name}`} size={32} iconSize={15} selected={shown ? true : undefined} onClick={onClick} />;
}

/**
 * The item sheet over the page: a dim scrim and a panel from the right edge holding the item's kind (a new item picks one), its name, its fields, its notes, its
 * custom fields and its folder. A stored secret starts blank and untouched, so a blank one keeps its value; the eye reads it in after the computer's owner check,
 * and typing replaces it. What stops a save is told in a toast.
 */
export function ItemSheet({ mode, initial, itemId, folders, pending, open, onClose, onSubmit }: ItemSheetProps) {
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
    const hidden = masked && !visible && loaded ? "[-webkit-text-security:disc]" : "";
    const change = (event: { target: { value: string } }) => update((next) => field.set(next, { value: event.target.value, dirty: true }));
    return (
      <Field key={`${draft.type}-${field.label}`} label={field.label} tall={area} extra={extra}>
        {area ? (
          <textarea className={`${FIELD_INPUT} resize-none leading-5 ${hidden}`} aria-label={field.label} rows={4} spellCheck={false} placeholder={placeholder} value={value.value} onChange={change} />
        ) : (
          <input className={FIELD_INPUT} type={visible ? "text" : "password"} aria-label={field.label} autoComplete="new-password" spellCheck={false} placeholder={placeholder} value={value.value} onChange={change} />
        )}
      </Field>
    );
  };

  const renderField = (field: FormField): ReactNode => {
    if (field.kind === "text") {
      return (
        <TextField
          key={`${draft.type}-${field.label}`}
          label={field.label}
          type={field.date ? "date" : "text"}
          placeholder={field.placeholder}
          inputMode={field.numeric ? "numeric" : undefined}
          maxLength={field.numeric ? 4 : undefined}
          value={field.get(draft)}
          onChange={(value) => update((next) => field.set(next, value))}
        />
      );
    }
    if (field.kind === "choice") {
      return <SelectField key={`${draft.type}-${field.label}`} label={field.label} options={field.options} value={field.get(draft)} onChange={(value) => update((next) => field.set(next, value))} />;
    }
    if (field.kind === "websites") {
      return (
        <FieldGroup key="websites" label="Websites">
          {draft.login.uris.map((entry, i) => (
            <Field key={entry.key}>
              <input className={FIELD_INPUT} type="text" aria-label={`Website ${i + 1}`} autoComplete="off" spellCheck={false} placeholder="https://" value={entry.uri} onChange={(event) => update((next) => void (next.login.uris[i]!.uri = event.target.value))} />
              <select
                className={`${FIELD_INPUT} w-28 flex-none appearance-none text-[13px]`}
                aria-label={`Website ${i + 1} match`}
                value={entry.match}
                onChange={(event) => update((next) => void (next.login.uris[i]!.match = event.target.value as (typeof URI_MATCHES)[number]["id"]))}
              >
                {URI_MATCHES.map((match) => (
                  <option key={match.id} value={match.id}>
                    {match.label}
                  </option>
                ))}
              </select>
              <Icon name="chevDown" size={14} />
              <IconButton icon="close" label={`Remove website ${i + 1}`} size={32} iconSize={14} onClick={() => update((next) => void next.login.uris.splice(i, 1))} />
            </Field>
          ))}
          <div className="self-start">
            <Button tone="sage" size="md" pill icon="plus" aria-label="Add website" onClick={() => update((next) => void next.login.uris.push({ key: draftKey(), uri: "", match: "default" }))}>
              Website
            </Button>
          </div>
        </FieldGroup>
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
      <div key={field.key} className="flex flex-col gap-2 rounded-[14px] border border-glass-border bg-glass-sheet p-2.5">
        <Field>
          <span className="ui-label w-14 flex-none">{field.type}</span>
          <input className={FIELD_INPUT} type="text" aria-label={`Field ${i + 1} name`} autoComplete="off" spellCheck={false} placeholder="Name" value={field.name} onChange={(event) => update((next) => void (next.fields[i]!.name = event.target.value))} />
          <IconButton icon="close" label={`Remove field ${i + 1}`} size={32} iconSize={14} onClick={() => update((next) => void next.fields.splice(i, 1))} />
        </Field>
        {field.type === "text" ? (
          <Field>
            <input className={FIELD_INPUT} type="text" aria-label={`Field ${i + 1} value`} autoComplete="off" spellCheck={false} value={field.value.value} onChange={(event) => update((next) => void (next.fields[i]!.value = { value: event.target.value, dirty: true }))} />
          </Field>
        ) : null}
        {field.type === "hidden" ? (
          <Field
            extra={
              <Eye
                name={`field ${i + 1}`}
                editing={stored !== null}
                loaded={loaded}
                shown={visible}
                onClick={() => (visible || stored === null || loaded ? show(key, !visible) : reveal(key, field.name, { field: "custom", name: stored }, (next, v) => void (next.fields[i]!.value = { value: v, dirty: false })))}
              />
            }
          >
            <input
              className={FIELD_INPUT}
              type={visible ? "text" : "password"}
              aria-label={`Field ${i + 1} value`}
              autoComplete="new-password"
              spellCheck={false}
              placeholder={stored !== null ? "Leave blank to keep it" : undefined}
              value={field.value.value}
              onChange={(event) => update((next) => void (next.fields[i]!.value = { value: event.target.value, dirty: true }))}
            />
          </Field>
        ) : null}
        {field.type === "boolean" ? (
          <Field>
            <input type="checkbox" aria-label={`Field ${i + 1} value`} checked={field.bool} onChange={(event) => update((next) => void (next.fields[i]!.bool = event.target.checked))} className="m-0 size-4 flex-none accent-sage" />
            <span className="flex-1 text-[15px]">{field.bool ? "Yes" : "No"}</span>
          </Field>
        ) : null}
        {field.type === "linked" ? (
          <Field extra={<Icon name="chevDown" size={14} />}>
            <select className={`${FIELD_INPUT} appearance-none`} aria-label={`Field ${i + 1} links to`} value={field.linkedTo ?? ""} onChange={(event) => update((next) => void (next.fields[i]!.linkedTo = (event.target.value || null) as FieldDraft["linkedTo"]))}>
              <option value="">Links to…</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} label={title} locked={pending}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
        <div className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 text-[20px] font-semibold">{title}</span>
          <IconButton icon="close" label="Close" disabled={pending || undefined} onClick={onClose} />
        </div>
        {editing ? null : <SelectField label="Kind" value={draft.type} options={KINDS.map((type): [string, string] => [type, TYPE_META[type].one])} onChange={(value) => setDraft((current) => retype(current, value as ChaaviItemType))} />}
        <div className="scroll -m-0.5 flex min-h-0 flex-1 flex-col gap-4 p-0.5">
          <TextField label="Name" autoFocus value={draft.name} onChange={(value) => update((next) => void (next.name = value))} />
          {fieldsFor(draft.type).map(renderField)}
          {renderSecret(notesField)}
          <FieldGroup label="Custom fields">
            {draft.fields.map(renderCustom)}
            <div className="flex flex-wrap items-center gap-2">
              {(["text", "hidden", "boolean", "linked"] as const).map((type) => (
                <Button key={type} tone="sage" size="md" pill icon="plus" aria-label={`Add ${type} field`} disabled={type === "linked" && targets.length === 0} onClick={() => addField(type)}>
                  {type[0]!.toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </FieldGroup>
          <SelectField label="Folder" value={draft.folderId ?? ""} options={[["", "No folder"], ...folders.map((folder): [string, string] => [folder.id, folder.name])]} onChange={(value) => update((next) => void (next.folderId = value === "" ? null : value))} />
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
    </Sheet>
  );
}

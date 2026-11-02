import { useState, type ReactNode } from "react";
import { chaavi } from "../../shared/api";
import { Button, ButtonGroup, IconButton } from "../../shared/components/Button";
import { Icon } from "../../shared/components/Icon";
import { Segmented } from "../../shared/components/Segmented";
import { pushToast } from "../../store/toasts";
import type { ChaaviFolder, ChaaviItemType } from "../../types/chaavi";
import { draftKey, draftProblem, FLAT_FIELDS, IDENTITY_SECRETS, IDENTITY_TEXT, isFlatType, retype, TYPE_META, type ItemDraft, type SecretDraft } from "./draft";

/** The kinds of item a new item can be, in the order the switch lists them. */
const CREATABLE: ChaaviItemType[] = ["login", "note", "bankAccount"];

/** How the sheet and its scrim ease in. */
const EASE_IN = "320ms cubic-bezier(.22,.61,.36,1)";

/** How they ease out; the page removes the sheet when it is over. */
const EASE_OUT = "200ms cubic-bezier(.22,.61,.36,1)";

/** What an input on the sheet edits: plain text, or a secret that is sent only once it is typed. */
type FormField =
  | { kind: "text"; label: string; get: (draft: ItemDraft) => string; set: (draft: ItemDraft, value: string) => void }
  | { kind: "secret"; label: string; get: (draft: ItemDraft) => SecretDraft; set: (draft: ItemDraft, value: SecretDraft) => void; generate?: boolean }
  | { kind: "area"; label: string; get: (draft: ItemDraft) => SecretDraft; set: (draft: ItemDraft, value: SecretDraft) => void };

const text = (label: string, get: (draft: ItemDraft) => string, set: (draft: ItemDraft, value: string) => void): FormField => ({ kind: "text", label, get, set });
const secret = (label: string, get: (draft: ItemDraft) => SecretDraft, set: (draft: ItemDraft, value: SecretDraft) => void, generate = false): FormField => ({ kind: "secret", label, get, set, generate });

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

/** The inputs each kind of item has, after its name and before its folder. */
function fieldsFor(type: ChaaviItemType): FormField[] {
  if (type === "login") {
    return [
      text("Website", (d) => d.login.uris[0]?.uri ?? "", (d, v) => {
        const first = d.login.uris[0];
        if (first) {
          first.uri = v;
        } else {
          d.login.uris.push({ key: draftKey(), uri: v, match: "default" });
        }
      }),
      text("Username", (d) => d.login.username, (d, v) => void (d.login.username = v)),
      secret("Password", (d) => d.login.password, (d, v) => void (d.login.password = v), true),
    ];
  }
  if (type === "note") {
    return [{ kind: "area", label: "Notes", get: (d) => d.notes, set: (d, v) => void (d.notes = v) }];
  }
  if (type === "card") {
    return [
      text("Cardholder", (d) => d.card.cardholderName, (d, v) => void (d.card.cardholderName = v)),
      text("Brand", (d) => d.card.brand, (d, v) => void (d.card.brand = v)),
      secret("Number", (d) => d.card.number, (d, v) => void (d.card.number = v)),
      text("Expiry month", (d) => d.card.expMonth, (d, v) => void (d.card.expMonth = v)),
      text("Expiry year", (d) => d.card.expYear, (d, v) => void (d.card.expYear = v.replace(/\D/g, ""))),
      secret("Security code", (d) => d.card.code, (d, v) => void (d.card.code = v)),
    ];
  }
  if (type === "identity") {
    return [
      ...IDENTITY_TEXT.map((key) => text(IDENTITY_LABELS[key], (d) => d.identity[key], (d, v) => void (d.identity[key] = v))),
      ...IDENTITY_SECRETS.map((key) => secret(IDENTITY_SECRET_LABELS[key], (d) => d.identity[key], (d, v) => void (d.identity[key] = v))),
    ];
  }
  if (type === "sshKey") {
    return [
      text("Public key", (d) => d.sshKey.publicKey, (d, v) => void (d.sshKey.publicKey = v)),
      text("Fingerprint", (d) => d.sshKey.keyFingerprint, (d, v) => void (d.sshKey.keyFingerprint = v)),
      secret("Private key", (d) => d.sshKey.privateKey, (d, v) => void (d.sshKey.privateKey = v)),
    ];
  }
  if (isFlatType(type)) {
    return [
      ...FLAT_FIELDS[type].text.map((field) => text(field.label, (d) => d.flat[field.key]!, (d, v) => void (d.flat[field.key] = v))),
      ...FLAT_FIELDS[type].secret.map((field) => secret(field.label, (d) => d.flatSecrets[field.key]!, (d, v) => void (d.flatSecrets[field.key] = v))),
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

export type ItemSheetProps = {
  /** `create` lets the kind change among a few; `edit` keeps it. */
  mode: "create" | "edit";
  /** The starting draft: empty for create, the item's public values for edit. */
  initial: ItemDraft;
  folders: ChaaviFolder[];
  /** A save is in flight. */
  pending: boolean;
  /** Leaves with its exit animation. */
  leaving?: boolean;
  onClose: () => void;
  onSubmit: (draft: ItemDraft) => void;
};

/**
 * The item sheet over the page: a dim scrim and a panel from the right edge holding the item's kind (a new item picks one), its
 * name, its fields and its folder. A stored secret starts blank and untouched: a blank one keeps its value and typing replaces it.
 * What stops a save is told in a toast.
 */
export function ItemSheet({ mode, initial, folders, pending, leaving = false, onClose, onSubmit }: ItemSheetProps) {
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

  const generate = () =>
    chaavi
      .generatePassword({ length: 20, special: true })
      .then(({ password }) => {
        update((next) => void (next.login.password = { value: password, dirty: true }));
        setShown((current) => new Set(current).add("Password"));
      })
      .catch((err: unknown) => pushToast({ key: "chaavi-generate", tone: "error", title: "Couldn't generate a password", body: err instanceof Error ? err.message : String(err) }));

  const submit = () => {
    const problem = draftProblem(draft, !editing);
    if (problem !== null) {
      pushToast({ key: "chaavi-draft", tone: "error", title: "Can't save yet", body: problem });
      return;
    }
    onSubmit(draft);
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
          <Segmented
            options={CREATABLE.map((type) => TYPE_META[type].one)}
            value={TYPE_META[draft.type].one}
            onChange={(one) => setDraft((current) => retype(current, CREATABLE.find((type) => TYPE_META[type].one === one)!))}
          />
        )}
        <div className="scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16, padding: 2, margin: -2 }}>
          <SheetField label="Name">
            <input className="cinp" type="text" aria-label="Name" autoComplete="off" spellCheck={false} autoFocus value={draft.name} onChange={(event) => update((next) => void (next.name = event.target.value))} style={{ fontSize: 14.5, color: "var(--ink)" }} />
          </SheetField>
          {fieldsFor(draft.type).map((field) => {
            if (field.kind === "text") {
              return (
                <SheetField key={`${draft.type}-${field.label}`} label={field.label}>
                  <input className="cinp" type="text" aria-label={field.label} autoComplete="off" spellCheck={false} value={field.get(draft)} onChange={(event) => update((next) => field.set(next, event.target.value))} style={{ fontSize: 14.5, color: "var(--ink)" }} />
                </SheetField>
              );
            }
            if (field.kind === "area") {
              return (
                <SheetField key={`${draft.type}-${field.label}`} label={field.label} tall>
                  <textarea
                    className="cinp"
                    aria-label={field.label}
                    rows={4}
                    spellCheck={false}
                    placeholder={editing ? "Leave blank to keep it" : undefined}
                    value={field.get(draft).value}
                    onChange={(event) => update((next) => field.set(next, { value: event.target.value, dirty: true }))}
                    style={{ fontSize: 14.5, color: "var(--ink)", resize: "none", lineHeight: "20px" }}
                  />
                </SheetField>
              );
            }
            const visible = shown.has(field.label);
            return (
              <SheetField
                key={`${draft.type}-${field.label}`}
                label={field.label}
                extra={
                  field.generate ? (
                    <Button tone="sage" size="md" pill onClick={() => void generate()}>
                      Generate
                    </Button>
                  ) : undefined
                }
              >
                <input
                  className="cinp"
                  type={visible ? "text" : "password"}
                  aria-label={field.label}
                  autoComplete="new-password"
                  spellCheck={false}
                  placeholder={editing ? "Leave blank to keep it" : undefined}
                  value={field.get(draft).value}
                  onChange={(event) => update((next) => field.set(next, { value: event.target.value, dirty: true }))}
                  style={{ fontSize: 14.5, color: "var(--ink)" }}
                />
              </SheetField>
            );
          })}
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

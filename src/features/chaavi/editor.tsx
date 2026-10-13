/**
 * Create and edit sheet for every item type. Stored secrets start blank and untouched: a
 * blank one keeps its value, Reveal loads it to edit, and typing replaces it.
 */

import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { chaavi } from "../../shared/api";
import { EASE, SLOW_S, SLOWER_S } from "../../shared/lib/ux/motion";
import type { ChaaviFolder, ChaaviReveal } from "../../types/chaavi";
import {
  draftKey,
  draftProblem,
  FLAT_FIELDS,
  isFlatType,
  ITEM_TYPES,
  LINK_TARGETS,
  retype,
  TYPE_META,
  URI_MATCHES,
  type FieldDraft,
  type ItemDraft,
  type SecretDraft,
} from "./draft";
import { SelectionMark } from "./vault";

const FIELD =
  "w-full min-w-0 rounded-[var(--radius)] border border-rule bg-bone/50 px-3 py-2 text-[14px] text-ink outline-none transition-[border-color] duration-slow ease-dadi placeholder:text-ink-ghost focus:border-sage disabled:opacity-50";

const CHIP =
  "inline-flex h-7 items-center rounded-full border border-dashed border-sage-line px-3 text-[11px] text-ink-muted transition-[border-color,color] duration-fast ease-dadi hover:border-sage hover:text-sage-deep disabled:opacity-40";

const SMALL_ACT =
  "shrink-0 rounded-[var(--radius)] border border-dashed border-sage-line px-2.5 text-[10px] font-medium tracking-[0.14em] text-sage-deep uppercase transition-[border-color] duration-fast ease-dadi hover:border-sage disabled:opacity-40";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const BRANDS = ["Visa", "Mastercard", "Amex", "Discover", "Diners Club", "JCB", "Maestro", "UnionPay", "RuPay", "Other"];

export type ItemEditorProps = {
  /** `create` lets the type change; `edit` keeps it. */
  mode: "create" | "edit";
  /** The starting draft: empty for create, the item's public values for edit. */
  initial: ItemDraft;
  /** Item being edited, to reveal stored secrets into the draft. */
  itemId: string | null;
  folders: ChaaviFolder[];
  pending: boolean;
  /** The save's failure, from Chaavi. */
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: ItemDraft) => void;
};

/**
 * The item editor sheet over a frosted scrim: the scrim fades in as the sheet rises and
 * settles out of a slight shrink, and both go the same way out. On a new item, the type's
 * plate glides between types and that type's fields cross-fade in.
 */
export function ItemEditor({ mode, initial, itemId, folders, pending, error, onClose, onSubmit }: ItemEditorProps) {
  const [draft, setDraft] = useState<ItemDraft>(initial);
  const [tried, setTried] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const problem = draftProblem(draft);
  const editing = mode === "edit";
  const update = (fn: (next: ItemDraft) => void) =>
    setDraft((current) => {
      const next = structuredClone(current);
      fn(next);
      return next;
    });

  /** Load a stored secret into the draft without marking it typed. */
  const reveal = (request: ChaaviReveal, apply: (next: ItemDraft, value: string) => void) => {
    if (itemId === null) {
      return;
    }
    setActionError(null);
    chaavi
      .reveal(itemId, request)
      .then(({ value }) => update((next) => apply(next, value)))
      .catch((err: unknown) => setActionError(err instanceof Error ? err.message : String(err)));
  };

  /** Put a fresh generated password in the draft, shown so it can be checked. */
  const generate = () => {
    setActionError(null);
    chaavi
      .generatePassword({ length: 20, special: true })
      .then(({ password }) => update((next) => void (next.login.password = { value: password, dirty: true })))
      .catch((err: unknown) => setActionError(err instanceof Error ? err.message : String(err)));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (problem === null && !pending) {
      onSubmit(draft);
    }
  };

  const title = `${editing ? "Edit" : "New"} ${TYPE_META[draft.type].one.toLowerCase()}`;

  return (
    <motion.div
      className="frost-scrim absolute inset-0 z-20 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: SLOW_S, ease: EASE }}
      onClick={onClose}
    >
      <motion.form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        aria-label={title}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98, transition: { duration: SLOW_S, ease: EASE } }}
        transition={{ duration: SLOWER_S, ease: EASE }}
        className="widget-frame flex max-h-full w-full max-w-2xl flex-col shadow-[var(--shadow-deep)]"
      >
        <div className="widget-frame__chrome !justify-between !px-5 !pt-4 !pb-3">
          <span className="widget-frame__title">{title}</span>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-[10px] font-medium tracking-[1.6px] text-ink-ghost hover:text-ink-muted disabled:opacity-40"
          >
            CLOSE
          </button>
        </div>
        <div className="widget-frame__body flex flex-col gap-4 !overflow-y-auto border-t border-dashed border-sage-line px-5 pt-4 pb-5">
          {!editing ? (
            <div role="group" aria-label="Item type" className="flex flex-wrap gap-1 rounded-[var(--radius)] border border-dashed border-sage-line p-1">
              {ITEM_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={draft.type === type}
                  onClick={() => setDraft((current) => retype(current, type))}
                  className={`relative h-8 flex-[1_1_90px] rounded-[6px] text-[11px] font-medium tracking-[0.12em] uppercase transition-colors duration-fast ease-dadi ${
                    draft.type === type ? "text-sage-deep" : "text-ink-ghost hover:text-sage-deep"
                  }`}
                >
                  {draft.type === type ? <SelectionMark group="chaavi-editor-type" className="rounded-[6px] bg-sage-active shadow-[var(--shadow)]" /> : null}
                  <span className="relative">{TYPE_META[type].one}</span>
                </button>
              ))}
            </div>
          ) : null}

          <Grid>
            <Labelled label="Name">
              <input
                className={FIELD}
                value={draft.name}
                onChange={(event) => update((next) => void (next.name = event.target.value))}
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </Labelled>
            <Labelled label="Folder">
              <select
                className={FIELD}
                value={draft.folderId ?? ""}
                onChange={(event) => update((next) => void (next.folderId = event.target.value || null))}
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </Labelled>
          </Grid>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={draft.type}
              className="flex flex-col gap-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12, ease: EASE } }}
              transition={{ duration: SLOW_S, ease: EASE }}
            >
              <TypeFields draft={draft} editing={editing} update={update} reveal={reveal} generate={generate} />
            </motion.div>
          </AnimatePresence>

          <CustomFields draft={draft} editing={editing} update={update} reveal={reveal} />

          <Labelled label="Notes" group>
            {editing && draft.notesStored && !draft.notes.dirty && draft.notes.value === "" ? (
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-dashed border-sage-line/80 bg-bone/30 px-3 py-2.5">
                <span className="text-[13px] text-ink-ghost">Stored notes stay as they are.</span>
                <button
                  type="button"
                  className={`${SMALL_ACT} h-7`}
                  onClick={() => reveal({ field: "notes" }, (next, value) => void (next.notes = { value, dirty: false }))}
                >
                  Reveal to edit
                </button>
              </div>
            ) : (
              <textarea
                className={`${FIELD} min-h-[84px] resize-y`}
                value={draft.notes.value}
                onChange={(event) => update((next) => void (next.notes = { value: event.target.value, dirty: true }))}
                placeholder={draft.type === "note" ? "The note" : "Anything else worth keeping"}
              />
            )}
          </Labelled>

          {draft.type === "note" && !editing ? (
            <p className="text-[12px] leading-relaxed text-ink-ghost">
              For a secret an agent fills, name the note for the secret and add a hidden field called Secret.
            </p>
          ) : null}

          {(tried && problem) || error || actionError ? (
            <p className="text-[12px] text-error">{(tried ? problem : null) ?? error ?? actionError}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending || (tried && problem !== null)}
            className="rounded-[var(--radius)] bg-sage-deep px-3 py-2.5 text-[12px] font-medium tracking-[2px] text-bone uppercase transition-opacity duration-slow ease-dadi hover:bg-sage disabled:opacity-40"
          >
            {pending ? "Saving…" : editing ? "Save changes" : `Create ${TYPE_META[draft.type].one.toLowerCase()}`}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

/** Edits a draft in place. */
type Update = (fn: (next: ItemDraft) => void) => void;

/** Reveals a stored secret into the draft. */
type Reveal = (request: ChaaviReveal, apply: (next: ItemDraft, value: string) => void) => void;

type SectionProps = {
  draft: ItemDraft;
  editing: boolean;
  update: Update;
  reveal: Reveal;
};

type TypeFieldsProps = SectionProps & {
  /** Fill the password with a generated one. */
  generate: () => void;
};

/** The fields of the draft's item type. */
function TypeFields({ draft, editing, update, reveal, generate }: TypeFieldsProps) {
  if (draft.type === "login") {
    return (
      <>
        <Grid>
          <Labelled label="Username">
            <input
              className={FIELD}
              value={draft.login.username}
              onChange={(event) => update((next) => void (next.login.username = event.target.value))}
              autoComplete="off"
              spellCheck={false}
            />
          </Labelled>
          <Labelled label="Password">
            <SecretInput
              secret={draft.login.password}
              stored={editing}
              placeholder={editing ? "Stored · leave blank to keep" : "Leave blank to generate"}
              onChange={(value) => update((next) => void (next.login.password = value))}
              {...(editing ? { onReveal: () => reveal({ field: "password" }, (next, value) => void (next.login.password = { value, dirty: false })) } : {})}
              extra={
                <button type="button" className={SMALL_ACT} onClick={generate}>
                  Generate
                </button>
              }
            />
          </Labelled>
        </Grid>
        <Labelled label="Authenticator key">
          <SecretInput
            secret={draft.login.totp}
            stored={editing}
            placeholder={editing ? "Stored · leave blank to keep" : "otpauth:// URI or base32 key"}
            onChange={(value) => update((next) => void (next.login.totp = value))}
            {...(editing ? { onReveal: () => reveal({ field: "totp" }, (next, value) => void (next.login.totp = { value, dirty: false })) } : {})}
          />
        </Labelled>
        <Labelled label="Websites" group>
          <div className="flex flex-col gap-2">
            {draft.login.uris.map((entry, i) => (
              <div key={entry.key} className="flex flex-wrap gap-2">
                <input
                  className={`${FIELD} flex-[3_1_220px]`}
                  value={entry.uri}
                  placeholder="https://"
                  aria-label={`Website ${i + 1}`}
                  onChange={(event) => update((next) => void (next.login.uris[i]!.uri = event.target.value))}
                  spellCheck={false}
                />
                <select
                  className={`${FIELD} flex-[1_1_140px]`}
                  aria-label={`Website ${i + 1} match`}
                  value={entry.match}
                  onChange={(event) =>
                    update((next) => void (next.login.uris[i]!.match = event.target.value as (typeof URI_MATCHES)[number]["id"]))
                  }
                >
                  {URI_MATCHES.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.label}
                    </option>
                  ))}
                </select>
                <RemoveButton label={`Remove website ${i + 1}`} onClick={() => update((next) => void next.login.uris.splice(i, 1))} />
              </div>
            ))}
            <div>
              <button
                type="button"
                className={CHIP}
                onClick={() => update((next) => void next.login.uris.push({ key: draftKey(), uri: "", match: "default" }))}
              >
                + Website
              </button>
            </div>
          </div>
        </Labelled>
      </>
    );
  }
  if (draft.type === "card") {
    return (
      <>
        <Grid>
          <Labelled label="Cardholder">
            <input className={FIELD} value={draft.card.cardholderName} onChange={(event) => update((next) => void (next.card.cardholderName = event.target.value))} />
          </Labelled>
          <Labelled label="Brand">
            <select className={FIELD} value={draft.card.brand} onChange={(event) => update((next) => void (next.card.brand = event.target.value))}>
              <option value="">—</option>
              {BRANDS.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </Labelled>
        </Grid>
        <Labelled label="Number">
          <SecretInput
            secret={draft.card.number}
            stored={editing}
            mono
            placeholder={editing ? "Stored · leave blank to keep" : "•••• •••• •••• ••••"}
            onChange={(value) => update((next) => void (next.card.number = value))}
            {...(editing ? { onReveal: () => reveal({ field: "number" }, (next, value) => void (next.card.number = { value, dirty: false })) } : {})}
          />
        </Labelled>
        <Grid>
          <Labelled label="Expiry month">
            <select className={FIELD} value={draft.card.expMonth} onChange={(event) => update((next) => void (next.card.expMonth = event.target.value))}>
              <option value="">—</option>
              {MONTHS.map((month, i) => (
                <option key={month} value={String(i + 1)}>
                  {String(i + 1).padStart(2, "0")} · {month}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label="Expiry year">
            <input
              className={`${FIELD} font-numeric`}
              inputMode="numeric"
              maxLength={4}
              placeholder="YYYY"
              value={draft.card.expYear}
              onChange={(event) => update((next) => void (next.card.expYear = event.target.value.replace(/\D/g, "")))}
            />
          </Labelled>
          <Labelled label="Security code">
            <SecretInput
              secret={draft.card.code}
              stored={editing}
              mono
              placeholder={editing ? "Stored · blank keeps it" : "•••"}
              onChange={(value) => update((next) => void (next.card.code = value))}
              {...(editing ? { onReveal: () => reveal({ field: "code" }, (next, value) => void (next.card.code = { value, dirty: false })) } : {})}
            />
          </Labelled>
        </Grid>
      </>
    );
  }
  if (draft.type === "identity") {
    const text = (label: string, key: Exclude<keyof ItemDraft["identity"], "ssn" | "passportNumber" | "licenseNumber">) => (
      <Labelled key={key} label={label}>
        <input className={FIELD} value={draft.identity[key]} onChange={(event) => update((next) => void (next.identity[key] = event.target.value))} />
      </Labelled>
    );
    const secret = (label: string, key: "ssn" | "passportNumber" | "licenseNumber") => (
      <Labelled key={key} label={label}>
        <SecretInput
          secret={draft.identity[key]}
          stored={editing}
          mono
          placeholder={editing ? "Stored · leave blank to keep" : ""}
          onChange={(value) => update((next) => void (next.identity[key] = value))}
          {...(editing ? { onReveal: () => reveal({ field: key }, (next, value) => void (next.identity[key] = { value, dirty: false })) } : {})}
        />
      </Labelled>
    );
    return (
      <>
        <Grid>
          {text("Title", "title")}
          {text("First name", "firstName")}
          {text("Middle name", "middleName")}
          {text("Last name", "lastName")}
          {text("Company", "company")}
          {text("Email", "email")}
          {text("Phone", "phone")}
          {text("Username", "username")}
        </Grid>
        <Grid>
          {text("Address 1", "address1")}
          {text("Address 2", "address2")}
          {text("Address 3", "address3")}
          {text("City", "city")}
          {text("State", "state")}
          {text("Postal code", "postalCode")}
          {text("Country", "country")}
        </Grid>
        <Grid>
          {secret("Social Security number", "ssn")}
          {secret("Passport number", "passportNumber")}
          {secret("License number", "licenseNumber")}
        </Grid>
      </>
    );
  }
  if (draft.type === "sshKey") {
    return (
      <>
        <Labelled label="Private key">
          <SecretInput
            secret={draft.sshKey.privateKey}
            stored={editing}
            mono
            multiline
            placeholder={editing ? "Stored · leave blank to keep" : "Leave blank to generate an Ed25519 key, or paste one"}
            onChange={(value) => update((next) => void (next.sshKey.privateKey = value))}
            {...(editing ? { onReveal: () => reveal({ field: "privateKey" }, (next, value) => void (next.sshKey.privateKey = { value, dirty: false })) } : {})}
          />
        </Labelled>
        <Grid>
          <Labelled label="Public key">
            <input
              className={`${FIELD} font-numeric`}
              value={draft.sshKey.publicKey}
              placeholder="ssh-ed25519 …"
              spellCheck={false}
              onChange={(event) => update((next) => void (next.sshKey.publicKey = event.target.value))}
            />
          </Labelled>
          <Labelled label="Fingerprint">
            <input
              className={`${FIELD} font-numeric`}
              value={draft.sshKey.keyFingerprint}
              placeholder="SHA256:…"
              spellCheck={false}
              onChange={(event) => update((next) => void (next.sshKey.keyFingerprint = event.target.value))}
            />
          </Labelled>
        </Grid>
      </>
    );
  }
  if (isFlatType(draft.type)) {
    const spec = FLAT_FIELDS[draft.type];
    return (
      <>
        <Grid>
          {spec.text.map((field) => (
            <Labelled key={field.key} label={field.label}>
              <input
                className={FIELD}
                type={/date/i.test(field.key) ? "date" : "text"}
                value={draft.flat[field.key]}
                onChange={(event) => update((next) => void (next.flat[field.key] = event.target.value))}
                spellCheck={false}
              />
            </Labelled>
          ))}
        </Grid>
        <Grid>
          {spec.secret.map((field) => (
            <Labelled key={field.key} label={field.label}>
              <SecretInput
                secret={draft.flatSecrets[field.key]!}
                stored={editing}
                mono
                placeholder={editing ? "Stored · leave blank to keep" : ""}
                onChange={(value) => update((next) => void (next.flatSecrets[field.key] = value))}
                {...(editing
                  ? { onReveal: () => reveal({ field: field.key }, (next, value) => void (next.flatSecrets[field.key] = { value, dirty: false })) }
                  : {})}
              />
            </Labelled>
          ))}
        </Grid>
      </>
    );
  }
  return null;
}

/** Custom fields of every kind, each removable, with a row of add buttons. */
function CustomFields({ draft, editing, update, reveal }: SectionProps) {
  const targets = LINK_TARGETS[draft.type];
  const add = (type: FieldDraft["type"]) =>
    update((next) =>
      void next.fields.push({
        key: draftKey(),
        name: "",
        type,
        value: { value: "", dirty: type === "text" },
        bool: false,
        linkedTo: null,
        storedAs: null,
      }),
    );
  return (
    <Labelled label="Custom fields" group>
      <div className="flex flex-col gap-2">
        {draft.fields.map((field, i) => {
          const storedAs = field.storedAs;
          return (
          <div key={field.key} className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 min-w-[74px] items-center justify-center rounded-full bg-sage-faint px-2.5 text-[10px] font-medium tracking-[0.1em] text-sage-deep uppercase">
              {field.type}
            </span>
            <input
              className={`${FIELD} flex-[1_1_140px]`}
              value={field.name}
              placeholder="Field name"
              aria-label={`Field ${i + 1} name`}
              onChange={(event) => update((next) => void (next.fields[i]!.name = event.target.value))}
            />
            <div className="flex-[2_1_200px]">
              {field.type === "text" ? (
                <input
                  className={FIELD}
                  value={field.value.value}
                  aria-label={`Field ${i + 1} value`}
                  onChange={(event) => update((next) => void (next.fields[i]!.value = { value: event.target.value, dirty: true }))}
                />
              ) : field.type === "hidden" ? (
                <SecretInput
                  secret={field.value}
                  stored={storedAs !== null}
                  mono
                  placeholder={storedAs !== null ? "Stored · leave blank to keep" : "Hidden value"}
                  onChange={(value) => update((next) => void (next.fields[i]!.value = value))}
                  {...(editing && storedAs !== null
                    ? {
                        onReveal: () =>
                          reveal({ field: "custom", name: storedAs }, (next, value) => void (next.fields[i]!.value = { value, dirty: false })),
                      }
                    : {})}
                />
              ) : field.type === "boolean" ? (
                <label className="flex h-9 items-center gap-2 text-[13px] text-ink">
                  <input
                    type="checkbox"
                    checked={field.bool}
                    onChange={(event) => update((next) => void (next.fields[i]!.bool = event.target.checked))}
                    className="size-4 accent-[var(--sage)]"
                  />
                  {field.bool ? "Yes" : "No"}
                </label>
              ) : (
                <select
                  className={FIELD}
                  value={field.linkedTo ?? ""}
                  aria-label={`Field ${i + 1} links to`}
                  onChange={(event) =>
                    update((next) => void (next.fields[i]!.linkedTo = (event.target.value || null) as FieldDraft["linkedTo"]))
                  }
                >
                  <option value="">Links to…</option>
                  {targets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <RemoveButton label={`Remove field ${i + 1}`} onClick={() => update((next) => void next.fields.splice(i, 1))} />
          </div>
          );
        })}
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={CHIP} onClick={() => add("text")}>
            + Text
          </button>
          <button type="button" className={CHIP} onClick={() => add("hidden")}>
            + Hidden
          </button>
          <button type="button" className={CHIP} onClick={() => add("boolean")}>
            + Boolean
          </button>
          <button type="button" className={CHIP} disabled={targets.length === 0} onClick={() => add("linked")}>
            + Linked
          </button>
        </div>
      </div>
    </Labelled>
  );
}

type SecretInputProps = {
  secret: SecretDraft;
  /** A value is stored, so blank means keep it. */
  stored: boolean;
  placeholder: string;
  mono?: boolean;
  /** A textarea, for a private key. */
  multiline?: boolean;
  onChange: (next: SecretDraft) => void;
  /** Load the stored value to edit it; absent when nothing is stored. */
  onReveal?: () => void;
  /** Another action beside Show, e.g. Generate. */
  extra?: ReactNode;
};

/** A masked secret field with Show, and Reveal when a value is stored. Typing marks it changed. */
function SecretInput({ secret, stored, placeholder, mono = false, multiline = false, onChange, onReveal, extra }: SecretInputProps) {
  const [visible, setVisible] = useState(false);
  const loaded = secret.value !== "" || secret.dirty;
  const className = `${FIELD} ${mono ? "font-numeric" : ""}`;
  return (
    <div className="flex gap-2">
      {multiline ? (
        <textarea
          className={`${className} min-h-[96px] resize-y ${visible || !loaded ? "" : "[-webkit-text-security:disc]"}`}
          value={secret.value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(event) => onChange({ value: event.target.value, dirty: true })}
        />
      ) : (
        <input
          className={className}
          type={visible ? "text" : "password"}
          value={secret.value}
          placeholder={placeholder}
          autoComplete="new-password"
          spellCheck={false}
          onChange={(event) => onChange({ value: event.target.value, dirty: true })}
        />
      )}
      {stored && onReveal && !loaded ? (
        <button
          type="button"
          className={SMALL_ACT}
          onClick={() => {
            setVisible(true);
            onReveal();
          }}
        >
          Reveal
        </button>
      ) : (
        <button type="button" className={SMALL_ACT} onClick={() => setVisible((v) => !v)}>
          {visible ? "Hide" : "Show"}
        </button>
      )}
      {extra}
    </div>
  );
}

type LabelledProps = {
  label: string;
  /** Several controls: a named group instead of a `<label>` around one. */
  group?: boolean;
  children: ReactNode;
};

/** A tracking-caps label over its control, or over a group of controls. */
function Labelled({ label, group = false, children }: LabelledProps) {
  const caption = <span className="text-[10px] font-medium tracking-[0.16em] text-ink-ghost uppercase">{label}</span>;
  if (group) {
    return (
      <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-1.5">
        {caption}
        {children}
      </div>
    );
  }
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      {caption}
      {children}
    </label>
  );
}

type GridProps = {
  children: ReactNode;
};

/** Controls side by side, wrapping to one column when narrow. */
function Grid({ children }: GridProps) {
  return <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">{children}</div>;
}

type RemoveButtonProps = {
  label: string;
  onClick: () => void;
};

/** A small × that removes a row. */
function RemoveButton({ label, onClick }: RemoveButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] text-ink-ghost transition-colors duration-fast ease-dadi hover:bg-sage-active hover:text-sage-deep"
    >
      <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden>
        <path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

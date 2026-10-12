/**
 * One vault item, read: every public field with copy, each secret masked until revealed
 * (or copied without showing), the live one-time code, passkeys, custom fields and notes.
 * Revealed values live in this component's state only and go with it.
 */

import { useEffect, useState, type ReactNode } from "react";
import { chaavi } from "../../shared/api";
import { CopyButton } from "../../shared/components/CopyButton";
import { formatRelative } from "../../shared/lib/ux/time";
import type { ChaaviFolder, ChaaviItem, ChaaviReveal, ChaaviTotp } from "../../types/chaavi";
import { FLAT_FIELDS, flatData, fullName, hasKey, isFlatType, LINK_TARGETS, TYPE_META } from "./draft";
import { IconStar, TypeGlyph } from "./icons";

const MASK = "••••••••••••";

/** A text action in a field's header (Reveal, Hide, Open). */
const ACT =
  "text-[10px] font-medium tracking-[0.14em] uppercase text-sage-deep transition-colors duration-fast ease-dadi hover:text-sage disabled:opacity-40";

export type ItemDetailProps = {
  item: ChaaviItem;
  folders: ChaaviFolder[];
  /** A delete or favorite change is in flight. */
  busy: boolean;
  /** The last failed change, from Chaavi. */
  error: string | null;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
};

/** The detail panel's content for one item. Remount it per item so reveals never carry over. */
export function ItemDetail({ item, folders, busy, error, onEdit, onToggleFavorite, onDelete }: ItemDetailProps) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealError, setRevealError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const folder = folders.find((entry) => entry.id === item.folderId);
  const flat = flatData(item);

  async function fetchSecret(request: ChaaviReveal): Promise<string> {
    const { value } = await chaavi.reveal(item.id, request);
    return value;
  }

  function secretProps(key: string, request: ChaaviReveal): SecretRowProps["secret"] {
    const value = revealed[key];
    return {
      shown: value ?? null,
      pending: pendingKey === key,
      onReveal: () => {
        setPendingKey(key);
        setRevealError(null);
        fetchSecret(request)
          .then((next) => setRevealed((current) => ({ ...current, [key]: next })))
          .catch((err: unknown) => setRevealError(err instanceof Error ? err.message : String(err)))
          .finally(() => setPendingKey(null));
      },
      onHide: () =>
        setRevealed((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        }),
      copy: () => (value !== undefined ? Promise.resolve(value) : fetchSecret(request)),
    };
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="flex min-w-0 gap-3.5">
          <span
            className={`inline-flex size-[46px] shrink-0 items-center justify-center rounded-full border ${
              item.type === "card"
                ? "border-[color-mix(in_srgb,var(--clay)_60%,transparent)] bg-[color-mix(in_srgb,var(--clay)_14%,var(--bone))] text-[var(--clay)]"
                : "border-sage-line bg-bone text-sage-deep"
            }`}
          >
            <TypeGlyph type={item.type} size={20} />
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-medium tracking-[0.16em] text-sage-deep uppercase">{TYPE_META[item.type].one}</span>
            <h2 className="mt-1 mb-2 text-[22px] font-medium tracking-tight text-balance text-ink">{item.name}</h2>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex h-6 items-center rounded-full bg-sage-faint px-2.5 text-[11px] text-sage-deep">
                {folder ? folder.name : "No folder"}
              </span>
              {item.revisionDate ? (
                <span className="inline-flex h-6 items-center rounded-full border border-dashed border-sage-line px-2.5 text-[11px] text-ink-muted">
                  Edited {formatRelative(item.revisionDate)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label={item.favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={item.favorite}
          disabled={busy}
          onClick={onToggleFavorite}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-[7px] border border-dashed border-sage-line bg-[var(--glass-sheet)] text-[var(--clay)] shadow-[var(--shadow)] transition-[border-color,background-color] duration-slow ease-dadi hover:border-sage hover:bg-sage-active/50 disabled:opacity-40"
        >
          <IconStar filled={item.favorite} />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 border-t border-dashed border-sage-line px-5 pt-4 pb-5">
        {item.type === "login" ? (
          <>
            <PlainRow label="Username" value={item.login.username} />
            {item.login.hasPassword ? (
              <SecretRow label="Password" mono secret={secretProps("password", { field: "password" })} />
            ) : null}
            {item.login.hasTotp ? <TotpRow itemId={item.id} /> : null}
            {item.login.uris.map((entry, i) => (
              <PlainRow key={`${entry.uri}-${i}`} label={i === 0 ? "Website" : `Website ${i + 1}`} value={entry.uri} link />
            ))}
            {item.login.passkeys.length > 0 ? (
              <Section label="Passkeys">
                {item.login.passkeys.map((passkey, i) => (
                  <div
                    key={`${passkey.rpId}-${i}`}
                    className="flex items-center gap-2.5 rounded-[var(--radius)] border border-dashed border-sage-line/80 bg-bone/30 px-3 py-2"
                  >
                    <span className="flex-1 truncate text-[13px] text-ink">{passkey.rpId}</span>
                    <span className="truncate text-[12px] text-ink-ghost">{passkey.userName ?? ""}</span>
                  </div>
                ))}
              </Section>
            ) : null}
          </>
        ) : null}

        {item.type === "card" ? (
          <>
            <PlainRow label="Cardholder" value={item.card.cardholderName} />
            <PlainRow label="Brand" value={item.card.brand} />
            {item.card.hasNumber ? (
              <SecretRow label="Number" mono mask="•••• •••• •••• ••••" secret={secretProps("number", { field: "number" })} />
            ) : null}
            <PlainRow
              label="Expires"
              mono
              value={item.card.expMonth && item.card.expYear ? `${item.card.expMonth.padStart(2, "0")} / ${item.card.expYear}` : null}
            />
            {item.card.hasCode ? (
              <SecretRow label="Security code" mono mask="•••" secret={secretProps("code", { field: "code" })} />
            ) : null}
          </>
        ) : null}

        {item.type === "identity" ? (
          <>
            <PlainRow label="Name" value={[item.identity.title, fullName(item)].filter(Boolean).join(" ") || null} />
            <PlainRow label="Company" value={item.identity.company} />
            <PlainRow label="Email" value={item.identity.email} />
            <PlainRow label="Phone" value={item.identity.phone} mono />
            <PlainRow label="Username" value={item.identity.username} />
            <PlainRow label="Address" value={identityAddress(item)} />
            {item.identity.hasSsn ? (
              <SecretRow label="Social Security number" mono mask="•••-••-••••" secret={secretProps("ssn", { field: "ssn" })} />
            ) : null}
            {item.identity.hasPassportNumber ? (
              <SecretRow label="Passport number" mono secret={secretProps("passport", { field: "passportNumber" })} />
            ) : null}
            {item.identity.hasLicenseNumber ? (
              <SecretRow label="License number" mono secret={secretProps("license", { field: "licenseNumber" })} />
            ) : null}
          </>
        ) : null}

        {item.type === "sshKey" ? (
          <>
            <PlainRow label="Public key" value={item.sshKey.publicKey} mono />
            <PlainRow label="Fingerprint" value={item.sshKey.keyFingerprint} mono />
            {item.sshKey.hasPrivateKey ? (
              <SecretRow
                label="Private key"
                mono
                mask={`-----BEGIN OPENSSH PRIVATE KEY-----\n${MASK}${MASK}\n-----END OPENSSH PRIVATE KEY-----`}
                secret={secretProps("privateKey", { field: "privateKey" })}
              />
            ) : null}
          </>
        ) : null}

        {flat !== null && isFlatType(item.type) ? (
          <>
            {FLAT_FIELDS[item.type].text.map((field) => {
              const value = flat[field.key];
              return <PlainRow key={field.key} label={field.label} value={typeof value === "string" ? value : null} />;
            })}
            {FLAT_FIELDS[item.type].secret.map((field) =>
              flat[hasKey(field.key)] === true ? (
                <SecretRow key={field.key} label={field.label} mono secret={secretProps(field.key, { field: field.key })} />
              ) : null,
            )}
          </>
        ) : null}

        {item.fields.length > 0 ? (
          <Section label="Custom fields">
            {item.fields.map((field, i) => {
              const key = `${field.name}-${i}`;
              if (field.type === "hidden") {
                return field.hasValue ? (
                  <SecretRow key={key} label={field.name} kind="Hidden" mono secret={secretProps(`field:${field.name}`, { field: "custom", name: field.name })} />
                ) : (
                  <PlainRow key={key} label={field.name} kind="Hidden" value={null} />
                );
              }
              if (field.type === "boolean") {
                return (
                  <Field key={key} label={field.name} kind="Boolean">
                    <p className="flex items-center gap-2 text-[14px] text-ink">
                      <span
                        aria-hidden
                        className={`relative inline-block h-[15px] w-[26px] rounded-full border ${
                          field.value ? "border-sage bg-sage" : "border-sage-line"
                        }`}
                      >
                        <span
                          className={`absolute top-[2px] size-[9px] rounded-full ${field.value ? "left-[13px] bg-bone" : "left-[2px] bg-sage-line"}`}
                        />
                      </span>
                      {field.value ? "Yes" : "No"}
                    </p>
                  </Field>
                );
              }
              if (field.type === "linked") {
                const target = LINK_TARGETS[item.type].find((entry) => entry.id === field.linkedTo);
                return (
                  <Field key={key} label={field.name} kind="Linked">
                    <p className="text-[14px] text-ink">Linked to {target ? target.label : field.linkedTo}</p>
                  </Field>
                );
              }
              return <PlainRow key={key} label={field.name} kind="Text" value={field.value} />;
            })}
          </Section>
        ) : null}

        {item.hasNotes ? (
          <SecretRow label="Notes" mask="Hidden until revealed" secret={secretProps("notes", { field: "notes" })} />
        ) : null}

        {revealError || error ? <p className="text-[12px] text-error">{revealError ?? error}</p> : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-dashed border-sage-line pt-4">
          <button type="button" onClick={onEdit} className={DASH}>
            Edit
          </button>
          {confirming ? (
            <>
              <span className="text-[12px] text-ink-muted">Move to the vault's trash?</span>
              <button type="button" disabled={busy} onClick={onDelete} className={DASH_DANGER}>
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={DASH}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={DASH_DANGER}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Dashed sage action button. */
export const DASH =
  "inline-flex h-9 items-center gap-1.5 rounded-[7px] border border-dashed border-sage-line bg-[var(--glass-sheet)] px-3 text-[11px] font-medium tracking-[0.14em] whitespace-nowrap text-sage-deep uppercase shadow-[var(--shadow)] transition-[border-color,background-color] duration-slow ease-dadi hover:border-sage hover:bg-sage-active/50 disabled:cursor-default disabled:opacity-40";

/** Dashed action button for a destructive step. */
export const DASH_DANGER =
  "inline-flex h-9 items-center rounded-[7px] border border-dashed border-error-line bg-error-fill/40 px-3 text-[11px] font-medium tracking-[0.14em] text-error uppercase transition-[border-color] duration-slow ease-dadi hover:border-error disabled:opacity-40";

/** Address lines, city/state/postal code and country, one per line. */
function identityAddress(item: ChaaviItem): string | null {
  if (item.type !== "identity") {
    return null;
  }
  const id = item.identity;
  const locality = [id.city, [id.state, id.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const lines = [id.address1, id.address2, id.address3, locality, id.country].filter((line): line is string => Boolean(line));
  return lines.length > 0 ? lines.join("\n") : null;
}

type SectionProps = {
  label: string;
  children: ReactNode;
};

/** A labelled group of rows under the item's own fields. */
function Section({ label, children }: SectionProps) {
  return (
    <div className="mt-2 flex flex-col gap-2.5">
      <span className="text-[10px] font-medium tracking-[0.16em] text-ink-ghost uppercase">{label}</span>
      {children}
    </div>
  );
}

type FieldProps = {
  label: string;
  /** Custom field kind shown beside the label. */
  kind?: string;
  /** Header actions on the right. */
  actions?: ReactNode;
  children: ReactNode;
};

/** One labelled value box in the house's dashed sage. */
function Field({ label, kind, actions, children }: FieldProps) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-sage-line/80 bg-bone/30 px-3 py-2.5">
      <div className="mb-1.5 flex min-h-6 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[10px] font-medium tracking-[0.16em] text-sage-deep uppercase">{label}</span>
          {kind ? <span className="text-[9px] font-medium tracking-[0.1em] text-ink-ghost uppercase">{kind}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">{actions}</span>
      </div>
      {children}
    </div>
  );
}

type PlainRowProps = {
  label: string;
  value: string | null;
  kind?: string;
  mono?: boolean;
  /** The value is a website to open. */
  link?: boolean;
};

/** A public value with copy; a missing one reads as a dash. */
function PlainRow({ label, value, kind, mono = false, link = false }: PlainRowProps) {
  if (value === null && !kind) {
    return null;
  }
  return (
    <Field
      label={label}
      {...(kind ? { kind } : {})}
      actions={
        value !== null ? (
          <>
            {link ? (
              <a href={value} target="_blank" rel="noreferrer" className={ACT}>
                Open
              </a>
            ) : null}
            <CopyButton text={value} label={`Copy ${label.toLowerCase()}`} />
          </>
        ) : null
      }
    >
      <p className={`text-[14px] break-words whitespace-pre-wrap ${value === null ? "text-ink-ghost" : "text-ink"} ${mono ? "font-numeric tracking-wide" : ""}`}>
        {value ?? "—"}
      </p>
    </Field>
  );
}

type SecretRowProps = {
  label: string;
  kind?: string;
  mono?: boolean;
  /** What stands in for the value until it is revealed. */
  mask?: string;
  secret: {
    /** The revealed value, or null while hidden. */
    shown: string | null;
    pending: boolean;
    onReveal: () => void;
    onHide: () => void;
    /** The value for the clipboard, revealed on demand when hidden. */
    copy: () => Promise<string>;
  };
};

/** A secret: masked until Reveal, copyable without showing it. */
function SecretRow({ label, kind, mono = false, mask = MASK, secret }: SecretRowProps) {
  return (
    <Field
      label={label}
      {...(kind ? { kind } : {})}
      actions={
        <>
          <button
            type="button"
            disabled={secret.pending}
            onClick={secret.shown === null ? secret.onReveal : secret.onHide}
            className={ACT}
          >
            {secret.pending ? "…" : secret.shown === null ? "Reveal" : "Hide"}
          </button>
          <CopyButton text={secret.copy} label={`Copy ${label.toLowerCase()}`} />
        </>
      }
    >
      <p
        className={`text-[14px] break-all whitespace-pre-wrap ${
          secret.shown === null ? "tracking-[0.12em] text-ink-faint" : "text-ink"
        } ${mono ? "font-numeric" : ""}`}
      >
        {secret.shown ?? mask}
      </p>
    </Field>
  );
}

type TotpRowProps = {
  itemId: string;
};

/**
 * A login's one-time code: hidden until revealed, then live, with a bar running down to
 * the next code and a fresh fetch when it turns over.
 */
function TotpRow({ itemId }: TotpRowProps) {
  const [totp, setTotp] = useState<(ChaaviTotp & { at: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = () => {
    setError(null);
    setLoading(true);
    chaavi
      .getTotp(itemId)
      .then((next) => {
        setTotp({ ...next, at: Date.now() });
        setNow(Date.now());
      })
      .catch((err: unknown) => {
        setTotp(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  };

  const left = totp ? Math.max(0, totp.remaining - Math.floor((now - totp.at) / 1000)) : 0;

  useEffect(() => {
    if (!totp) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [totp]);

  useEffect(() => {
    if (totp && left === 0 && !loading) {
      load();
    }
  });

  const code = totp ? `${totp.code.slice(0, Math.ceil(totp.code.length / 2))} ${totp.code.slice(Math.ceil(totp.code.length / 2))}` : "••• •••";

  return (
    <Field
      label="One-time code"
      actions={
        <>
          <button type="button" disabled={loading} onClick={totp ? () => setTotp(null) : load} className={ACT}>
            {loading && !totp ? "…" : totp ? "Hide" : "Reveal"}
          </button>
          <CopyButton
            text={() => (totp ? Promise.resolve(totp.code) : chaavi.getTotp(itemId).then((next) => next.code))}
            label="Copy one-time code"
          />
        </>
      }
    >
      <p className={`font-numeric text-[22px] tracking-[0.12em] ${totp ? "text-ink" : "text-ink-faint"}`}>{code}</p>
      {totp ? (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-rule">
            <span
              className="block h-full bg-sage transition-[width] duration-1000 ease-linear"
              style={{ width: `${(left / totp.period) * 100}%` }}
            />
          </span>
          <span className="font-numeric text-[11px] text-ink-ghost">{left}s</span>
        </div>
      ) : null}
      {error ? <p className="mt-1 text-[12px] text-error">{error}</p> : null}
    </Field>
  );
}

/**
 * One vault item, read: every public field with copy, each secret masked until revealed
 * (or copied without showing), the live one-time code, passkeys, custom fields and notes.
 * Revealed values live in this component's state only and go with it.
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { chaavi } from "../../shared/api";
import { CopyButton } from "../../shared/components/CopyButton";
import { confirmOwner, ownerConfirmedRecently } from "../../shared/lib/platform/owner";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { formatRelative } from "../../shared/lib/ux/time";
import type { ChaaviFolder, ChaaviItem, ChaaviReveal, ChaaviTotp } from "../../types/chaavi";
import { FLAT_FIELDS, flatData, fullName, hasKey, isFlatType, LINK_TARGETS, TYPE_META } from "./draft";
import { IconExternal, IconEye, IconEyeOff, IconPencil, IconSpinner, IconStar, IconTrash } from "./icons";
import { Monogram } from "./vault";

const MASK = "••••••••••••";

/**
 * How the item's header and each field arrive when the pane opens: they rise into place one
 * after another, following the pane's `enter` / `center` labels.
 */
const RISE = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0, transition: { duration: SLOW_S, ease: EASE } },
};

/** The field column passes the pane's labels down one field at a time. */
const STAGGER = {
  center: { transition: { staggerChildren: 0.028 } },
};

/** A secret's value as it changes between mask and plain text: it sharpens out of a blur. */
const UNVEIL = {
  initial: { opacity: 0, filter: "blur(6px)" },
  animate: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(6px)" },
  transition: { duration: 0.2, ease: EASE },
} as const;

/** A field header action (Reveal, Hide, Open): a small outlined button of fixed width. */
const ACT =
  "inline-flex h-7 items-center justify-center gap-1.5 rounded-[9px] bg-sage-fill px-2.5 text-[12px] font-semibold whitespace-nowrap text-sage-text transition-[background-color,transform] duration-fast ease-dadi hover:bg-sage-active active:scale-[0.97] disabled:cursor-progress";

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
    await confirmOwner(`show a secret from ${item.name}`);
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
      <motion.header variants={RISE} className="flex items-start justify-between gap-4 px-5 pt-3.5 pb-4">
        <div className="flex min-w-0 gap-3.5">
          <Monogram name={item.name} className="size-[46px] rounded-[14px] text-[19px]" />
          <div className="min-w-0">
            <span className="text-[12.5px] text-ink-ghost">{TYPE_META[item.type].one}</span>
            <h2 className="mt-1 mb-2 text-[22px] font-medium tracking-tight text-balance text-ink">{item.name}</h2>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex h-6 items-center rounded-full bg-sage-faint px-2.5 text-[11px] text-sage-deep">
                {folder ? folder.name : "No folder"}
              </span>
              {item.revisionDate ? (
                <span className="inline-flex h-6 items-center rounded-full bg-sage-fill px-2.5 text-[11.5px] text-sage-text">
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
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--clay)] transition-[background-color] duration-slow ease-dadi hover:bg-sage-fill disabled:opacity-40"
        >
          <motion.span
            key={String(item.favorite)}
            className="inline-flex"
            initial={{ scale: 0.6, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ duration: SLOW_S, ease: EASE }}>
            <IconStar filled={item.favorite} />
          </motion.span>
        </button>
      </motion.header>

      <motion.div variants={STAGGER} className="flex flex-1 flex-col gap-2.5 px-5 pt-2 pb-5">
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
                    className="flex items-center gap-2.5 rounded-[14px] border border-(--glass-border) bg-(--glass-sheet) px-3.5 py-2.5"
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

        <motion.div variants={RISE} className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <button type="button" onClick={onEdit} className={DASH}>
            <IconPencil />
            Edit
          </button>
          {confirming ? (
            <>
              <span className="text-[12px] text-ink-muted">Move to the vault's trash?</span>
              <button type="button" disabled={busy} onClick={onDelete} className={DASH_DANGER}>
                {busy ? <IconSpinner /> : <IconTrash />}
                {busy ? "Deleting" : "Delete"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className={DASH}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={DASH_DANGER}>
              <IconTrash />
              Delete
            </button>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Dashed sage action button. */
export const DASH =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-sage-fill px-4 text-[13px] font-semibold whitespace-nowrap text-sage-text transition-[background-color] duration-slow ease-dadi hover:bg-sage-active disabled:cursor-default disabled:opacity-40";

/** Dashed action button for a destructive step. */
export const DASH_DANGER =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-error transition-[background-color] duration-slow ease-dadi hover:bg-error-fill disabled:opacity-40";

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
      <motion.span variants={RISE} className="px-1 pt-1 text-[11.5px] font-semibold text-ink-ghost">
        {label}
      </motion.span>
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
    <motion.div variants={RISE} className="rounded-[14px] border border-(--glass-border) bg-(--glass-sheet) px-3.5 py-3">
      <div className="mb-1.5 flex min-h-6 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[11.5px] font-semibold text-ink-ghost">{label}</span>
          {kind ? <span className="text-[11px] text-ink-ghost">{kind}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">{actions}</span>
      </div>
      {children}
    </motion.div>
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
                <IconExternal />
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
            {secret.pending ? <IconSpinner /> : secret.shown === null ? <IconEye /> : <IconEyeOff />}
            {secret.shown === null ? "Reveal" : "Hide"}
          </button>
          <CopyButton text={secret.copy} label={`Copy ${label.toLowerCase()}`} />
        </>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={secret.shown === null ? "masked" : "shown"}
          {...UNVEIL}
          className={`text-[14px] break-all whitespace-pre-wrap ${
            secret.shown === null ? "tracking-[0.12em] text-ink-faint" : "text-ink"
          } ${mono ? "font-numeric" : ""}`}
        >
          {secret.shown === null ? mask : secret.shown}
        </motion.p>
      </AnimatePresence>
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
    confirmOwner("show a one-time code")
      .then(() => chaavi.getTotp(itemId))
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
      if (ownerConfirmedRecently()) {
        load();
      } else {
        setTotp(null);
      }
    }
  });

  const code = totp ? `${totp.code.slice(0, Math.ceil(totp.code.length / 2))} ${totp.code.slice(Math.ceil(totp.code.length / 2))}` : "••• •••";

  return (
    <Field
      label="One-time code"
      actions={
        <>
          <button type="button" disabled={loading} onClick={totp ? () => setTotp(null) : load} className={ACT}>
            {loading && !totp ? <IconSpinner /> : totp ? <IconEyeOff /> : <IconEye />}
            {totp ? "Hide" : "Reveal"}
          </button>
          <CopyButton
            text={() => (totp ? Promise.resolve(totp.code) : chaavi.getTotp(itemId).then((next) => next.code))}
            label="Copy one-time code"
          />
        </>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={code}
          {...UNVEIL}
          className={`font-numeric text-[22px] tracking-[0.12em] ${totp ? "text-ink" : "text-ink-faint"}`}
        >
          {code}
        </motion.p>
      </AnimatePresence>
      {totp ? (
        <motion.div
          className="mt-1.5 flex items-center gap-2"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: SLOW_S, ease: EASE }}
        >
          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-rule">
            <span
              className="block h-full bg-sage transition-[width] duration-1000 ease-linear"
              style={{ width: `${(left / totp.period) * 100}%` }}
            />
          </span>
          <span className="font-numeric text-[11px] text-ink-ghost">{left}s</span>
        </motion.div>
      ) : null}
      {error ? <p className="mt-1 text-[12px] text-error">{error}</p> : null}
    </Field>
  );
}

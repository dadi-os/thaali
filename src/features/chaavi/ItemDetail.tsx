import { useEffect, useRef, useState, type ReactNode } from "react";
import { chaavi } from "../../shared/api";
import { Button, IconButton } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { useContextActions } from "../../shared/interaction/contextMenu";
import { Truncate } from "../../shared/ui/Truncate";
import { copyText } from "../../shared/desktop/clipboard";
import { confirmOwner } from "../../shared/desktop/owner";
import { openExternal } from "../../shared/desktop/open";
import { formatClock, formatDay } from "../../shared/lib/ux/time";
import { pushToast } from "../../contexts/toasts";
import type { ChaaviFolder, ChaaviItem, ChaaviReveal, ChaaviTotp } from "../../types/chaavi";
import { copySecret } from "./clipboard";
import { FLAT_FIELDS, flatData, fullName, hasKey, isFlatType, LINK_TARGETS, TYPE_META, websiteUrl } from "./draft";
import { Avatar } from "./ItemList";

/** The mono face a code or number is set in. */
const MONO = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace";

/** How long a row says it was copied, in ms. */
const COPIED_MS = 4_000;

/** What a copied secret's row says in place of its value. */
const COPIED_NOTE = "Copied · clears from the clipboard in 30 s";

/** What the toast for a copied secret says under its title. */
const CLEARS_NOTE = "It clears from the clipboard in 30 seconds.";

/** One row of an item, from its public data. A secret never carries its value: it is asked for when the row is revealed or copied. */
type Field =
  | { kind: "plain"; key: string; label: string; value: string; mono?: boolean; copy?: boolean; open?: boolean; note?: string }
  | { kind: "secret"; key: string; label: string; mask: string; request: ChaaviReveal; mono?: boolean; multiline?: boolean; copy?: boolean }
  | { kind: "totp" };

/** A plain row, left out when the item holds nothing for it. */
function plain(key: string, label: string, value: string | null, options: Partial<Extract<Field, { kind: "plain" }>> = {}): Field[] {
  return value === null || value === "" ? [] : [{ kind: "plain", key, label, value, ...options }];
}

/** A secret row, left out when the item holds no such secret. */
function secret(has: boolean, key: string, label: string, request: ChaaviReveal, options: Partial<Extract<Field, { kind: "secret" }>> = {}): Field[] {
  return has ? [{ kind: "secret", key, label, mask: "••••••••", request, mono: true, ...options }] : [];
}

/** An identity's address, one line. */
function identityAddress(item: Extract<ChaaviItem, { type: "identity" }>): string | null {
  const id = item.identity;
  const locality = [id.city, [id.state, id.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const parts = [id.address1, id.address2, id.address3, locality, id.country].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

/** The rows an item draws, in order. */
function fieldsOf(item: ChaaviItem): Field[] {
  const fields: Field[] = [];
  if (item.type === "login") {
    const login = item.login;
    fields.push(...plain("username", "Username", login.username));
    fields.push(...secret(login.hasPassword, "password", "Password", { field: "password" }, { mask: "••••••••••••" }));
    login.uris.forEach((entry, i) => fields.push(...plain(`uri-${i}`, i === 0 ? "Website" : `Website ${i + 1}`, entry.uri, { copy: false, open: true })));
    if (login.hasTotp) {
      fields.push({ kind: "totp" });
    }
    login.passkeys.forEach((passkey, i) =>
      fields.push(
        ...plain(`passkey-${i}`, "Passkey", passkey.userName === null ? passkey.rpId : `${passkey.rpId} · ${passkey.userName}`, {
          copy: false,
          ...(passkey.creationDate === null ? {} : { note: `Created ${formatDay(passkey.creationDate)}` }),
        }),
      ),
    );
  }
  if (item.type === "card") {
    const card = item.card;
    fields.push(...plain("cardholder", "Cardholder", card.cardholderName), ...plain("brand", "Brand", card.brand));
    fields.push(...secret(card.hasNumber, "number", "Number", { field: "number" }, { mask: "•••• •••• •••• ••••" }));
    fields.push(...plain("expires", "Expires", card.expMonth && card.expYear ? `${card.expMonth.padStart(2, "0")} / ${card.expYear}` : null, { mono: true }));
    fields.push(...secret(card.hasCode, "code", "Security code", { field: "code" }, { mask: "•••" }));
  }
  if (item.type === "identity") {
    const id = item.identity;
    fields.push(...plain("name", "Name", [id.title, fullName(item)].filter(Boolean).join(" ") || null), ...plain("company", "Company", id.company), ...plain("email", "Email", id.email));
    fields.push(...plain("phone", "Phone", id.phone, { mono: true }), ...plain("username", "Username", id.username), ...plain("address", "Address", identityAddress(item)));
    fields.push(...secret(id.hasSsn, "ssn", "Social Security number", { field: "ssn" }, { mask: "•••-••-••••" }));
    fields.push(...secret(id.hasPassportNumber, "passport", "Passport number", { field: "passportNumber" }));
    fields.push(...secret(id.hasLicenseNumber, "license", "License number", { field: "licenseNumber" }));
  }
  if (item.type === "sshKey") {
    fields.push(...plain("public", "Public key", item.sshKey.publicKey, { mono: true }), ...plain("fingerprint", "Fingerprint", item.sshKey.keyFingerprint, { mono: true }));
    fields.push(...secret(item.sshKey.hasPrivateKey, "private", "Private key", { field: "privateKey" }, { multiline: true }));
  }
  const flat = flatData(item);
  if (flat !== null && isFlatType(item.type)) {
    for (const field of FLAT_FIELDS[item.type].text) {
      const value = flat[field.key];
      fields.push(...plain(field.key, field.label, typeof value === "string" ? value : null, { mono: field.key === "routingNumber", copy: field.key !== "accountType" }));
    }
    for (const field of FLAT_FIELDS[item.type].secret) {
      fields.push(...secret(flat[hasKey(field.key)] === true, field.key, field.label, { field: field.key }, { mask: field.key === "pin" ? "••••" : "••••••••" }));
    }
  }
  item.fields.forEach((field, i) => {
    const key = `field-${i}`;
    if (field.type === "text") {
      fields.push(...plain(key, field.name, field.value));
    } else if (field.type === "hidden") {
      fields.push(...secret(field.hasValue, key, field.name, { field: "custom", name: field.name }));
    } else if (field.type === "boolean") {
      fields.push(...plain(key, field.name, field.value ? "Yes" : "No", { copy: false }));
    } else {
      const target = LINK_TARGETS[item.type].find((entry) => entry.id === field.linkedTo);
      fields.push(...plain(key, field.name, `Linked to ${target ? target.label : field.linkedTo}`, { copy: false }));
    }
  });
  if (item.hasNotes) {
    fields.push({ kind: "secret", key: "notes", label: "Notes", mask: "Hidden until you reveal them", request: { field: "notes" }, copy: false, multiline: true });
  }
  return fields;
}

/** Shows a failure as a toast, since a reveal or a copy that did not happen is something to know. */
function reportFailure(title: string, err: unknown): void {
  pushToast({ key: `chaavi-${title}`, tone: "error", title, body: err instanceof Error ? err.message : String(err) });
}

/** A code split in the middle, as it is read out: `482913` as `482 913`. */
function spacedCode(code: string): string {
  const digits = code.replace(/\s+/g, "");
  const half = Math.ceil(digits.length / 2);
  return `${digits.slice(0, half)} ${digits.slice(half)}`;
}

type FieldRowProps = {
  label: string;
  /** What the row reads: the value, or the mask of a secret not shown. */
  value: string;
  mono?: boolean;
  /** The value may run over several lines, as a note does once shown. */
  multiline?: boolean;
  /** Drawn before the controls, such as the one-time code's countdown or a passkey's date. */
  extra?: ReactNode;
  /** The eye: set when the row holds a secret. */
  reveal?: { shown: boolean; pending: boolean; onToggle: () => void };
  /** The copy control: unset when the row cannot be copied. */
  onCopy?: () => void;
  /** Carried by the website row's open control. */
  onOpen?: () => void;
};

/** One field of an item: its name over its value, with the controls the field has. */
function FieldRow({ label, value, mono = false, multiline = false, extra, reveal, onCopy, onOpen }: FieldRowProps) {
  const name = label.toLowerCase();
  const context = useContextActions(() => [
    ...(onCopy ? [{ id: "copy", label: `Copy ${name}`, icon: "copy" as const, run: onCopy }] : []),
    ...(reveal ? [{ id: "reveal", label: `${reveal.shown ? "Hide" : "Reveal"} ${name}`, icon: "eye" as const, disabledReason: reveal.pending ? "Working" : undefined, run: reveal.onToggle }] : []),
    ...(onOpen ? [{ id: "open", label: "Open website", icon: "link" as const, run: onOpen }] : []),
  ]);
  return (
    <div {...context} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "8px 14px", borderRadius: 14, background: "rgba(250,250,247,.8)", border: "1px solid var(--glass-border)" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 3 }}>
        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{label}</span>
        {multiline ? (
          <span data-selectable style={{ fontSize: 14.5, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value}</span>
        ) : (
          <Truncate selectable text={value} style={mono ? { fontFamily: MONO, fontSize: 13.5, letterSpacing: value.includes("•") ? "2px" : "0" } : { fontSize: 14.5 }} />
        )}
      </div>
      {extra}
      {onOpen ? <IconButton icon="link" label="Open website" onClick={onOpen} /> : null}
      {reveal ? <IconButton icon="eye" label={`${reveal.shown ? "Hide" : "Reveal"} ${name}`} selected={reveal.shown ? true : undefined} disabled={reveal.pending || undefined} onClick={reveal.onToggle} /> : null}
      {onCopy ? <IconButton icon="copy" label={`Copy ${name}`} onClick={onCopy} /> : null}
    </div>
  );
}

type TotpRowProps = {
  itemId: string;
};

/** A login's one-time code: masked until revealed, then live with a ring counting down to the next code, fetched again as it turns over. */
function TotpRow({ itemId }: TotpRowProps) {
  const [totp, setTotp] = useState<(ChaaviTotp & { at: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = () => {
    setLoading(true);
    chaavi
      .getTotp(itemId)
      .then((next) => {
        setTotp({ ...next, at: Date.now() });
        setNow(Date.now());
      })
      .catch((err: unknown) => {
        setTotp(null);
        reportFailure("Couldn't show the one-time code", err);
      })
      .finally(() => setLoading(false));
  };

  const left = totp ? Math.max(0, totp.remaining - Math.floor((now - totp.at) / 1000)) : 0;

  useEffect(() => {
    if (!totp) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [totp]);

  useEffect(() => {
    if (totp && left === 0 && !loading) {
      load();
    }
  });

  const circumference = 2 * Math.PI * 11;
  return (
    <FieldRow
      label="One-time code"
      value={totp ? spacedCode(totp.code) : "••• •••"}
      mono
      extra={
        totp ? (
          <span style={{ position: "relative", width: 28, height: 28, flex: "none" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <circle cx="14" cy="14" r="11" fill="none" stroke="#e8ece2" strokeWidth="3" />
              <circle cx="14" cy="14" r="11" fill="none" stroke="#8fa382" strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference.toFixed(1)} strokeDashoffset={(circumference * (1 - left / totp.period)).toFixed(1)} transform="rotate(-90 14 14)" />
            </svg>
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{left}</span>
          </span>
        ) : undefined
      }
      reveal={{ shown: totp !== null, pending: loading, onToggle: totp ? () => setTotp(null) : load }}
      onCopy={() => {
        (totp ? Promise.resolve(totp.code) : chaavi.getTotp(itemId).then((next) => next.code))
          .then((code) => copySecret(code.replace(/\s+/g, "")))
          .then(() => pushToast({ key: "chaavi-copied-totp", tone: "ok", title: "One-time code copied", body: CLEARS_NOTE }))
          .catch((err: unknown) => reportFailure("Couldn't copy the one-time code", err));
      }}
    />
  );
}

export type ItemDetailProps = {
  item: ChaaviItem;
  folders: ChaaviFolder[];
  /** A favorite or delete change is in flight. */
  busy: boolean;
  onEdit: () => void;
  onToggleFavorite: () => void;
  /** Asks for the delete; the page confirms it. */
  onDelete: () => void;
};

/**
 * One item, read: its mark, name and kind, then every public field with a copy control and each secret masked until the eye shows
 * it or the copy control copies it unseen, after an owner check. Revealed values live in this component's state only. Give it a
 * `key` of the item's id so a reveal never carries over to the next item.
 */
export function ItemDetail({ item, folders, busy, onEdit, onToggleFavorite, onDelete }: ItemDetailProps) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (copiedTimer.current !== null) {
        window.clearTimeout(copiedTimer.current);
      }
    },
    [],
  );

  const folder = folders.find((entry) => entry.id === item.folderId);

  const secretValue = async (request: ChaaviReveal, reason: string): Promise<string> => {
    await confirmOwner(reason);
    return (await chaavi.reveal(item.id, request)).value;
  };

  const toggleReveal = (field: Extract<Field, { kind: "secret" }>) => {
    if (revealed[field.key] !== undefined) {
      setRevealed((current) => {
        const next = { ...current };
        delete next[field.key];
        return next;
      });
      return;
    }
    setPendingKey(field.key);
    secretValue(field.request, `show ${field.label.toLowerCase()} from ${item.name}`)
      .then((value) => setRevealed((current) => ({ ...current, [field.key]: value })))
      .catch((err: unknown) => reportFailure(`Couldn't show ${field.label.toLowerCase()}`, err))
      .finally(() => setPendingKey(null));
  };

  const copySecretField = (field: Extract<Field, { kind: "secret" }>) => {
    (revealed[field.key] !== undefined ? Promise.resolve(revealed[field.key]!) : secretValue(field.request, `copy ${field.label.toLowerCase()} from ${item.name}`))
      .then(copySecret)
      .then(() => {
        pushToast({ key: `chaavi-copied-${field.key}`, tone: "ok", title: `${field.label} copied`, body: CLEARS_NOTE });
        setCopiedKey(field.key);
        if (copiedTimer.current !== null) {
          window.clearTimeout(copiedTimer.current);
        }
        copiedTimer.current = window.setTimeout(() => setCopiedKey(null), COPIED_MS);
      })
      .catch((err: unknown) => reportFailure(`Couldn't copy ${field.label.toLowerCase()}`, err));
  };

  const copyPlainField = (field: Extract<Field, { kind: "plain" }>) => {
    copyText(field.value)
      .then(() => pushToast({ key: `chaavi-copied-${field.key}`, tone: "ok", title: `${field.label} copied` }))
      .catch((err: unknown) => reportFailure(`Couldn't copy ${field.label.toLowerCase()}`, err));
  };

  const changed = item.revisionDate;
  return (
    <Card style={{ flex: 1, minWidth: 0, minHeight: 0, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 22px 14px", flex: "none" }}>
        <Avatar name={item.name} size={52} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 4 }}>
          <Truncate text={item.name} style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }} />
          <Truncate text={`${TYPE_META[item.type].one}${folder ? ` · ${folder.name}` : ""}`} style={{ fontSize: 13.5, color: "var(--ink-muted)" }} />
        </div>
        <IconButton icon="star" label={item.favorite ? "Remove from favorites" : "Add to favorites"} disabled={busy || undefined} onClick={onToggleFavorite} style={{ color: item.favorite ? "var(--clay)" : "var(--ink-muted)" }} />
        <Button tone="outline" disabled={busy} onClick={onEdit} style={{ color: "var(--sage-text)", fontWeight: 600 }}>
          Edit
        </Button>
        <IconButton icon="trash" label="Delete item" disabled={busy || undefined} onClick={onDelete} style={{ color: "var(--error)" }} />
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0, padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
        {fieldsOf(item).map((field) => {
          if (field.kind === "totp") {
            return <TotpRow key="totp" itemId={item.id} />;
          }
          if (field.kind === "plain") {
            return (
              <FieldRow
                key={field.key}
                label={field.label}
                value={field.value}
                mono={field.mono}
                extra={field.note ? <span style={{ fontSize: 12.5, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{field.note}</span> : undefined}
                onOpen={field.open ? () => openExternal(websiteUrl(field.value)).catch((err: unknown) => reportFailure("Couldn't open the website", err)) : undefined}
                onCopy={field.copy === false ? undefined : () => copyPlainField(field)}
              />
            );
          }
          const shown = revealed[field.key];
          const copied = copiedKey === field.key;
          return (
            <FieldRow
              key={field.key}
              label={field.label}
              value={copied ? COPIED_NOTE : (shown ?? field.mask)}
              mono={copied ? false : field.mono && shown === undefined}
              multiline={shown !== undefined && field.multiline}
              reveal={{ shown: shown !== undefined, pending: pendingKey === field.key, onToggle: () => toggleReveal(field) }}
              onCopy={field.copy === false ? undefined : () => copySecretField(field)}
            />
          );
        })}
        {changed ? <span style={{ fontSize: 12.5, color: "var(--ink-muted)", padding: "6px 4px 0" }}>{`Changed ${formatDay(changed)}, ${formatClock(changed)}`}</span> : null}
      </div>
    </Card>
  );
}

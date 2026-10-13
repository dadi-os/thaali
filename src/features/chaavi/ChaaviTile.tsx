import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { chaavi, isMeshOnline } from "../../shared/api";
import { CHAAVI_FOLDERS_KEY, CHAAVI_HEALTH_KEY, CHAAVI_ITEMS_KEY } from "../../shared/api/chaavi";
import { StateView } from "../../shared/components/states";
import { Ticker } from "../../shared/components/Ticker";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { POLL_MS } from "../../shared/lib/ux/poll";
import { countNoun } from "../../shared/lib/ux/plural";
import { formatRelative } from "../../shared/lib/ux/time";
import type { ChaaviItemType } from "../../types/chaavi";
import { ITEM_TYPES, TYPE_META } from "./draft";
import { TypeGlyph } from "./icons";

/** Bar and swatch color per item type, from the house palette. */
const TYPE_TONE: Record<ChaaviItemType, string> = {
  login: "var(--sage-deep)",
  note: "var(--sage)",
  card: "var(--clay)",
  identity: "var(--sage-line)",
  sshKey: "var(--ink-muted)",
  bankAccount: "color-mix(in srgb, var(--clay) 55%, var(--bone))",
  driversLicense: "var(--ink-faint)",
  passport: "color-mix(in srgb, var(--sage-deep) 50%, var(--bone))",
};

/** Folders and recent items the tile lists at most. */
const LIST_MAX = 5;

/**
 * Home Chaavi tile, two rows tall: passwords and secrets on odometers, the vault's make-up
 * by type, its biggest folders, the items edited last, and how many logins carry a passkey
 * or a one-time code. Names and counts only; never a secret value.
 */
export function ChaaviTile() {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);

  const healthQuery = useQuery({
    queryKey: CHAAVI_HEALTH_KEY,
    queryFn: () => chaavi.getHealth(),
    enabled: connected,
    refetchInterval: POLL_MS,
  });
  const ready = healthQuery.data?.vault === "ready";
  const itemsQuery = useQuery({
    queryKey: CHAAVI_ITEMS_KEY,
    queryFn: () => chaavi.listItems(),
    enabled: connected && ready,
    refetchInterval: POLL_MS,
  });
  const foldersQuery = useQuery({
    queryKey: CHAAVI_FOLDERS_KEY,
    queryFn: () => chaavi.listFolders(),
    enabled: connected && ready,
    refetchInterval: POLL_MS,
  });

  if (!connected) {
    return <StateView tone="offline" label="Chaavi is offline" detail="The vault comes back when dadi reconnects" compact />;
  }
  const failed = [healthQuery, itemsQuery, foldersQuery].find((query) => query.isError);
  if (failed) {
    return <StateView tone="error" label="Could not reach Chaavi" error={failed.error} onRetry={() => void failed.refetch()} compact />;
  }
  if (healthQuery.data?.vault === "unconfigured") {
    return <StateView tone="empty" label="Vault unconfigured" detail="Set BW_* in Preferences, then restart Chaavi" compact />;
  }

  const items = itemsQuery.data?.items ?? null;
  const folders = foldersQuery.data?.folders ?? null;
  const passwords = items ? items.filter((item) => item.type === "login").length : null;
  const secrets = items ? items.filter((item) => item.type !== "login").length : null;
  const byType = ITEM_TYPES.map((type) => ({ type, n: items ? items.filter((item) => item.type === type).length : 0 }));
  const folderRows =
    items && folders
      ? folders
          .map((folder) => ({ folder, n: items.filter((item) => item.folderId === folder.id).length }))
          .sort((a, b) => b.n - a.n || a.folder.name.localeCompare(b.folder.name))
          .slice(0, LIST_MAX)
      : null;
  const widest = folderRows ? Math.max(1, ...folderRows.map((row) => row.n)) : 1;
  const recent = items
    ? items
        .filter((item) => item.revisionDate !== null)
        .sort((a, b) => b.revisionDate!.localeCompare(a.revisionDate!))
        .slice(0, LIST_MAX)
    : null;
  const passkeys = items ? items.filter((item) => item.type === "login" && item.login.passkeys.length > 0).length : null;
  const codes = items ? items.filter((item) => item.type === "login" && item.login.hasTotp).length : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-stretch px-2 pt-1 pb-3">
        {(
          [
            { key: "passwords", label: passwords === null ? "PASSWORDS" : countNoun(passwords, "PASSWORD"), value: passwords },
            { key: "secrets", label: secrets === null ? "SECRETS" : countNoun(secrets, "SECRET"), value: secrets },
          ] as const
        ).map((col, i) => (
          <motion.div
            key={col.key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.04 }}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-2 ${i > 0 ? "border-l border-dashed border-sage-line/70" : ""}`}
          >
            <Ticker value={col.value} delay={i * 0.06} className="text-[28px] font-medium tracking-tight text-ink" />
            <span className="text-[10px] font-medium tracking-[1.2px] text-ink-ghost">{col.label}</span>
          </motion.div>
        ))}
      </div>

      <Section>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-rule">
          {items
            ? byType
                .filter((entry) => entry.n > 0)
                .map((entry) => <span key={entry.type} style={{ flex: entry.n, background: TYPE_TONE[entry.type] }} />)
            : null}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {byType.map((entry) => (
            <span key={entry.type} className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span className="size-[7px] rounded-[2px]" style={{ background: TYPE_TONE[entry.type] }} />
              {TYPE_META[entry.type].many}
              <span className="font-numeric text-ink">{items ? entry.n : "–"}</span>
            </span>
          ))}
        </div>
      </Section>

      <Section label="Folders">
        {folderRows === null ? (
          <Skeleton rows={3} />
        ) : folderRows.length === 0 ? (
          <p className="text-[12px] text-ink-ghost">No folders yet</p>
        ) : (
          folderRows.map(({ folder, n }) => (
            <div key={folder.id} className="flex items-center gap-2 text-[12px]">
              <span className="w-20 truncate text-ink">{folder.name}</span>
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-rule">
                <span className="block h-full rounded-full bg-sage" style={{ width: `${(n / widest) * 100}%` }} />
              </span>
              <span className="font-numeric w-5 text-right text-[11px] text-ink-ghost">{n}</span>
            </div>
          ))
        )}
      </Section>

      <Section label="Recently edited" grow>
        {recent === null ? (
          <Skeleton rows={4} />
        ) : recent.length === 0 ? (
          <p className="text-[12px] text-ink-ghost">Nothing yet</p>
        ) : (
          recent.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 text-[12px]">
              <span
                className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border ${
                  item.type === "card"
                    ? "border-[color-mix(in_srgb,var(--clay)_60%,transparent)] bg-[color-mix(in_srgb,var(--clay)_14%,var(--bone))] text-[var(--clay)]"
                    : "border-sage-line bg-bone text-sage-deep"
                }`}
              >
                <TypeGlyph type={item.type} size={12} />
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">{item.name}</span>
              <span className="font-numeric shrink-0 text-[10px] text-ink-ghost">{formatRelative(item.revisionDate!)}</span>
            </div>
          ))
        )}
      </Section>

      <div className="flex shrink-0 justify-between gap-2 border-t border-dashed border-sage-line px-3.5 pt-2 pb-2.5 text-[11px] text-ink-ghost">
        <span>
          <span className="font-numeric text-ink">{passkeys ?? "–"}</span> {passkeys === 1 ? "passkey" : "passkeys"}
        </span>
        <span>
          <span className="font-numeric text-ink">{codes ?? "–"}</span> {codes === 1 ? "one-time code" : "one-time codes"}
        </span>
      </div>
    </div>
  );
}

type SectionProps = {
  /** Tracking-caps heading; none for the type bar. */
  label?: string;
  /** Take the leftover height, clipping what does not fit. */
  grow?: boolean;
  children: ReactNode;
};

/** One band of the tile under a dashed rule. */
function Section({ label, grow = false, children }: SectionProps) {
  return (
    <div
      className={`flex flex-col gap-1.5 overflow-hidden border-t border-dashed border-sage-line px-3.5 py-2.5 ${
        grow ? "min-h-0 flex-1" : "shrink-0"
      }`}
    >
      {label ? <span className="text-[10px] font-medium tracking-[0.16em] text-sage-deep uppercase">{label}</span> : null}
      {children}
    </div>
  );
}

type SkeletonProps = {
  rows: number;
};

/** Pulsing lines while the catalog loads. */
function Skeleton({ rows }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="h-3.5 animate-pulse rounded-[4px] bg-sage-fill/60" />
      ))}
    </>
  );
}

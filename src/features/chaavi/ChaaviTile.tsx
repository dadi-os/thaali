import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { chaavi, isMeshOnline } from "../../shared/api";
import { CHAAVI_FOLDERS_KEY, CHAAVI_HEALTH_KEY, CHAAVI_ITEMS_KEY } from "../../shared/api/chaavi";
import { StateView } from "../../shared/components/states";
import { Ticker } from "../../shared/components/Ticker";
import { useConnection } from "../../shared/hooks/useConnection";
import { EASE, SLOW_S } from "../../shared/lib/ux/motion";
import { ITEM_TYPES, TYPE_META } from "./draft";
import { buildFolderTree } from "./folders";

/** Top-level folders the tile lists at most. */
const LIST_MAX = 7;

/**
 * Home Chaavi tile, two rows tall, as on the canvas: an odometer per item type the vault holds
 * (Logins, Notes), its top-level folders with a bar each, and how many logins carry a passkey
 * and a one-time code.
 */
export function ChaaviTile() {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);

  const healthQuery = useQuery({
    queryKey: CHAAVI_HEALTH_KEY,
    queryFn: () => chaavi.getHealth(),
    enabled: connected,
  });
  const ready = healthQuery.data?.vault === "ready";
  const itemsQuery = useQuery({
    queryKey: CHAAVI_ITEMS_KEY,
    queryFn: () => chaavi.listItems(),
    enabled: connected && ready,
  });
  const foldersQuery = useQuery({
    queryKey: CHAAVI_FOLDERS_KEY,
    queryFn: () => chaavi.listFolders(),
    enabled: connected && ready,
  });

  if (!connected && !itemsQuery.data) {
    return <StateView tone="offline" label="Chaavi is offline" detail="The vault comes back when dadi reconnects" compact />;
  }
  const failed = [healthQuery, itemsQuery, foldersQuery].find((query) => query.isError && !query.data);
  if (failed) {
    return <StateView tone="error" label="Could not reach Chaavi" error={failed.error} onRetry={() => void failed.refetch()} compact />;
  }
  if (healthQuery.data?.vault === "unconfigured") {
    return <StateView tone="empty" label="Vault unconfigured" detail="Set the vault account in Preferences → Chaavi" compact />;
  }

  const items = itemsQuery.data?.items ?? null;
  const folders = foldersQuery.data?.folders ?? null;
  const kinds = items
    ? ITEM_TYPES.map((type) => ({ type, n: items.filter((item) => item.type === type).length })).filter((entry) => entry.n > 0)
    : null;
  const folderRows =
    items && folders
      ? buildFolderTree(folders, items)
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
          .slice(0, LIST_MAX)
      : null;
  const widest = folderRows ? Math.max(1, ...folderRows.map((row) => row.count)) : 1;
  const passkeys = items ? items.filter((item) => item.type === "login" && item.login.passkeys.length > 0).length : null;
  const codes = items ? items.filter((item) => item.type === "login" && item.login.hasTotp).length : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-5 px-4 pt-2 pb-3">
        {kinds === null ? (
          <span className="skeleton mt-1 h-8 w-24 rounded-[8px]" />
        ) : (
          kinds.map((entry, i) => (
            <motion.div
              key={entry.type}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: SLOW_S, ease: EASE, delay: i * 0.04 }}
              className="flex flex-col gap-0.5"
            >
              <Ticker value={entry.n} delay={i * 0.06} className="text-[28px] font-semibold tracking-[-0.02em] text-ink" />
              <span className="text-[12px] text-ink-ghost">
                {entry.n === 1 ? TYPE_META[entry.type].one : TYPE_META[entry.type].many}
              </span>
            </motion.div>
          ))
        )}
      </div>

      <div className="mx-4 h-px shrink-0 bg-rule" />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-3">
        <span className="text-[11px] font-semibold text-ink-ghost">Folders</span>
        {folderRows === null ? (
          <Skeleton rows={4} />
        ) : folderRows.length === 0 ? (
          <p className="text-[12px] text-ink-ghost">No folders yet</p>
        ) : (
          folderRows.map((node) => (
            <div key={node.path} className="grid grid-cols-[minmax(0,1fr)_54px_22px] items-center gap-2 text-[13px]">
              <span className="truncate text-ink">{node.name}</span>
              <span className="h-1 overflow-hidden rounded-full bg-rule">
                <span className="block h-full rounded-full bg-sage" style={{ width: `${(node.count / widest) * 100}%` }} />
              </span>
              <span className="text-right font-numeric text-ink-ghost">{node.count}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex shrink-0 gap-3 px-4 pt-1 pb-3 text-[12px] text-ink-ghost">
        <span>
          {passkeys ?? "–"} {passkeys === 1 ? "passkey" : "passkeys"}
        </span>
        <span>
          {codes ?? "–"} {codes === 1 ? "one-time code" : "one-time codes"}
        </span>
      </div>
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

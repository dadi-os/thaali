import { useQuery } from "@tanstack/react-query";
import { chaavi, isMeshOnline } from "../../shared/api";
import { CHAAVI_FOLDERS_KEY, CHAAVI_HEALTH_KEY, CHAAVI_ITEMS_KEY } from "../../shared/api/chaavi";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import type { ChaaviFolder, ChaaviItem, ChaaviItemType } from "../../types/chaavi";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { TYPE_META } from "./draft";

/** The room the tile's blocks take: the label above the categories, the gap between blocks and the label above the folders. */
const CHIP_HEIGHT = 32;
const FOLDER_ROW = 31;

type BodyProps = {
  items: ChaaviItem[];
  folders: ChaaviFolder[];
  geometry: TileGeometry;
};

/** A chip for each kind of item the vault holds with how many, the folders that hold items with a bar each, and how many passkeys and one-time codes the logins carry. */
function Body({ items, folders, geometry }: BodyProps) {
  const types = new Map<ChaaviItemType, number>();
  for (const item of items) {
    types.set(item.type, (types.get(item.type) ?? 0) + 1);
  }
  const inFolders = folders.map((folder) => ({ ...folder, count: items.filter((item) => item.folderId === folder.id).length })).filter((folder) => folder.count > 0);
  const passkeys = items.reduce((sum, item) => sum + (item.type === "login" ? item.login.passkeys.length : 0), 0);
  const codes = items.filter((item) => item.type === "login" && item.login.hasTotp).length;
  const widest = Math.max(...inFolders.map((folder) => folder.count), 1);
  const chipWidths = [...types].map(([type, count]) => (count === 1 ? TYPE_META[type].one : TYPE_META[type].many).length * 6.6 + 46);
  let chipRows = 1;
  let used = 0;
  for (const width of chipWidths) {
    if (used > 0 && used + width > geometry.iw) {
      chipRows++;
      used = 0;
    }
    used += width + 8;
  }
  const categories = 14 + 8 + chipRows * CHIP_HEIGHT + (chipRows - 1) * 8;
  const footer = 14 + 1 + 10 + 18;
  const room = geometry.bh - categories - 14 - 21;
  const showFooter = room - FOLDER_ROW >= footer + FOLDER_ROW || room >= footer + 4 * FOLDER_ROW;
  const rows = Math.max(1, Math.min(inFolders.length, Math.floor((room - (showFooter ? footer : 0) + 7) / FOLDER_ROW)));
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, gap: 14, justifyContent: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "none" }}>
        <span className="ui-label" style={{ fontSize: 11 }}>Categories</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {[...types].map(([type, count]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, height: CHIP_HEIGHT, padding: "0 12px", borderRadius: 999, background: "var(--sage-fill)", fontSize: 14, whiteSpace: "nowrap", minWidth: 0 }}>
              <Truncate text={count === 1 ? TYPE_META[type].one : TYPE_META[type].many} style={{ fontWeight: 500, color: "var(--sage-text)" }} />
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: "none", minHeight: 0 }}>
        <span className="ui-label" style={{ fontSize: 11 }}>Folders</span>
        {inFolders.slice(0, rows).map((folder) => (
          <div key={folder.id} style={{ display: "flex", alignItems: "center", gap: 10, height: 24 }}>
            <Truncate text={folder.name} style={{ flex: 1, minWidth: 0, fontSize: 14 }} />
            <span style={{ width: 56, height: 5, borderRadius: 4, background: "var(--rule)", overflow: "hidden", flex: "none" }}>
              <span style={{ display: "block", height: "100%", width: `${(folder.count / widest) * 100}%`, background: "var(--sage)" }} />
            </span>
            <span style={{ minWidth: 20, textAlign: "right", fontSize: 13, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{folder.count}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      {showFooter ? (
        <div style={{ display: "flex", alignItems: "center", gap: "4px 14px", flexWrap: "wrap", fontSize: 13, color: "var(--ink-muted)", flex: "none", whiteSpace: "nowrap", borderTop: "1px solid var(--rule)", paddingTop: 10 }}>
          <span>{`${passkeys} ${passkeys === 1 ? "passkey" : "passkeys"}`}</span>
          <span>{`${codes} one-time ${codes === 1 ? "code" : "codes"}`}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Home's Chaavi tile: what the vault holds by kind and folder, and how many passkeys and one-time codes it keeps. */
export function ChaaviTile({ order }: { order: number }) {
  const { state: connection } = useConnection();
  const connected = isMeshOnline(connection);
  const health = useQuery({ queryKey: CHAAVI_HEALTH_KEY, queryFn: () => chaavi.getHealth(), enabled: connected });
  const open = health.data?.vault === "ready";
  const items = useQuery({ queryKey: CHAAVI_ITEMS_KEY, queryFn: () => chaavi.listItems(), enabled: connected && open });
  const folders = useQuery({ queryKey: CHAAVI_FOLDERS_KEY, queryFn: () => chaavi.listFolders(), enabled: connected && open });
  const healthState = useModuleState(health, () => false);
  const itemsState = useModuleState(items, (answer) => answer.items.length === 0);
  const foldersState = useModuleState(folders, () => false);
  const failed = [healthState, itemsState, foldersState].find((state) => state.kind === "error" || state.kind === "module-offline");
  const state = failed ?? itemsState;
  const retry = () => void [health, items, folders].find((query) => query.isError)?.refetch();
  const unconfigured = health.data?.vault === "unconfigured";
  const ready = state.kind === "ready" && foldersState.kind === "ready";
  const answer = state.kind === "ready" ? state.data.items : [];
  return (
    <Tile
      area="chaavi"
      title="Chaavi"
      to="/chaavi"
      order={order}
      summary={ready && answer.length > 0 ? `${answer.length} items` : undefined}
      loading={!unconfigured && (state.kind === "loading" || (state.kind === "ready" && foldersState.kind === "loading"))}
      notice={
        unconfigured
          ? { kind: "empty", title: "Vault unconfigured", detail: "Set the vault account in Preferences → Chaavi" }
          : tileNotice(state, { name: "Chaavi", request: "GET /v1/items", empty: ["The vault is empty", "Logins and notes appear here once you add them."] }, retry)
      }
      skeleton={() => (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} width={88 + i * 14} height={32} radius={999} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Skeleton width="42%" height={14} />
                <Skeleton width={56} height={5} style={{ marginLeft: "auto" }} />
                <Skeleton width={14} height={13} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Skeleton width={70} height={12} />
            <Skeleton width={90} height={12} />
          </div>
        </div>
      )}
    >
      {(g) => <Body items={answer} folders={foldersState.kind === "ready" ? foldersState.data.folders : []} geometry={g} />}
    </Tile>
  );
}

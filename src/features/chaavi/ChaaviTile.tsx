import { useQuery } from "@tanstack/react-query";
import { chaavi, isMeshOnline } from "../../shared/api";
import { CHAAVI_FOLDERS_KEY, CHAAVI_HEALTH_KEY, CHAAVI_ITEMS_KEY } from "../../shared/api/chaavi";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { ChipRow, Meter, SectionHeader, StatusChip, TileList, TileRow } from "../../shared/components/Module";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import type { ChaaviFolder, ChaaviItem, ChaaviItemType } from "../../types/chaavi";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { TYPE_META } from "./draft";

/** The room the tile's blocks take: the label above the categories, the gap between blocks and the label above the folders. */
const CHIP_HEIGHT = 32;
const FOLDER_ROW = 28;

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
  const categories = 24 + 8 + chipRows * CHIP_HEIGHT + (chipRows - 1) * 8;
  const footer = 12 + 1 + 12 + 20;
  const room = geometry.bh - categories - 12 - 24;
  const showFooter = room - FOLDER_ROW >= footer + FOLDER_ROW || room >= footer + 4 * FOLDER_ROW;
  const rows = Math.max(1, Math.min(inFolders.length, Math.floor((room - (showFooter ? footer : 0)) / FOLDER_ROW)));
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-none flex-col gap-2">
        <SectionHeader title="Categories" />
        <ChipRow wrap>
          {[...types].map(([type, count]) => {
            const name = count === 1 ? TYPE_META[type].one : TYPE_META[type].many;
            return (
              <StatusChip key={type} dot={false} title={`${count} ${name}`}>
                <span className="truncate">{name}</span>
                <span className="font-semibold text-ink tabular-nums">{count}</span>
              </StatusChip>
            );
          })}
        </ChipRow>
      </div>
      <div className="flex min-h-0 flex-none flex-col">
        <SectionHeader title="Folders" />
        <TileList>
          {inFolders.slice(0, rows).map((folder) => (
            <TileRow key={folder.id} size="sm" ruled={false} trail={<><Meter percent={(folder.count / widest) * 100} width={56} /><span className="min-w-[3ch] flex-none text-right text-[13px] text-ink-muted tabular-nums">{folder.count}</span></>}>
              <Truncate text={folder.name} />
            </TileRow>
          ))}
        </TileList>
      </div>
      <div className="flex-1" />
      {showFooter ? (
        <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule pt-3 text-[13px] whitespace-nowrap text-ink-muted tabular-nums">
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
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} width={88 + i * 16} height={32} radius={999} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton width="42%" height={16} />
                <div className="flex-1" />
                <Skeleton width={56} height={6} />
                <Skeleton width={16} height={16} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Skeleton width={72} height={12} />
            <Skeleton width={92} height={12} />
          </div>
        </div>
      )}
    >
      {(g) => <Body items={answer} folders={foldersState.kind === "ready" ? foldersState.data.folders : []} geometry={g} />}
    </Tile>
  );
}

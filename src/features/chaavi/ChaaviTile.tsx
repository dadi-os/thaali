import { useQuery } from "@tanstack/react-query";
import { chaavi, isMeshOnline } from "../../shared/api";
import { CHAAVI_FOLDERS_KEY, CHAAVI_HEALTH_KEY, CHAAVI_ITEMS_KEY } from "../../shared/api/chaavi";
import { Icon } from "../../shared/ui/Icon";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { Meter, TileList, TileRow } from "../../shared/components/Module";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import type { ChaaviFolder, ChaaviItem, ChaaviItemType } from "../../types/chaavi";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";
import { ITEM_TYPES, TYPE_META } from "./draft";
import { buildFolderTree, type FolderNode } from "./folders";

const STRIP_HEIGHT = 28;
const FOLDER_ROW = 28;
/** How far each folder level steps in. */
const INDENT = 18;
/** The folder glyph's width, which the connector lines are measured from. */
const GLYPH = 14;

type BodyProps = {
  items: ChaaviItem[];
  folders: ChaaviFolder[];
  geometry: TileGeometry;
};

/** `ends[k]` is whether the folder's ancestor at depth `k + 1` (itself, for the last entry) is the last of its siblings. */
type FlatFolder = { node: FolderNode; depth: number; ends: boolean[] };

/** The tree in reading order, every level open, leaving out folders that hold nothing. */
function flatten(nodes: FolderNode[], above: boolean[] = []): FlatFolder[] {
  const kept = nodes.filter((node) => node.count > 0);
  return kept.flatMap((node, index) => {
    const ends = [...above, index === kept.length - 1];
    return [{ node, depth: above.length, ends }, ...flatten(node.children, ends)];
  });
}

/** The glyph's cell with the lines that tie a subfolder to its parent: an elbow from the parent's column into this row, and a line carried down past the row for each ancestor that has more folders to come. */
function Lead({ depth, ends }: Pick<FlatFolder, "depth" | "ends">) {
  const column = (level: number) => level * INDENT + GLYPH / 2;
  return (
    <span className="relative flex h-7 flex-none items-center text-ink-muted" style={{ width: depth * INDENT + GLYPH, paddingLeft: depth * INDENT }}>
      {ends.slice(1, depth).map((last, level) => (last ? null : <span key={level} aria-hidden="true" className="absolute -top-px -bottom-px w-px bg-sage-line" style={{ left: column(level) }} />))}
      {depth > 0 ? (
        <>
          <span
            aria-hidden="true"
            className="absolute -top-px border-b border-l border-sage-line"
            style={{ left: column(depth - 1), width: INDENT - GLYPH / 2 - 3, height: 15, borderBottomLeftRadius: 7 }}
          />
          {ends[depth] ? null : <span aria-hidden="true" className="absolute -top-px -bottom-px w-px bg-sage-line" style={{ left: column(depth - 1) }} />}
        </>
      ) : null}
      <Icon name="folder" size={GLYPH} />
    </span>
  );
}

/** The folder tree with subfolders indented under their parent, over a footer of what the vault holds by kind (a distinct glyph and a count each) that scrolls sideways. */
function Body({ items, folders, geometry }: BodyProps) {
  const types = new Map<ChaaviItemType, number>();
  for (const item of items) {
    types.set(item.type, (types.get(item.type) ?? 0) + 1);
  }
  const rows = flatten(buildFolderTree(folders, items));
  const room = Math.max(1, Math.floor((geometry.bh - STRIP_HEIGHT - 13 - 24) / FOLDER_ROW));
  const widest = Math.max(...rows.filter((row) => row.depth === 0).map((row) => row.node.count), 1);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <TileList>
        {rows.slice(0, room).map(({ node, depth, ends }) => (
          <TileRow
            key={node.path}
            size="sm"
            ruled={false}
            lead={<Lead depth={depth} ends={ends} />}
            trail={<><Meter percent={(node.count / widest) * 100} width={56} /><span className="min-w-[3ch] flex-none text-right text-[13px] text-ink-muted tabular-nums">{node.count}</span></>}
          >
            <Truncate text={node.name} className={depth === 0 ? "" : "text-ink-muted"} />
          </TileRow>
        ))}
      </TileList>
      <div className="flex-1" />
      <div className="scroll flex flex-none items-center gap-2 overflow-x-auto border-t border-rule pt-3" style={{ height: STRIP_HEIGHT + 13 }} onClick={(event) => event.preventDefault()}>
        {ITEM_TYPES.filter((type) => types.has(type)).map((type) => {
          const count = types.get(type)!;
          const name = count === 1 ? TYPE_META[type].one : TYPE_META[type].many;
          return (
            <span key={type} title={`${count} ${name}`} className="flex flex-none items-center gap-1.5 rounded-full bg-sage-fill px-2.5 py-1 text-[13px] whitespace-nowrap text-ink-muted">
              <Icon name={TYPE_META[type].icon} size={14} />
              <span className="font-semibold text-ink tabular-nums">{count}</span>
              <span>{name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Home's Chaavi tile: what the vault holds by kind and the folders it is filed in. */
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
          <div className="flex items-center gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} width={64 + i * 12} height={16} />
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
        </div>
      )}
    >
      {(g) => <Body items={answer} folders={foldersState.kind === "ready" ? foldersState.data.folders : []} geometry={g} />}
    </Tile>
  );
}

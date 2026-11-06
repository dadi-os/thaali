import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { isMeshOnline, yaad } from "../../shared/api";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { SectionHeader, Stat, TileList, TileRow } from "../../shared/components/Module";
import { useConnection } from "../../shared/hooks/useConnection";
import { startOfWeek } from "../timeline/dates";
import { useModuleState } from "../../shared/hooks/useModuleState";
import type { NodeKind, NodeRecord } from "../../types/yaad";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";

/** The kinds the tile counts, with the name and colour each is drawn in. */
const CELLS: ReadonlyArray<{ kind: NodeKind; name: string; ink: string }> = [
  { kind: "person", name: "People", ink: "var(--tide)" },
  { kind: "memory", name: "Memories", ink: "var(--sage)" },
  { kind: "place", name: "Places", ink: "var(--clay)" },
  { kind: "plan", name: "Plans", ink: "var(--sage-deep)" },
];
/** Nodes read per `POST /query` page when a kind is counted. */
const COUNT_PAGE = 200;

/** How many nodes of each kind Yaad holds, and how many of them arrived since this week's Monday. */
type KindCounts = { totals: Map<NodeKind, number>; thisWeek: number };

/** Counts `kind` by reading every page of it from Yaad; `since` is the instant a node must be created at or after to count as new. */
export async function countKind(kind: NodeKind, since: number): Promise<{ total: number; fresh: number }> {
  let total = 0;
  let fresh = 0;
  for (let offset = 0; ; offset += COUNT_PAGE) {
    const { nodes } = await yaad.query({ kind, limit: COUNT_PAGE, offset });
    total += nodes.length;
    fresh += nodes.filter((node) => Date.parse(node.created_at) >= since).length;
    if (nodes.length < COUNT_PAGE) {
      return { total, fresh };
    }
  }
}

/** Every kind counted, and the graph the most-used list reads. */
async function readHome(): Promise<{ nodes: NodeRecord[]; counts: KindCounts }> {
  const since = startOfWeek(new Date()).getTime();
  const [graph, ...counted] = await Promise.all([yaad.graph({}), ...CELLS.map(({ kind }) => countKind(kind, since))]);
  return { nodes: graph.nodes, counts: { totals: new Map(CELLS.map(({ kind }, i) => [kind, counted[i]!.total])), thisWeek: counted.reduce((sum, c) => sum + c.fresh, 0) } };
}

/** The colour of the dot before a node in the most-used list. */
function nodeInk(kind: NodeKind): string {
  return kind === "person" ? "var(--tide)" : kind === "place" ? "var(--clay)" : "var(--sage)";
}

type BodyProps = {
  nodes: NodeRecord[];
  counts: KindCounts;
  geometry: TileGeometry;
};

/** Whether the four cells sit in one row: the tile is wide and short. */
function isOneRow(geometry: TileGeometry): boolean {
  return geometry.iw >= 3 * geometry.bh;
}

/** How many of each kind Yaad holds, in four cells that each open the Yaad page filtered to that kind, and under them the nodes agents have recalled most when the tile is tall enough. */
function Body({ nodes, counts, geometry }: BodyProps) {
  const navigate = useNavigate();
  const used = nodes.filter((node) => node.access_count > 0).sort((a, b) => b.access_count - a.access_count);
  const oneRow = isOneRow(geometry);
  const listed = oneRow ? 0 : Math.max(0, Math.min(3, Math.floor((geometry.bh - 174) / 36)));
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className={`grid min-h-0 flex-1 gap-2 ${oneRow ? "grid-cols-4 grid-rows-1" : "grid-cols-2 grid-rows-2"}`}>
        {CELLS.map(({ kind, name, ink }) => (
          <Stat key={kind} value={counts.totals.get(kind) ?? 0} label={name} ink={ink} onClick={() => navigate(`/yaad?kind=${kind}`)} />
        ))}
      </div>
      {listed > 0 ? (
        <div className="flex flex-none flex-col">
          <SectionHeader title="Most used" />
          <TileList>
            {used.slice(0, listed).map((node) => (
              <TileRow key={node.id} lead={<span className="dot size-2" style={{ background: nodeInk(node.kind) }} />} trail={<span className="flex-none text-[13px] whitespace-nowrap text-ink-muted tabular-nums">{`${node.access_count} uses`}</span>}>
                <Truncate text={node.title} />
              </TileRow>
            ))}
          </TileList>
        </div>
      ) : null}
    </div>
  );
}

/** Home's Yaad tile: how many people, memories, places and plans Yaad holds (each kind counted from `POST /query`, a click on a kind opening the page filtered to it, and the total over all of them in the header), and which it recalls most. */
export function YaadTile({ order }: { order: number }) {
  const { state: connection } = useConnection();
  const query = useQuery({ queryKey: ["yaad", "home"], queryFn: readHome, enabled: isMeshOnline(connection) });
  const state = useModuleState(query, (home) => home.nodes.length === 0);
  const things = state.kind === "ready" ? [...state.data.counts.totals.values()].reduce((sum, count) => sum + count, 0) : 0;
  return (
    <Tile
      area="yaad"
      title="Yaad"
      to="/yaad"
      order={order}
      summary={things > 0 ? `${things.toLocaleString()} things` : undefined}
      loading={state.kind === "loading"}
      notice={tileNotice(state, { name: "Yaad", request: "POST /graph", empty: ["Nothing remembered yet", "Memories appear here as agents learn them."] }, () => void query.refetch())}
      skeleton={(g) => (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className={`grid min-h-0 flex-1 gap-2 ${isOneRow(g) ? "grid-cols-4 grid-rows-1" : "grid-cols-2 grid-rows-2"}`}>
            {CELLS.map(({ kind, ink }) => (
              <div key={kind} className="relative flex min-h-0 flex-col items-center justify-center gap-1 rounded-[14px] bg-sage-fill">
                <span className="dot absolute top-3 left-3 size-2 opacity-50" style={{ background: ink }} />
                <Skeleton width={64} height={28} />
                <Skeleton width={72} height={14} />
              </div>
            ))}
          </div>
        </div>
      )}
    >
      {(g) => <Body nodes={state.kind === "ready" ? state.data.nodes : []} counts={state.kind === "ready" ? state.data.counts : { totals: new Map(), thisWeek: 0 }} geometry={g} />}
    </Tile>
  );
}

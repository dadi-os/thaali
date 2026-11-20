import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { isMeshOnline, yaad } from "../../shared/api";
import { Skeleton } from "../../shared/ui/Skeleton";
import { Truncate } from "../../shared/ui/Truncate";
import { SectionHeader, Stat, TileList, TileRow } from "../../shared/components/Module";
import { useConnection } from "../../shared/hooks/useConnection";
import { useModuleState } from "../../shared/hooks/useModuleState";
import type { CountsResponse, NodeKind, NodeRecord } from "../../types/yaad";
import { tileNotice } from "../home/notice";
import { Tile, type TileGeometry } from "../home/Tile";

/** The kinds the tile counts, with the name and colour each is drawn in. */
const CELLS: ReadonlyArray<{ kind: NodeKind; name: string; ink: string }> = [
  { kind: "person", name: "People", ink: "var(--tide)" },
  { kind: "place", name: "Places", ink: "var(--clay)" },
  { kind: "plan", name: "Plans", ink: "var(--sage-deep)" },
  { kind: "task", name: "Tasks", ink: "var(--sage)" },
];
/** Every kind counted by `GET /counts` (the total over every node, memories included), and the graph the most-used list reads. */
export async function readHome(): Promise<{ nodes: NodeRecord[]; counts: CountsResponse }> {
  const [graph, counts] = await Promise.all([yaad.graph({}), yaad.counts()]);
  return { nodes: graph.nodes, counts };
}

/** The colour of the dot before a node in the most-used list. */
function nodeInk(kind: NodeKind): string {
  return kind === "person" ? "var(--tide)" : kind === "place" ? "var(--clay)" : "var(--sage)";
}

type BodyProps = {
  nodes: NodeRecord[];
  counts: CountsResponse;
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
          <Stat key={kind} value={counts.kinds[kind]} label={name} ink={ink} onClick={() => navigate(`/yaad?kind=${kind}`)} />
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

/** Home's Yaad tile: how many people, places, plans and tasks Yaad holds (from `GET /counts`, a click on a kind opening the page filtered to it, and the total over every node in the header), and which it recalls most. */
export function YaadTile({ order }: { order: number }) {
  const { state: connection } = useConnection();
  const query = useQuery({ queryKey: ["yaad", "home"], queryFn: readHome, enabled: isMeshOnline(connection) });
  const state = useModuleState(query, (home) => home.nodes.length === 0);
  const total = state.kind === "ready" ? state.data.counts.total : 0;
  return (
    <Tile
      area="yaad"
      title="Yaad"
      to="/yaad"
      order={order}
      summary={total > 0 ? `${total.toLocaleString()} memories` : undefined}
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
      {(g) => <Body nodes={state.kind === "ready" ? state.data.nodes : []} counts={state.kind === "ready" ? state.data.counts : { total: 0, kinds: { person: 0, memory: 0, place: 0, plan: 0, task: 0 } }} geometry={g} />}
    </Tile>
  );
}

import { useQuery } from "@tanstack/react-query";
import { isMeshOnline, yaad } from "../../shared/api";
import { Skeleton } from "../../shared/components/Skeleton";
import { Truncate } from "../../shared/components/Truncate";
import { useConnection } from "../../shared/hooks/useConnection";
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
const WEEK_MS = 7 * 86_400_000;

/** The colour of the dot before a node in the most-used list. */
function nodeInk(kind: NodeKind): string {
  return kind === "person" ? "var(--tide)" : kind === "place" ? "var(--clay)" : "var(--sage)";
}

type BodyProps = {
  nodes: NodeRecord[];
  geometry: TileGeometry;
};

/** How many of each kind Yaad holds, in four cells, and under them the nodes agents have recalled most when the tile is tall enough. */
function Body({ nodes, geometry }: BodyProps) {
  const counts = new Map<NodeKind, number>();
  for (const node of nodes) {
    counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  }
  const used = nodes.filter((node) => node.access_count > 0).sort((a, b) => b.access_count - a.access_count);
  const oneRow = geometry.iw >= 3 * geometry.bh;
  const listed = oneRow ? 0 : Math.max(0, Math.min(3, Math.floor((geometry.bh - 170) / 36)));
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0, gap: 12 }}>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: oneRow ? "repeat(4,1fr)" : "1fr 1fr", gridTemplateRows: oneRow ? "1fr" : "1fr 1fr", gap: 8 }}>
        {CELLS.map(({ kind, name, ink }) => (
          <div key={kind} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 14, background: "var(--sage-fill)", minWidth: 0, minHeight: 0, position: "relative" }}>
            <span style={{ position: "absolute", top: 10, left: 12, width: 8, height: 8, borderRadius: "50%", background: ink }} />
            <span style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{counts.get(kind) ?? 0}</span>
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>{name}</span>
          </div>
        ))}
      </div>
      {listed > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", flex: "none" }}>
          <span className="ui-label" style={{ fontSize: 11, paddingBottom: 6 }}>Most used</span>
          {used.slice(0, listed).map((node) => (
            <div key={node.id} style={{ display: "flex", alignItems: "center", gap: 10, height: 36, borderTop: "1px solid var(--rule)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: nodeInk(node.kind), flex: "none" }} />
              <Truncate text={node.title} style={{ flex: 1, minWidth: 0, fontSize: 14 }} />
              <span style={{ fontSize: 12.5, color: "var(--ink-muted)", whiteSpace: "nowrap", flex: "none", fontVariantNumeric: "tabular-nums" }}>{`${node.access_count} uses`}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Home's Yaad tile: how many people, memories, places and plans Yaad holds, and which it recalls most. */
export function YaadTile({ order }: { order: number }) {
  const { state: connection } = useConnection();
  const query = useQuery({ queryKey: ["yaad", "graph", "home"], queryFn: async () => (await yaad.graph({})).nodes, enabled: isMeshOnline(connection) });
  const state = useModuleState(query, (nodes) => nodes.length === 0);
  const since = Date.now() - WEEK_MS;
  const fresh = state.kind === "ready" ? state.data.filter((node) => Date.parse(node.created_at) > since).length : 0;
  return (
    <Tile
      area="yaad"
      title="Yaad"
      to="/yaad"
      order={order}
      summary={fresh > 0 ? `+${fresh} this week` : undefined}
      loading={state.kind === "loading"}
      notice={tileNotice(state, { name: "Yaad", request: "POST /graph", empty: ["Nothing remembered yet", "Memories appear here as agents learn them."] }, () => void query.refetch())}
      skeleton={() => (
        <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr", gap: 8 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, background: "var(--sage-fill)" }}>
              <Skeleton width={54} height={28} />
              <Skeleton width={64} height={12} />
            </div>
          ))}
        </div>
      )}
    >
      {(g) => <Body nodes={state.kind === "ready" ? state.data : []} geometry={g} />}
    </Tile>
  );
}

import type { EdgeRecord, GraphResponse, NodeKind, NodeRecord, NodeResponse, QueryRequest, QueryResponse } from "../../types/yaad";
import type { Scenario } from "../scenario";
import { ago, DAY, HOUR } from "./time";

/** A small deterministic generator, so the same scenario draws the same graph each run. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const TITLES: Record<NodeKind, string[]> = {
  person: ["Maya Patel", "Daniel Okafor", "Professor Lindqvist", "Sam Rivera", "Priya Nair", "Coach Alvarez"],
  place: ["Engineering Building room 1345", "IM West gym", "Brody Hall dining", "Main Library", "Home"],
  memory: [
    "Prefers morning study blocks before 11 AM",
    "Quiz 2 covers chapters 5 and 6 only",
    "Northwind recruiter asked for a reply by Friday",
    "Gym days are chosen by the health specialist each week",
  ],
  plan: ["CSE 300 lecture", "Gym session", "Study block", "Coffee with Maya", "Northwind coding test"],
};

const EDGE_TYPES = ["ABOUT", "ATTENDS", "AT_LOCATION", "BELONGS_TO", "CLASSMATE_OF", "RELATED_TO"];

/** Nodes Yaad returns from `POST /query` when the request names no limit. */
const DEFAULT_QUERY_LIMIT = 50;

function nodeId(n: number): string {
  return `y0000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
}

function counts(scenario: Scenario): number {
  switch (scenario) {
    case "empty":
      return 0;
    case "many":
      return 1800;
    default:
      return 320;
  }
}

function build(scenario: Scenario): GraphResponse {
  const total = counts(scenario);
  const rand = seeded(7);
  const kinds: NodeKind[] = ["person", "place", "memory", "plan"];
  const nodes: NodeRecord[] = Array.from({ length: total }, (_, i): NodeRecord => {
    const kind = kinds[Math.floor(rand() * 10) % 4]!;
    const pool = TITLES[kind];
    const base = pool[i % pool.length]!;
    const title = scenario === "long" && i % 11 === 0 ? `${base}: ${"a note that keeps going ".repeat(14)}` : i < pool.length ? base : `${base} (${i})`;
    return {
      id: nodeId(i + 1),
      kind,
      title,
      body: kind === "memory" ? "Stored from a conversation; the details were confirmed twice." : null,
      occurred_at: kind === "plan" ? ago(-(i % 9) * DAY) : null,
      expires_at: null,
      access_count: Math.floor(rand() * 30),
      last_accessed_at: ago(Math.floor(rand() * 20) * HOUR),
      source: i % 3 === 0 ? "agent" : "ingest",
      agent_id: i % 3 === 0 ? "schedule-specialist" : null,
      created_at: ago((i % 40) * DAY),
      updated_at: ago((i % 12) * HOUR),
    };
  });
  const edges: EdgeRecord[] = Array.from({ length: Math.floor(total * 1.5) }, (_, i): EdgeRecord => ({
    id: `e0000000-0000-4000-8000-${i.toString().padStart(12, "0")}`,
    src_id: nodeId(Math.floor(rand() * total) + 1),
    dst_id: nodeId(Math.floor(rand() * total) + 1),
    type: EDGE_TYPES[i % EDGE_TYPES.length]!,
    properties: {},
    confidence: 0.8,
    created_at: ago((i % 30) * DAY),
    valid_from: ago((i % 30) * DAY),
    valid_to: null,
  }));
  return { nodes, edges: edges.filter((e) => e.src_id !== e.dst_id) };
}

/** Yaad `POST /graph`. */
export function graph(scenario: Scenario): GraphResponse {
  return build(scenario);
}

/** Yaad `GET /nodes/:id`. */
export function node(scenario: Scenario, id: string): NodeResponse {
  const { nodes, edges } = build(scenario);
  const found = nodes.find((n) => n.id === id);
  if (!found) {
    throw new Error(`fixtures: no yaad node ${id}`);
  }
  return {
    ...found,
    detail: found.kind === "place" ? { address: "428 S Shaw Ln, East Lansing, MI", latitude: null, longitude: null } : null,
    edges: { outgoing: edges.filter((e) => e.src_id === id), incoming: edges.filter((e) => e.dst_id === id) },
  };
}

/** Yaad `POST /query`: nodes of a kind, a page at a time. */
export function query(scenario: Scenario, request: QueryRequest): QueryResponse {
  const limit = request.limit ?? DEFAULT_QUERY_LIMIT;
  const offset = request.offset ?? 0;
  const matching = build(scenario).nodes.filter((n) => request.kind === undefined || n.kind === request.kind);
  return { nodes: matching.slice(offset, offset + limit).map((n) => ({ ...n, detail: null })), limit, offset };
}

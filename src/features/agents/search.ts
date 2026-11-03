import type { AgentRecord } from "../../types/hath";

/** The agents whose name contains `query` (ignoring case), or null while the query is empty so nothing is narrowed. */
export function agentsMatching(agents: AgentRecord[], query: string): AgentRecord[] | null {
  const needle = query.trim().toLowerCase();
  return needle === "" ? null : agents.filter((agent) => agent.name.toLowerCase().includes(needle) || agent.id.toLowerCase().includes(needle));
}

/** The agent Enter picks: the only match, or the one whose name is exactly the query; null when the matches leave it open. */
export function pickedMatch(found: AgentRecord[] | null, query: string): AgentRecord | null {
  if (found === null) {
    return null;
  }
  if (found.length === 1) {
    return found[0]!;
  }
  const exact = found.filter((agent) => agent.name.toLowerCase() === query.trim().toLowerCase());
  return exact.length === 1 ? exact[0]! : null;
}

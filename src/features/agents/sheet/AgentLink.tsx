/** Props of {@link AgentLink}. */
export type AgentLinkProps = {
  /** The agent it opens; null is Ankur, who has no popover, so his name is plain text. */
  agentId: string | null;
  /** The agent's display name. */
  name: string;
  /** Selects the agent, replacing the popover's content. */
  onSelect: (agentId: string) => void;
};

/** An agent's name wherever the sheet shows one: a link that opens that agent's popover. */
export function AgentLink({ agentId, name, onSelect }: AgentLinkProps) {
  if (agentId === null) {
    return <>{name}</>;
  }
  return (
    <button
      type="button"
      className="ui-trans font-semibold text-sage-text hover:underline"
      title={`Show ${name}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(agentId);
      }}
    >
      {name}
    </button>
  );
}

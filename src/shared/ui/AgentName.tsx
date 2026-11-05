export type AgentNameProps = {
  /** The agent's full name, such as `networking-specialist`. */
  name: string;
  /** Extra classes for size, color and weight. */
  className?: string;
  /** The name can be selected and copied; false inside a row or button that is itself pressed. */
  selectable?: boolean;
};

/** An agent's full name: it wraps at any character rather than being cut or shortened. */
export function AgentName({ name, className = "", selectable = true }: AgentNameProps) {
  return (
    <span title={name} data-selectable={selectable ? "" : undefined} className={`min-w-0 [overflow-wrap:anywhere] ${className}`}>
      {name}
    </span>
  );
}

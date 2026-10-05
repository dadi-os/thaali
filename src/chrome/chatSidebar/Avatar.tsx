export type AvatarProps = {
  /** One character: the agent's initial, or દ for Dadi. */
  glyph: string;
  /** Set the glyph in the Gujarati face, as Dadi's mark is. */
  gujarati?: boolean;
  /** A lane is running: a soft ring pulses out from the avatar. */
  live?: boolean;
  /** Size and text classes, e.g. `size-8 text-[14px]`. */
  className?: string;
};

/** Round sage mark that stands for an agent or Dadi in the list and the pane header. */
export function Avatar({ glyph, gujarati = false, live = false, className = "" }: AvatarProps) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} aria-hidden>
      {live ? (
        <span className="animate-pulse-out absolute inset-0 rounded-full bg-sage/45 [--pulse-scale:1.55]" />
      ) : null}
      <span
        className={`relative flex size-full items-center justify-center rounded-full leading-none ${
          live ? "bg-sage-active text-sage-deep" : "bg-sage-fill text-sage-text"
        } ${gujarati ? "font-gujarati" : "font-medium"}`}
      >
        {glyph}
      </span>
    </span>
  );
}

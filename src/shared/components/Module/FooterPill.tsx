import type { ReactNode } from "react";

/** The height of a {@link FooterStrip}'s pills, in px. */
export const FOOTER_PILL_HEIGHT = 32;
/** The strip's own height: its pills plus the 12 px of padding under its rule and the rule itself. */
export const FOOTER_STRIP_HEIGHT = FOOTER_PILL_HEIGHT + 13;

/** The words of a {@link FooterPill}: `ink` for what is present, `muted` for what is away, `due` for what waits on someone. */
export type FooterPillTone = "ink" | "muted" | "due";

const TONES: Record<FooterPillTone, string> = {
  ink: "bg-sage-fill text-ink",
  muted: "bg-sage-fill text-ink-muted",
  due: "bg-due-fill text-due-ink",
};

/** Props of {@link FooterPill}. */
export type FooterPillProps = {
  tone?: FooterPillTone;
  /** Shown on hover. */
  title?: string;
  /** A leading mark (a dot or an icon) and the words. */
  children: ReactNode;
};

/** One pill of a tile's footer: 32 px tall, 12 px sides, 8 px between its parts, 13 px type. The Chaavi and System tiles both draw theirs with it. */
export function FooterPill({ tone = "ink", title, children }: FooterPillProps) {
  return (
    <span title={title} className={`inline-flex h-8 flex-none items-center gap-2 rounded-full px-3 text-[13px] whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Props of {@link FooterStrip}. */
export type FooterStripProps = {
  /** {@link FooterPill}s, or one line of plain text when there are none. */
  children: ReactNode;
};

/** The foot of a tile: a hairline above a row of pills that scrolls sideways when they do not fit. */
export function FooterStrip({ children }: FooterStripProps) {
  return (
    <div className="scroll flex flex-none items-center gap-2 overflow-x-auto border-t border-rule pt-3" style={{ height: FOOTER_STRIP_HEIGHT }} onClick={(event) => event.preventDefault()}>
      {children}
    </div>
  );
}

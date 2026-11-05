/** How a dialog choice reads: the solid default, a quiet outline, or a destructive tint. */
export type DialogOptionTone = "fill" | "outline" | "danger";

/** Hover treatment per dialog choice: the solid one darkens, the destructive one deepens its tint, the outline washes in sage. */
const HOVER: Record<DialogOptionTone, string> = { fill: "ui-hover-solid", outline: "ui-hover-fill", danger: "ui-hover-danger" };

/** Props of {@link DialogOption}. */
export type DialogOptionProps = {
  tone: DialogOptionTone;
  /** What the choice is called. */
  title: string;
  /** One line saying what it does. */
  detail: string;
  onClick: () => void;
};

/** One choice in a {@link Dialog}: a title and a line saying what it does. */
export function DialogOption({ tone, title, detail, onClick }: DialogOptionProps) {
  return (
    <button type="button" className={`dialog-option dialog-option-${tone} ui-trans ${HOVER[tone]}`} onClick={onClick}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 13, lineHeight: "17px", opacity: tone === "fill" ? 0.9 : 1, color: tone === "outline" ? "var(--ink-muted)" : "inherit" }}>{detail}</span>
    </button>
  );
}

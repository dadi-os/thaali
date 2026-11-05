import type { ReactNode } from "react";
import { Icon } from "../../ui/Icon";
import { Truncate } from "../../ui/Truncate";

export type TaskPreviewProps = {
  kind: "browser" | "terminal";
  /** The page address of a browser, or the id and slot of a terminal. */
  caption: string;
  /** The accessible name, such as "Open browser task 3f2a91". */
  label: string;
  /** What the helper holds: its page for a browser, its output for a terminal. */
  children: ReactNode;
  /** The owner is driving it. */
  paused?: boolean;
  onOpen: () => void;
};

/** The helper is paused while its owner drives it. */
function PausedChip() {
  return (
    <span
      style={{
        position: "absolute",
        right: 8,
        bottom: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 10px",
        borderRadius: 999,
        background: "#f1e7cc",
        color: "var(--due-ink)",
        border: "1px solid var(--due-line)",
        fontSize: 12,
        fontWeight: 600,
        zIndex: 2,
      }}
    >
      <Icon name="pause" size={11} />
      Paused
    </span>
  );
}

/**
 * A helper's live screen, drawn as a browser window or a terminal. The whole frame is the button: hover shows an
 * expand mark, and a click opens the browser or terminal modal. The chrome is the shell; the page or output is the child.
 */
export function TaskPreview({ kind, caption, label, children, paused = false, onOpen }: TaskPreviewProps) {
  const browser = kind === "browser";
  return (
    <button
      type="button"
      className="pv ui-trans"
      aria-label={label}
      title={label}
      onClick={onOpen}
      style={browser ? { background: "#fff" } : { background: "#23271f", color: "#dfe6d6" }}
    >
      {browser ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px 0 10px", background: "#f1f2ee", borderBottom: "1px solid var(--rule)" }}>
          <span style={{ display: "flex", gap: 5 }}>
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="dot" style={{ width: 8, height: 8, background: "#d9d4cb" }} />
            ))}
          </span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px", borderRadius: 12, background: "#fff", border: "1px solid var(--rule)", fontSize: 12, color: "var(--ink-muted)" }}>
            <Icon name="lock" size={11} />
            <Truncate text={caption} style={{ flex: 1, minWidth: 0, fontSize: 12 }} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", background: "#1b1e18", fontFamily: "var(--font-numeric)", fontSize: 11.5, color: "#a9b3a0" }}>
          <Icon name="terminal" size={12} />
          <Truncate text={caption} style={{ flex: 1, minWidth: 0 }} />
        </div>
      )}
      {children}
      <span className="pv-x" aria-hidden="true">
        <Icon name="expand" size={15} />
      </span>
      {paused ? <PausedChip /> : null}
    </button>
  );
}

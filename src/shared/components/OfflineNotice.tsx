import { Icon } from "./Icon";

export type OfflineNoticeProps = {
  text: string;
  /** Pulse the mark while reconnecting. */
  spin?: boolean;
};

/** The one notice for dadi being out of reach, a pill for the title bar. */
export function OfflineNotice({ text, spin = true }: OfflineNoticeProps) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        height: 32,
        padding: "0 14px 0 11px",
        borderRadius: 999,
        background: "var(--bone)",
        border: "1px solid var(--error-line)",
        fontSize: 13,
        color: "var(--ink-muted)",
        animation: "slide-in 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "var(--error)", display: "flex", animation: spin ? "ui-pulse 1.6s ease-in-out infinite" : "none" }}>
        <Icon name="wifiOff" size={15} />
      </span>
      {text}
    </div>
  );
}

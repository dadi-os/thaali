import { useState, useSyncExternalStore } from "react";
import { nas } from "../../shared/api";
import { useConnection } from "../../shared/hooks/useConnection";

export type BrowserFrameProps = {
  /** Nas browser id whose virtual display to stream. */
  browserId: number;
  className?: string;
  /** `peek` thumbnail, `rail` sidebar pin, `detail` the agent panel. */
  variant: "peek" | "rail" | "detail";
};

/** Subscribe to the webview hiding or showing (window closed to the menu bar, minimised). */
function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True while the webview is visible. */
function visibleSnapshot(): boolean {
  return document.visibilityState === "visible";
}

/**
 * View-only live MJPEG of the virtual display from Nas `GET /browsers/:id/stream`.
 * The stream is open only while the mesh is connected and the webview is visible, so a
 * hidden window or an unmounted frame closes it and Nas stops its ffmpeg. The caption sits
 * under the image until the first frame paints over it; a stream error replaces the image.
 */
export function BrowserFrame({ browserId, className, variant }: BrowserFrameProps) {
  const { state: connection } = useConnection();
  const visible = useSyncExternalStore(subscribeVisibility, visibleSnapshot);
  const [failedId, setFailedId] = useState<number | null>(null);
  const failed = failedId === browserId;
  const live = connection === "connected" && visible && !failed;

  const size =
    variant === "peek"
      ? "h-[96px] w-[170px]"
      : variant === "detail"
        ? "h-[228px] w-full"
        : "aspect-[16/10] w-full";
  const chrome =
    variant === "peek"
      ? "rounded-[var(--radius)] border border-dashed border-sage-line bg-bone/80"
      : "bg-sage-faint";

  return (
    <div className={`relative overflow-hidden ${chrome} ${size} ${className ?? ""}`}>
      <div className="absolute inset-0 flex items-center justify-center px-2 text-[11px] tracking-wide text-ink-ghost">
        {failed ? `Browser ${browserId} stream failed` : `Browser ${browserId}`}
      </div>
      {live ? (
        <img
          src={nas.browserStreamUrl(browserId)}
          alt={`Browser ${browserId}`}
          className="absolute inset-0 h-full w-full object-cover object-top"
          draggable={false}
          onError={() => setFailedId(browserId)}
        />
      ) : null}
    </div>
  );
}

import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useConnection } from "../../shared/hooks/useConnection";
import { createInputSender, keyInput, pointerInput, wheelInput } from "./browserInput";
import {
  DRIVE_PROFILE,
  retryBrowserStream,
  type StreamProfile,
  subscribeBrowserStream,
  WATCH_PROFILE,
} from "./browserStream";

export type BrowserFrameProps = {
  /** Nas browser id whose virtual display to stream. */
  browserId: number;
  className?: string;
  /** `peek` thumbnail, `rail` sidebar pin, `detail` the agent panel, `full` the whole 16:9 display at its parent's width (the expanded view). */
  variant: "peek" | "rail" | "detail" | "full";
};

/** The stream each variant draws: the expanded view is driven, the rest only watch. */
function profileFor(variant: BrowserFrameProps["variant"]): StreamProfile {
  return variant === "full" ? DRIVE_PROFILE : WATCH_PROFILE;
}

/** What the frame shows over (or instead of) the picture. */
type Overlay =
  | { kind: "caption" }
  | { kind: "none" }
  | { kind: "retrying"; error: string }
  | { kind: "failed"; error: string };

/** Subscribe to the webview hiding or showing (window closed to the menu bar, minimised). */
function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True while the webview is visible. */
function visibleSnapshot(): boolean {
  return document.visibilityState === "visible";
}

/** Draw `frame` over the whole canvas, cropped to fill it from the top (CSS object-fit: cover, top). */
function paintCover(canvas: HTMLCanvasElement, frame: VideoFrame): void {
  const width = Math.round(canvas.clientWidth * window.devicePixelRatio);
  const height = Math.round(canvas.clientHeight * window.devicePixelRatio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const scale = Math.max(width / frame.displayWidth, height / frame.displayHeight);
  const drawn = frame.displayWidth * scale;
  canvas.getContext("2d")?.drawImage(frame, (width - drawn) / 2, 0, drawn, frame.displayHeight * scale);
}

/**
 * Live view of the virtual display from Nas `GET /browsers/:id/stream`, drawn
 * on a canvas from the browser's shared stream (see browserStream.ts). It watches only
 * while the mesh is connected and the webview is visible, so a hidden window or an
 * unmounted frame lets the connection close. The caption shows until the first frame; a
 * reconnect keeps the last frame under a badge; a failure shows the error and a retry.
 * The `full` variant is also a remote control: pointer, wheel and key events go to the
 * browser through Nas with no lock, so the agent keeps working alongside.
 */
export function BrowserFrame({ browserId, className, variant }: BrowserFrameProps) {
  const { state: connection } = useConnection();
  const visible = useSyncExternalStore(subscribeVisibility, visibleSnapshot);
  const live = connection === "connected" && visible;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlay, setOverlay] = useState<Overlay>({ kind: "caption" });
  const [inputError, setInputError] = useState<string | null>(null);
  const driving = variant === "full";
  const profile = profileFor(variant);
  const sender = useMemo(() => createInputSender(browserId, setInputError), [browserId]);

  useEffect(() => {
    if (!live) {
      return;
    }
    let painted = false;
    return subscribeBrowserStream(browserId, profile, (state) => {
      if (state.phase === "live") {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        paintCover(canvas, state.frame);
        if (!painted) {
          painted = true;
          setOverlay({ kind: "none" });
        }
        return;
      }
      if (state.phase === "opening") {
        setOverlay(painted ? { kind: "none" } : { kind: "caption" });
        return;
      }
      setOverlay(
        state.phase === "failed" || !painted
          ? { kind: state.phase, error: state.error }
          : { kind: "retrying", error: state.error },
      );
    });
  }, [browserId, profile, live]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!driving || !canvas) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      sender.push(wheelInput(canvas, e));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [driving, sender]);

  const driveHandlers = {
    onPointerDown: (e: PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      setInputError(null);
      sender.push(pointerInput("down", e.currentTarget, e));
    },
    onPointerMove: (e: PointerEvent<HTMLCanvasElement>) => sender.push(pointerInput("move", e.currentTarget, e)),
    onPointerUp: (e: PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      sender.push(pointerInput("up", e.currentTarget, e));
    },
    onContextMenu: (e: MouseEvent<HTMLCanvasElement>) => e.preventDefault(),
    onKeyDown: (e: KeyboardEvent<HTMLCanvasElement>) => forwardKey("key_down", e),
    onKeyUp: (e: KeyboardEvent<HTMLCanvasElement>) => forwardKey("key_up", e),
  };

  const forwardKey = (kind: "key_down" | "key_up", e: KeyboardEvent<HTMLCanvasElement>) => {
    const event = keyInput(kind, e);
    if (event) {
      e.preventDefault();
      sender.push(event);
    }
  };

  const size =
    variant === "peek"
      ? "h-[96px] w-[170px]"
      : variant === "detail"
        ? "h-[228px] w-full"
        : variant === "full"
          ? "aspect-video w-full"
          : "aspect-[16/10] w-full";
  const chrome =
    variant === "peek"
      ? "rounded-[var(--radius)] border border-dashed border-sage-line bg-bone/80"
      : "bg-sage-faint";
  const compact = variant === "peek" || variant === "rail";

  return (
    <div className={`relative overflow-hidden ${chrome} ${size} ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        aria-label={`Browser ${browserId}`}
        tabIndex={driving ? 0 : undefined}
        {...(driving ? driveHandlers : {})}
        className={`absolute inset-0 h-full w-full touch-none outline-none transition-opacity duration-slow ease-dadi ${
          overlay.kind === "caption" || overlay.kind === "failed" ? "opacity-0" : "opacity-100"
        }`}
      />
      {inputError !== null ? (
        <span
          title={inputError}
          className="absolute top-1.5 left-1.5 rounded-full bg-glass-sheet px-2 py-0.5 text-[10px] text-error backdrop-blur-md"
        >
          input failed
        </span>
      ) : null}
      {overlay.kind === "caption" ? (
        <div className="absolute inset-0 flex items-center justify-center px-2 text-[11px] tracking-wide text-ink-ghost">
          <span className="animate-breath">Browser {browserId}</span>
        </div>
      ) : null}
      {overlay.kind === "retrying" ? (
        <span
          title={overlay.error}
          className="absolute top-1.5 right-1.5 rounded-full bg-glass-sheet px-2 py-0.5 text-[10px] text-ink-muted backdrop-blur-md"
        >
          reconnecting…
        </span>
      ) : null}
      {overlay.kind === "failed" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
          <p
            className={`text-[11px] leading-snug text-error ${compact ? "line-clamp-2" : "line-clamp-3"}`}
            title={overlay.error}
          >
            Browser {browserId} stream failed: {overlay.error}
          </p>
          <button
            type="button"
            onClick={() => retryBrowserStream(browserId, profile)}
            className="rounded-full bg-sage-fill px-2.5 py-0.5 text-[11px] text-sage-deep transition-colors duration-slow ease-dadi hover:bg-sage-line/60"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}

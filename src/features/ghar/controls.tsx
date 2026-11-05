import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

/**
 * A value the user is dragging, shown in place of the real one until the real one changes: the drag follows the pointer,
 * the command is sent once on release, and the dragged value stays until Ghar's accepted state arrives.
 * @returns the value to show and the setter a slider's `onDrag` calls
 */
export function useDraft(value: number): [number, (next: number) => void] {
  const [draft, setDraft] = useState<number | null>(null);
  useEffect(() => setDraft(null), [value]);
  return [draft ?? value, setDraft];
}

export type SliderProps = {
  /** Where the knob sits, 0 to 100. */
  value: number;
  /** The colour of the fill and the knob's ring. */
  color: string;
  /** The track's thickness in px. */
  thickness: number;
  /** The accessible name. */
  name: string;
  /** What the value reads as, for assistive technology. */
  text: string;
  disabled?: boolean;
  /** The value under the pointer or key while it moves, 0 to 100. */
  onDrag: (percent: number) => void;
  /** The value the user settled on, as a fraction 0 to 1; called once on release or key press. */
  onCommit: (fraction: number) => void;
};

/** A horizontal slider: a track, its fill and a knob. A drag follows the pointer and commits once on release; the arrow, page, home and end keys step it. */
export function Slider({ value, color, thickness, name, text, disabled = false, onDrag, onCommit }: SliderProps) {
  const drag = useRef<number | null>(null);
  const at = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };
  const press = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[event.key];
    const target = event.key === "Home" ? 0 : event.key === "End" ? 100 : step === undefined ? null : Math.min(100, Math.max(0, value + step));
    if (target === null) {
      return;
    }
    event.preventDefault();
    onDrag(target);
    onCommit(target / 100);
  };
  return (
    <div
      role="slider"
      tabIndex={disabled ? undefined : 0}
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-valuetext={text}
      aria-disabled={disabled ? true : undefined}
      onPointerDown={(event) => {
        if (disabled || event.button !== 0) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = at(event);
        onDrag(drag.current * 100);
      }}
      onPointerMove={(event) => {
        if (drag.current === null) {
          return;
        }
        drag.current = at(event);
        onDrag(drag.current * 100);
      }}
      onPointerUp={() => {
        if (drag.current !== null) {
          onCommit(drag.current);
          drag.current = null;
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onKeyDown={disabled ? undefined : press}
      style={{ position: "relative", height: 24, display: "flex", alignItems: "center", touchAction: "none", ...(disabled ? { opacity: 0.45 } : {}) }}
    >
      <span style={{ display: "block", width: "100%", height: thickness, borderRadius: thickness, background: "var(--rule)" }} />
      <span style={{ position: "absolute", left: 0, width: `${value}%`, height: thickness, borderRadius: thickness, background: color }} />
      <span
        style={{ position: "absolute", left: `calc(${value}% - 10px)`, width: 20, height: 20, borderRadius: "50%", background: "var(--bone)", border: `2px solid ${color}`, boxShadow: "var(--shadow)" }}
      />
    </div>
  );
}

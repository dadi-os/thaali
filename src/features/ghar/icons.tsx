import type { ReactNode } from "react";
import type { GharKind } from "../../types/ghar";

/** Line glyphs (24 viewBox) for each kind of device a tile shows. */
const GLYPH: Partial<Record<GharKind, ReactNode>> & { other: ReactNode } = {
  light: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v4M15 3v4" />
      <path d="M6 7h12v4a6 6 0 0 1-12 0V7Z" />
      <path d="M12 17v4" />
    </>
  ),
  switch: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="3" />
      <rect x="9.5" y="7" width="5" height="5" rx="1.2" />
    </>
  ),
  fan: (
    <>
      <circle cx="12" cy="12" r="1.6" />
      <path d="M12 10.4C12 6 13 3.5 15.5 3.5c2 0 2.4 3 .2 5.2L13.4 11" />
      <path d="M13.6 12c4.4 0 6.9 1 6.9 3.5 0 2-3 2.4-5.2.2L13 13.4" />
      <path d="M12 13.6c0 4.4-1 6.9-3.5 6.9-2 0-2.4-3-.2-5.2l2.3-2.3" />
      <path d="M10.4 12C6 12 3.5 11 3.5 8.5c0-2 3-2.4 5.2-.2L11 10.6" />
    </>
  ),
  thermostat: (
    <>
      <path d="M10 4a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0V4Z" />
      <path d="M12 9v7" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  cover: (
    <>
      <path d="M4 4h16M5 4v12M19 4v12" />
      <path d="M5 8h14M5 12h14M5 16h14" />
      <path d="M12 16v4" />
    </>
  ),
  contact: (
    <>
      <rect x="4" y="5" width="6" height="14" rx="1.5" />
      <rect x="14" y="5" width="6" height="14" rx="1.5" />
    </>
  ),
  occupancy: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M9 21l2-6-2-3 3-4 3 4h3M12 15l2 6" />
    </>
  ),
  humidity: <path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10Z" />,
  speaker: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="3" />
      <circle cx="12" cy="14.5" r="3" />
      <circle cx="12" cy="7.5" r="1" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="M16 11l5-3v8l-5-3" />
    </>
  ),
  robot_vacuum: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M7.5 9h9" />
      <circle cx="12" cy="14" r="1.5" />
    </>
  ),
  other: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" />
    </>
  ),
};

/** The glyph each kind borrows when it has none of its own. */
const SAME_AS: Partial<Record<GharKind, GharKind>> = {
  air_purifier: "fan",
  air_conditioner: "thermostat",
  heat_pump: "thermostat",
  water_heater: "thermostat",
  temperature: "thermostat",
  leak: "humidity",
  rain: "humidity",
  doorbell: "camera",
};

/** A device kind's line glyph, sized by its parent. */
export function KindIcon({ kind }: { kind: GharKind }) {
  const glyph = GLYPH[kind] ?? GLYPH[SAME_AS[kind] ?? "other"] ?? GLYPH.other;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-full"
    >
      {glyph}
    </svg>
  );
}

/** A sun, on the brightness pill. */
export function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="size-full">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  );
}

/** Three sliders: open a tile's controls. */
export function IconSliders() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden className="size-full">
      <path d="M3 4h10M3 8h10M3 12h10" opacity="0.45" />
      <circle cx="6" cy="4" r="1.6" fill="currentColor" />
      <circle cx="10.5" cy="8" r="1.6" fill="currentColor" />
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** Two rings: a group, on its chip. */
export function IconGroup() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="size-full">
      <circle cx="8" cy="12" r="4" />
      <circle cx="16" cy="12" r="4" />
    </svg>
  );
}

/** A crescent, on Evening. */
export function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="size-full">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

/** A plus, on the add tiles and New room. */
export function IconAdd() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="size-full">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Three dots: a room's options. */
export function IconMore() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-full">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/** A chevron pointing right, on the inspector's pickers. */
export function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`size-full transition-transform duration-slow ease-dadi ${open ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

import type { CSSProperties } from "react";

/** The icon set: stroke paths on a 24 px grid, drawn at 1.8 px in the current text color. */
const PATHS = {
  chevron: "M9 6l6 6-6 6",
  chevDown: "M6 9l6 6 6-6",
  back: "M15 5l-7 7 7 7",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 8v5M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  info: "M12 11v6M12 7.5h.01M12 21a9 9 0 100-18 9 9 0 000 18z",
  clock: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
  lock: "M7 11V8a5 5 0 0110 0v3M6 11h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z",
  copy: "M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  terminal: "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM7 10l3 2-3 2M12 15h5",
  browser: "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3 9h18M7 7h.01M10 7h.01",
  bolt: "M13 3L4 14h6l-1 7 9-11h-6l1-7z",
  send: "M5 12l14-7-5 14-2-6-7-1z",
  clip: "M20 11.5l-8 8a5 5 0 01-7-7l8.5-8.5a3.3 3.3 0 014.7 4.7L9.7 17.2a1.7 1.7 0 01-2.4-2.4L15 7",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  graph: "M6 6a2 2 0 100-4 2 2 0 000 4zM18 10a2 2 0 100-4 2 2 0 000 4zM8 22a2 2 0 100-4 2 2 0 000 4zM7.7 5.4l8.6 4M8 18.2l8.5-6.6",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  wifi: "M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5h.01",
  wifiOff: "M3 3l18 18M2 9a15 15 0 015.4-3.3M5 12.5a10 10 0 013.5-2.4M8.5 16a5 5 0 013.4-1.4M17 12.7a10 10 0 012 1.8M12 19.5h.01",
  retry: "M20 12a8 8 0 11-2.3-5.7M20 4v5h-5",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  key: "M15 8a4 4 0 11-3.9 4.9L3 21v-3h3v-3h3l2-2A4 4 0 0115 8zM16.5 8.5h.01",
  note: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  card: "M3 6h18v12H3zM3 10h18",
  folder: "M3 6a1 1 0 011-1h5l2 2h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  power: "M12 3v9M6.4 7.2a8 8 0 1011.2 0",
  home: "M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z",
  cal: "M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M8 3v4M16 3v4",
  server: "M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01",
  drive: "M3 14l3-8h12l3 8v5H3zM3 14h18M7 17h.01",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h.01M20 14h.01",
  link: "M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  expand: "M4 14v6h6M20 10V4h-6M4 20l7-7M20 4l-7 7",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  pause: "M8 5v14M16 5v14",
  play: "M7 4l13 8-13 8z",
  drag: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
  filter: "M3 5h18l-7 8v6l-4-2v-4z",
  mic: "M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3zM6 11a6 6 0 0012 0M12 17v4",
  camera: "M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM12 17a4 4 0 100-8 4 4 0 000 8z",
  image: "M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM8 11a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM21 16l-5-5-8 8",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5",
  minimize: "M5 12h14",
  maximize: "M6 6h12v12H6z",
  restore: "M9 9h9v9H9zM6 14V6h8",
  brain: "M9.5 3A3.5 3.5 0 006 6.5v.2A3.5 3.5 0 004 10a3.5 3.5 0 001.2 2.6A3.5 3.5 0 006 17a3.5 3.5 0 003.5 3.5M9.5 3v17.5M9.5 3A2.5 2.5 0 0112 5.5M14.5 3A3.5 3.5 0 0118 6.5v.2A3.5 3.5 0 0120 10a3.5 3.5 0 01-1.2 2.6A3.5 3.5 0 0118 17a3.5 3.5 0 01-3.5 3.5M14.5 3v17.5M14.5 3A2.5 2.5 0 0012 5.5",
  download: "M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14",
} as const;

/** The name of one icon in the set. */
export type IconName = keyof typeof PATHS;

/** Every icon name, in the order the set lists them. */
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export type IconProps = {
  name: IconName;
  /** Width and height in px. */
  size?: number;
  /** Extra inline style, merged after `flex: none`. */
  style?: CSSProperties;
};

/** One icon from the set; it never shrinks inside a flex row and is hidden from assistive technology. */
export function Icon({ name, size = 16, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none", ...style }}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

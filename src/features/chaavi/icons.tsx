/** Stroke glyphs for the vault: one per item type, plus folder, star and edit marks. */

import type { ChaaviItemType } from "../../types/chaavi";

export type TypeGlyphProps = {
  type: ChaaviItemType;
  /** Pixel size of the square glyph. */
  size?: number;
};

/** The glyph for an item type, drawn in the current text color. */
export function TypeGlyph({ type, size = 16 }: TypeGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      {type === "login" ? (
        <>
          <circle cx="6" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9.2 9h6.3M13.4 9v2.4M15.5 9v1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : type === "note" ? (
        <>
          <path d="M4.5 2.8h6.2l2.8 2.8v9.6H4.5V2.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M6.8 8.4h4.4M6.8 11h4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : type === "card" ? (
        <>
          <rect x="2.2" y="4.2" width="13.6" height="9.6" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.2 7.4h13.6M4.8 11h2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : type === "identity" ? (
        <>
          <circle cx="9" cy="6.6" r="2.8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3.8 15c.6-2.8 2.7-4.3 5.2-4.3s4.6 1.5 5.2 4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : type === "bankAccount" ? (
        <>
          <path d="M2.6 6.4 9 2.8l6.4 3.6H2.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M4.4 8.4v4.6M7.4 8.4v4.6M10.6 8.4v4.6M13.6 8.4v4.6M2.6 15.2h12.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : type === "driversLicense" ? (
        <>
          <rect x="2.2" y="4.2" width="13.6" height="9.6" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="6.2" cy="8.2" r="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4 11.6c.4-1 1.2-1.5 2.2-1.5s1.8.5 2.2 1.5M10.2 7.6h3.4M10.2 10.2h2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </>
      ) : type === "passport" ? (
        <>
          <rect x="4" y="2.4" width="10" height="13.2" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6.6 8h4.8M9 5.6c.8.7 1.1 1.5 1.1 2.4s-.3 1.7-1.1 2.4c-.8-.7-1.1-1.5-1.1-2.4s.3-1.7 1.1-2.4ZM6.8 13h4.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="2.2" y="3.4" width="13.6" height="11.2" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
          <path d="m5.4 7.4 2 1.6-2 1.6M9.4 11h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export type IconFolderProps = {
  /** Dashed outline, for "No folder". */
  dashed?: boolean;
};

/** A folder outline. */
export function IconFolder({ dashed = false }: IconFolderProps) {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.5 5.2c0-.9.7-1.6 1.6-1.6h3l1.5 1.6h5.3c.9 0 1.6.7 1.6 1.6v6.4c0 .9-.7 1.6-1.6 1.6H4.1c-.9 0-1.6-.7-1.6-1.6V5.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "2 2" : undefined}
      />
    </svg>
  );
}

export type IconStarProps = {
  /** Solid when the item is a favorite. */
  filled: boolean;
  size?: number;
};

/** A favorite star. */
export function IconStar({ filled, size = 15 }: IconStarProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill={filled ? "currentColor" : "none"} aria-hidden>
      <path
        d="m9 2.6 1.9 4 4.4.5-3.3 3 .9 4.3L9 12.2l-3.9 2.2.9-4.3-3.3-3 4.4-.5L9 2.6Z"
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A pencil: rename or edit. */
export function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="m11.8 3.6 2.6 2.6-7.9 7.9-3.3.7.7-3.3 7.9-7.9Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

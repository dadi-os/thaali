/** Stroke glyphs for the vault: folder, star, edit and the detail actions. */

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

/** An open eye: reveal a hidden value. */
export function IconEye() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M1.8 9S4.5 4.2 9 4.2 16.2 9 16.2 9 13.5 13.8 9 13.8 1.8 9 1.8 9Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="2.1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** A struck eye: hide a revealed value. */
export function IconEyeOff() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M1.8 9S4.5 4.2 9 4.2 16.2 9 16.2 9 13.5 13.8 9 13.8 1.8 9 1.8 9Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m3 15 12-12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** A turning arc: the action is in flight. */
export function IconSpinner() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden className="animate-spin">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path d="M9 3a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** An arrow leaving a box: open in a new tab. */
export function IconExternal() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M7.5 4.2H4.2v9.6h9.6v-3.3M10.5 3h4.5v4.5M15 3 8.6 9.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A bin: delete. */
export function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M3.4 5h11.2M7.2 5V3.4h3.6V5M5 5l.6 9.2h6.8L13 5M7.6 7.8v3.6M10.4 7.8v3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

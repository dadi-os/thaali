import { IconDismiss, IconSearch } from "./IconButton";

export type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Also the accessible name. */
  placeholder: string;
  /** Items matching the query; null while the query is empty. */
  matches: number | null;
  /** Enter pressed while something matches; the caller picks the lone match or an exact one. */
  onPick: () => void;
  /** Width utility; a page header's box is `w-80`. */
  className?: string;
};

/**
 * Page search box, rendered in the page header's trailing slot. Escape or the
 * clear button empties it; Enter while anything matches asks the caller to pick.
 */
export function SearchField({ value, onChange, placeholder, matches, onPick, className = "w-80" }: SearchFieldProps) {
  return (
    <label className={`flex h-9 ${className} items-center gap-2 rounded-[10px] border border-(--glass-border) bg-(--glass-sheet) px-3 transition-[border-color,background-color] duration-slow ease-dadi focus-within:border-sage hover:border-sage-line`}>
      <span className="flex size-4 shrink-0 text-ink-ghost">
        <IconSearch />
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
          } else if (e.key === "Enter" && matches !== null && matches > 0) {
            onPick();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-ghost [&::-webkit-search-cancel-button]:appearance-none"
      />
      {matches !== null ? (
        <span
          className={`shrink-0 text-[10px] font-medium tracking-[1.2px] uppercase ${
            matches === 0 ? "text-ink-ghost" : "text-sage-deep"
          }`}
        >
          {matches === 1 ? "1 match" : `${matches} matches`}
        </span>
      ) : null}
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-full text-ink-ghost transition-colors duration-slow ease-dadi hover:bg-sage-active hover:text-sage-deep"
        >
          <IconDismiss />
        </button>
      ) : null}
    </label>
  );
}

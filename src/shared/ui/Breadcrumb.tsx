import { Fragment, useState, type KeyboardEvent } from "react";
import { AnchoredMenu } from "../overlay/AnchoredMenu";
import { useSize } from "../hooks/useSize";
import { Icon, type IconName } from "./Icon";

/** One step of a {@link Breadcrumb}. */
export type BreadcrumbItem = {
  label: string;
  /** Opens this step. Left out, the step is plain text. The last item is always plain: it is where the person already is. */
  onSelect?: () => void;
  /** A glyph before the label: a site mark, the home, a folder. */
  icon?: IconName;
};

/** Props of {@link Breadcrumb}. */
export type BreadcrumbProps = {
  /** The path from the outermost step to the current one, in order. */
  items: BreadcrumbItem[];
  /** The accessible name of the trail. */
  label?: string;
  className?: string;
};

/** The room one step is given when deciding how many fit, in px. */
const STEP_PX = 90;
/** The widest a step's label grows before it is cut, in px. */
const LABEL_MAX_PX = 200;

/**
 * Which steps of a trail of `count` stay when only `fit` of them fit: the first and the last `fit - 1`, with the middle
 * collapsed into one ellipsis. Nothing collapses when they all fit; at least the first and the current step always show.
 */
export function collapseCrumbs(count: number, fit: number): { head: number; tail: number } {
  const shown = Math.max(2, fit);
  return count <= shown ? { head: count, tail: 0 } : { head: 1, tail: shown - 1 };
}

/**
 * The one path or hierarchy header: steps separated by chevrons, the last one the current place and not a control, the earlier
 * ones buttons with the app's hover wash when they have `onSelect`. Long labels are cut with the whole text in `title`; when the
 * trail is narrower than its steps, the middle ones fold into an ellipsis that opens them as a menu. Left and Right move between steps.
 */
export function Breadcrumb({ items, label = "Breadcrumb", className = "" }: BreadcrumbProps) {
  const [ref, size] = useSize<HTMLElement>();
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const { head, tail } = size.width === 0 ? { head: items.length, tail: 0 } : collapseCrumbs(items.length, Math.floor(size.width / STEP_PX));
  const hidden = items.slice(head, items.length - tail);
  const last = items.length - 1;

  const move = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) {
      return;
    }
    const stops = [...event.currentTarget.querySelectorAll<HTMLElement>("button")];
    const next = stops[stops.indexOf(document.activeElement as HTMLElement) + step];
    if (next !== undefined) {
      event.preventDefault();
      next.focus();
    }
  };

  const step = (item: BreadcrumbItem, index: number) => {
    const glyph = item.icon === undefined ? null : <Icon name={item.icon} size={14} style={{ flex: "none" }} />;
    const text = (
      <span className="truncate" style={{ maxWidth: LABEL_MAX_PX }}>
        {item.label}
      </span>
    );
    if (index === last) {
      return (
        <span key={index} aria-current="page" title={item.label} className="flex h-7 flex-none items-center gap-1.5 px-1.5 font-semibold text-ink">
          {glyph}
          {text}
        </span>
      );
    }
    return item.onSelect === undefined ? (
      <span key={index} title={item.label} className="flex h-7 min-w-0 items-center gap-1.5 px-1.5">
        {glyph}
        {text}
      </span>
    ) : (
      <button key={index} type="button" title={item.label} onClick={item.onSelect} className={`ui-trans ui-hover-fill flex h-7 ${index === 0 ? "flex-none" : "min-w-0"} items-center gap-1.5 rounded-[8px] px-1.5 text-ink-muted hover:text-ink`}>
        {glyph}
        {text}
      </button>
    );
  };

  const shown = items.map((item, index) => ({ item, index })).filter(({ index }) => index < head || index >= items.length - tail);

  return (
    <nav ref={ref} aria-label={label} onKeyDown={move} className={`flex min-w-0 items-center gap-0.5 overflow-hidden text-[13px] text-ink-muted ${className}`}>
      {shown.map(({ item, index }) => (
        <Fragment key={index}>
          {index === 0 ? null : <Icon name="chevron" size={11} style={{ flex: "none", opacity: 0.6 }} />}
          {index === items.length - tail && hidden.length > 0 ? (
            <>
              <button type="button" aria-label={`${hidden.length} more`} aria-haspopup="menu" onClick={(event) => setMenu(event.currentTarget.getBoundingClientRect())} className="ui-trans ui-hover-fill flex h-7 flex-none items-center rounded-[8px] px-1.5 hover:text-ink">
                <Icon name="dots" size={14} />
              </button>
              <Icon name="chevron" size={11} style={{ flex: "none", opacity: 0.6 }} />
            </>
          ) : null}
          {step(item, index)}
        </Fragment>
      ))}
      <AnchoredMenu
        actions={hidden.map((item, index) => ({ id: `crumb-${index}`, label: item.label, icon: item.icon, run: item.onSelect ?? (() => undefined), disabledReason: item.onSelect === undefined ? "Not a place to open" : undefined }))}
        anchor={menu}
        onClose={() => setMenu(null)}
      />
    </nav>
  );
}

import { useEffect, useRef, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { pushToast } from "../../contexts/toasts";
import { Icon } from "../ui/Icon";
import { Truncate } from "../ui/Truncate";
import { tidyActions, type Action, type ActionList } from "../interaction/actions";
import { MENU } from "../motion";

/** Turn a key combination such as "mod+shift+k" into what a menu row shows: ⌘⇧K on a Mac. */
function shortcutLabel(shortcut: string): string {
  const mac = navigator.platform.startsWith("Mac");
  return shortcut
    .split("+")
    .map((part) => {
      switch (part) {
        case "mod":
          return mac ? "⌘" : "Ctrl";
        case "shift":
          return mac ? "⇧" : "Shift";
        case "alt":
          return mac ? "⌥" : "Alt";
        default:
          return part.length === 1 ? part.toUpperCase() : part;
      }
    })
    .join(mac ? "" : "+");
}

/** Run an action; a failure reaches the person as a toast instead of vanishing. */
function runAction(action: Action): void {
  void Promise.resolve()
    .then(action.run)
    .catch((err: unknown) => {
      pushToast({ key: `action:${action.id}`, tone: "error", title: `${action.label} failed`, body: err instanceof Error ? err.message : String(err) });
    });
}

/** Props of {@link MenuSurface}. */
export type MenuSurfaceProps = {
  /** The rows, in order. */
  actions: ActionList;
  /** Called after a row is chosen, so the host can close the menu. */
  onChosen: () => void;
  /** Where the surface grows from, as a CSS transform origin. */
  origin?: string;
  /** Width in px. */
  width?: number;
};

/**
 * The menu panel: rows with an icon, a label, a shortcut and a check, arrow keys to move, Enter to choose.
 * One panel for every menu in the app (context menus, `...` menus, dropdowns).
 */
export function MenuSurface({ actions, onChosen, origin = "top left", width = 220 }: MenuSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = tidyActions(actions);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, []);

  const move = (event: KeyboardEvent<HTMLDivElement>): void => {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    }
  };

  return (
    <motion.div
      ref={ref}
      role="menu"
      className="floating menu-panel"
      style={{ width, transformOrigin: origin, animation: "none" }}
      onKeyDown={move}
      onContextMenu={(event) => event.preventDefault()}
      {...MENU}
    >
      {rows.map((row, i) =>
        row === "separator" ? (
          <div key={`s${i}`} role="separator" style={{ height: 1, margin: "4px 8px", background: "var(--rule)" }} />
        ) : (
          <button
            key={row.id}
            type="button"
            role="menuitem"
            disabled={row.disabledReason !== undefined}
            title={row.disabledReason}
            className={["menu-item", row.selected ? "menu-item-on" : "", "ui-trans", "ui-hover-fill"].join(" ")}
            style={row.destructive ? { color: "var(--error)" } : undefined}
            onClick={() => {
              if (row.keepOpen !== true) {
                onChosen();
              }
              runAction(row);
            }}
          >
            <span style={{ display: "flex", width: 15, color: row.destructive ? "var(--error)" : "var(--ink-muted)" }}>{row.icon ? <Icon name={row.icon} size={15} /> : null}</span>
            <Truncate text={row.label} style={{ flex: 1, minWidth: 0 }} />
            {row.shortcut ? <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{shortcutLabel(row.shortcut)}</span> : null}
            {row.selected ? (
              <span style={{ display: "flex", color: "var(--sage-deep)" }}>
                <Icon name="check" size={15} />
              </span>
            ) : null}
          </button>
        ),
      )}
    </motion.div>
  );
}

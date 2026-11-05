import { useEffect, useId, useRef } from "react";
import { copyText, readText } from "../desktop/clipboard";
import type { ActionList } from "./actions";

/** Where a context menu opens and what it holds. */
export type ContextRequest = {
  /** Pointer position in viewport px. */
  x: number;
  y: number;
  actions: ActionList;
};

/** The action getters of every mounted element that offers a context menu, by id. */
const registry = new Map<string, () => ActionList | null>();

/**
 * Offer a context menu from an element: spread the result on it. Right-clicking the element, or anything
 * inside it that offers none itself, opens a menu of the actions returned at that moment, drawn by the
 * shared menu. Return `null` for no menu. A component never handles `contextmenu` itself.
 */
export function useContextActions(getActions: () => ActionList | null): { "data-context": string } {
  const id = useId();
  const latest = useRef(getActions);
  latest.current = getActions;
  useEffect(() => {
    registry.set(id, () => latest.current());
    return () => {
      registry.delete(id);
    };
  }, [id]);
  return { "data-context": id };
}

/** The actions of the nearest registered ancestor of `target` that has any. */
function registeredActions(target: Element): ActionList | null {
  for (let el: Element | null = target.closest("[data-context]"); el !== null; el = el.parentElement?.closest("[data-context]") ?? null) {
    const get = registry.get(el.getAttribute("data-context") ?? "");
    const actions = get === undefined ? null : get();
    if (actions !== null && actions.length > 0) {
      return actions;
    }
  }
  return null;
}

/** The field `target` is in, when it takes text. */
function fieldOf(target: Element): HTMLInputElement | HTMLTextAreaElement | null {
  const field = target.closest("input, textarea");
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.disabled || field.type === "checkbox" || field.type === "radio" || field.type === "range" ? null : field;
  }
  return null;
}

/** Replace the field's selection with `text`, as typing would. */
function insertInto(field: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  field.setRangeText(text, field.selectionStart ?? 0, field.selectionEnd ?? 0, "end");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Cut, copy, paste and select all for a text field. */
function fieldActions(field: HTMLInputElement | HTMLTextAreaElement): ActionList {
  const start = field.selectionStart ?? 0;
  const end = field.selectionEnd ?? 0;
  const selected = field.value.slice(start, end);
  const secret = field instanceof HTMLInputElement && field.type === "password";
  const canEdit = !field.readOnly;
  return [
    ...(canEdit
      ? [
          {
            id: "cut",
            label: "Cut",
            icon: "close" as const,
            shortcut: "mod+x",
            disabledReason: selected === "" || secret ? "Nothing selected" : undefined,
            run: async () => {
              await copyText(selected);
              insertInto(field, "");
            },
          },
        ]
      : []),
    {
      id: "copy",
      label: "Copy",
      icon: "copy" as const,
      shortcut: "mod+c",
      disabledReason: selected === "" || secret ? "Nothing selected" : undefined,
      run: () => copyText(selected),
    },
    ...(canEdit
      ? [
          {
            id: "paste",
            label: "Paste",
            icon: "clip" as const,
            shortcut: "mod+v",
            run: async () => {
              field.focus();
              insertInto(field, await readText());
            },
          },
        ]
      : []),
    "separator",
    {
      id: "select-all",
      label: "Select all",
      shortcut: "mod+a",
      disabledReason: field.value === "" ? "Empty" : undefined,
      run: () => {
        field.focus();
        field.select();
      },
    },
  ];
}

/** Copy for text selected in readable content. */
function selectionActions(text: string): ActionList {
  return [{ id: "copy", label: "Copy", icon: "copy", shortcut: "mod+c", run: () => copyText(text) }];
}

/**
 * Take over the window's context menu. The native menu never shows. Right-clicking a text field opens a
 * cut, copy, paste and select all menu; right-clicking selected readable text opens copy; anything else opens
 * the menu its nearest {@link useContextActions} element offers, and nothing opens where none does.
 * Returns the function that stops it.
 */
export function installContextMenu(open: (request: ContextRequest) => void): () => void {
  const onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const field = fieldOf(target);
    if (field !== null) {
      open({ x: event.clientX, y: event.clientY, actions: fieldActions(field) });
      return;
    }
    const selected = window.getSelection()?.toString() ?? "";
    if (selected !== "" && target.closest("[data-selectable], .chat-md") !== null) {
      open({ x: event.clientX, y: event.clientY, actions: selectionActions(selected) });
      return;
    }
    const actions = registeredActions(target);
    if (actions !== null) {
      open({ x: event.clientX, y: event.clientY, actions });
    }
  };
  document.addEventListener("contextmenu", onContextMenu);
  return () => document.removeEventListener("contextmenu", onContextMenu);
}

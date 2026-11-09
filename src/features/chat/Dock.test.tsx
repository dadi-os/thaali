// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dock, type DockProps } from "./Dock";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Draws an open dock holding `draft`, with `routing` as the shared router state says. */
function render(draft: string, routing: boolean, onSend: () => void): void {
  const props: DockProps = {
    open: true,
    routing,
    offline: false,
    draft,
    onDraft: vi.fn(),
    attachments: [],
    onRemoveAttachment: vi.fn(),
    onPickFiles: vi.fn(),
    onAttach: vi.fn(),
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onSend,
    textareaRef: createRef<HTMLTextAreaElement>(),
  };
  act(() => root.render(<Dock {...props} />));
}

describe("Dock while the router runs", () => {
  it("holds the send, keeps the draft in the field and says Dadi is busy", () => {
    const onSend = vi.fn();
    render("book the flight", true, onSend);
    const send = host.querySelector<HTMLButtonElement>("button.dsend")!;
    expect(send.disabled).toBe(true);
    expect(send.getAttribute("aria-label")).toBe("Dadi is busy");
    expect(host.querySelector("textarea")!.value).toBe("book the flight");
    expect(host.textContent).toContain("Dadi is busy");
    act(() => host.querySelector("textarea")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends once the router is free", () => {
    const onSend = vi.fn();
    render("book the flight", false, onSend);
    const send = host.querySelector<HTMLButtonElement>("button.dsend")!;
    expect(send.disabled).toBe(false);
    act(() => send.click());
    expect(onSend).toHaveBeenCalledOnce();
  });
});

describe("Dock field height", () => {
  it("keeps the height it measured when the draft grows but the field is already at its cap", () => {
    render("a\nb\nc\nd\ne\nf\ng\nh\ni\nj", false, vi.fn());
    const field = host.querySelector("textarea")!;
    field.style.height = "160px";
    render("a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk", false, vi.fn());
    expect(field.style.height).toBe("160px");
  });
});

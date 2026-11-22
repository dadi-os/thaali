// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useDismiss } from "../interaction/dismiss";
import { Modal } from "./Modal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A modal with a floating menu opened over it, as a right-click inside the modal opens one. */
function Harness({ onClose }: { onClose: () => void }) {
  const [menu, setMenu] = useState(true);
  const surface = { current: null as HTMLDivElement | null };
  useDismiss({ open: menu, onDismiss: () => setMenu(false), surface, outside: true });
  return (
    <Modal open onClose={onClose} label="Files">
      <button type="button">inside</button>
      {menu ? <div ref={(node) => void (surface.current = node)} role="menu">menu</div> : null}
    </Modal>
  );
}

async function mount(element: React.ReactElement): Promise<void> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host).render(element);
  });
}

const press = (target: Element) => target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
const escape = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

describe("Modal", () => {
  it("is portaled above the app, named for its content, and sits on the modal layer", async () => {
    await mount(<Modal open onClose={vi.fn()} label="Files">body</Modal>);
    const panel = document.body.querySelector<HTMLElement>("[role=dialog]")!;
    expect(panel.getAttribute("aria-label")).toBe("Files");
    expect(panel.closest(".modal-scrim")?.parentElement).toBe(document.body);
  });

  it("frosts what is behind it with its scrim, which holds the centred panel", async () => {
    await mount(<Modal open onClose={vi.fn()} label="Files">body</Modal>);
    const scrim = document.body.querySelector<HTMLElement>(".modal-scrim")!;
    expect(scrim.querySelector("[role=dialog]")).not.toBeNull();
    expect(scrim.parentElement).toBe(document.body);
  });

  it("closes on a press outside the panel and not on one inside it", async () => {
    const onClose = vi.fn();
    await mount(<Modal open onClose={onClose} label="Files"><button type="button">inside</button></Modal>);
    await act(async () => press(document.body.querySelector("button")!));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => press(document.body.querySelector(".modal-scrim")!));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("answers Escape only while it is the topmost overlay: a menu over it closes first", async () => {
    const onClose = vi.fn();
    await mount(<Harness onClose={onClose} />);
    await act(async () => escape());
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.querySelector("[role=menu]")).toBeNull();
    await act(async () => escape());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close while locked", async () => {
    const onClose = vi.fn();
    await mount(<Modal open locked onClose={onClose} label="Driving">body</Modal>);
    await act(async () => escape());
    await act(async () => press(document.body.querySelector(".modal-scrim")!));
    expect(onClose).not.toHaveBeenCalled();
  });
});

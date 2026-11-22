// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./Dialog";
import { PreviewModal } from "./PreviewModal";
import { Sheet } from "./Sheet";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  document.body.innerHTML = "";
});

async function mount(element: React.ReactElement): Promise<HTMLElement> {
  const host = document.createElement("div");
  host.style.position = "relative";
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host).render(element);
  });
  return host;
}

describe("PreviewModal", () => {
  it("draws a head with its title, subtitle and actions over the body, and a footer under it", async () => {
    await mount(
      <PreviewModal open onClose={vi.fn()} label="Task" title="task/browser/3f2a91" subtitle="Find the statement" actions={<button type="button">Takeover</button>} footer="slot 3">
        <p>body</p>
      </PreviewModal>,
    );
    const panel = document.body.querySelector("[role=dialog]")!;
    const text = panel.textContent ?? "";
    expect(text.indexOf("task/browser/3f2a91")).toBeLessThan(text.indexOf("Find the statement"));
    expect(text.indexOf("Takeover")).toBeLessThan(text.indexOf("body"));
    expect(text.indexOf("body")).toBeLessThan(text.indexOf("slot 3"));
  });

  it("closes from its close button, and not while locked", async () => {
    const onClose = vi.fn();
    await mount(<PreviewModal open onClose={onClose} label="Task" title="t">body</PreviewModal>);
    await act(async () => document.body.querySelector<HTMLButtonElement>("button[aria-label='Close']")!.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    const locked = vi.fn();
    await mount(<PreviewModal open locked onClose={locked} label="Driving" title="t">body</PreviewModal>);
    const buttons = document.body.querySelectorAll<HTMLButtonElement>("button[aria-label='Close']");
    expect(buttons[buttons.length - 1]!.disabled).toBe(true);
  });
});

describe("Dialog and Sheet", () => {
  it("are the shared modal scoped to the surface they sit in, not portaled to the body", async () => {
    const host = await mount(
      <>
        <Dialog open onClose={vi.fn()} title="Delete Chase?">sure</Dialog>
        <Sheet open onClose={vi.fn()} label="Item">row</Sheet>
      </>,
    );
    const panels = host.querySelectorAll<HTMLElement>("[role=dialog].modal-panel");
    expect([...panels].map((panel) => panel.getAttribute("aria-label"))).toEqual(["Delete Chase?", "Item"]);
    expect(host.querySelectorAll(".modal-scrim")).toHaveLength(2);
    expect(host.querySelector<HTMLElement>(".modal-scrim")!.style.position).toBe("absolute");
  });
});

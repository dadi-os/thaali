// @vitest-environment happy-dom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DraftAttachment } from "../../lib/content/attachments";
import { Composer, type ComposerProps } from "./Composer";

MotionGlobalConfig.skipAnimations = true;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const staged = (upload: DraftAttachment["upload"]): DraftAttachment => ({ id: 1, file: new File(["x"], "hw3.pdf"), media_type: "application/pdf", sizeBytes: 1, upload });

function render(over: Partial<ComposerProps>): void {
  const props: ComposerProps = {
    connected: true,
    draft: "file this",
    setDraft: vi.fn(),
    placeholder: "Message agent",
    canSubmit: true,
    textareaRef: createRef<HTMLTextAreaElement>(),
    fileInputRef: createRef<HTMLInputElement>(),
    cameraInputRef: createRef<HTMLInputElement>(),
    attachments: [],
    onRemoveAttachment: vi.fn(),
    onPickFiles: vi.fn(),
    onLinkFromBox: vi.fn(),
    onSubmit: vi.fn(),
    onKeyDown: vi.fn(),
    onHeight: vi.fn(),
    fieldMaxPx: 160,
    ...over,
  };
  act(() => root.render(<Composer {...props} />));
}

describe("Composer staged files", () => {
  it("shows a failed upload's error on its chip and keeps the chip removable", () => {
    render({ attachments: [staged({ state: "failed", message: "Nas is unreachable" })] });
    expect(host.textContent).toContain("hw3.pdf");
    expect(host.textContent).toContain("Nas is unreachable");
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Remove attachment"]')!.disabled).toBe(false);
  });

  it("says Uploading and holds the chip while its upload runs", () => {
    render({ attachments: [staged({ state: "uploading" })] });
    expect(host.textContent).toContain("Uploading");
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Remove attachment"]')!.disabled).toBe(true);
  });
});

describe("Composer offline", () => {
  it("says so, and cannot attach, link or send", () => {
    render({ connected: false, canSubmit: false, attachments: [staged({ state: "staged" })] });
    expect(host.textContent).toContain("Connect to message agent");
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Attach"]')!.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.disabled).toBe(true);
    expect(host.querySelector("textarea")!.disabled).toBe(true);
  });
});

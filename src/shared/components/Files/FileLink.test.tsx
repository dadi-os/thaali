// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import { getOpenBoxPath, setOpenBoxPath } from "../../../contexts/files";
import { installContextMenu, type ContextRequest } from "../../interaction/contextMenu";

const nas = vi.hoisted(() => ({ statFile: vi.fn() }));
const connection = vi.hoisted(() => ({ state: "connected" }));
vi.mock("../../api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../api")>()), nas }));
vi.mock("../../hooks/useConnection", () => ({ useConnection: () => ({ state: connection.state }) }));

import { MarkdownBody } from "../Markdown";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PATH = "/var/home/dadi/msu/semester-5/cse-431/submissions/hw 3 (final).pdf";
const LINK = `[hw3.pdf](box:///var/home/dadi/msu/semester-5/cse-431/submissions/hw%203%20%28final%29.pdf)`;

/** A scroll watcher that reports every element in view as soon as it is watched. */
class InView {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(element: Element) {
    this.callback([{ isIntersecting: true, target: element } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  disconnect() {}
}

/** A scroll watcher that never reports anything in view. */
class NeverInView {
  observe() {}
  disconnect() {}
}

let host: HTMLElement;
let root: Root;
let opened: ContextRequest[];
let stop: () => void;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  opened = [];
  stop = installContextMenu((request) => opened.push(request));
  nas.statFile.mockReset();
  connection.state = "connected";
  setOpenBoxPath(null);
  vi.stubGlobal("IntersectionObserver", InView);
});
afterEach(() => {
  stop();
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(content: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MarkdownBody content={content} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe("a box link in Markdown", () => {
  it("is a button with the file's name, never an anchor the system could open, and a press opens the explorer at its decoded path", async () => {
    nas.statFile.mockResolvedValue({ name: "hw 3 (final).pdf", path: PATH, kind: "file", size: 1, modified: "", media_type: "application/pdf" });
    await render(`See ${LINK} for the answers.`);
    expect(host.querySelector('a[href^="box:"]')).toBeNull();
    const link = [...host.querySelectorAll("button")].find((button) => button.textContent?.includes("hw3.pdf"))!;
    await act(async () => {
      link.click();
    });
    expect(getOpenBoxPath()).toBe(PATH);
  });

  it("keeps web links as web links", async () => {
    await render("[site](https://example.com/page)");
    expect(host.querySelector('a[href="https://example.com/page"]')).not.toBeNull();
  });

  it("opens a folder link at the folder", async () => {
    nas.statFile.mockResolvedValue({ name: "cse-431", path: "/var/home/dadi/msu/cse-431", kind: "folder", size: 0, modified: "", media_type: "" });
    await render("[class](box:///var/home/dadi/msu/cse-431/)");
    await act(async () => {
      host.querySelector("button")!.click();
    });
    expect(getOpenBoxPath()).toBe("/var/home/dadi/msu/cse-431");
  });

  it("draws a path Nas says is gone struck through with File removed, and still opens", async () => {
    nas.statFile.mockRejectedValue(new ApiError('HTTP 404: {"error":{"type":"not_found"}}', "http://nas.dadi", "id", 404));
    await render(LINK);
    expect(nas.statFile).toHaveBeenCalledWith(PATH);
    expect(host.textContent).toContain("File removed");
    expect(host.querySelector(".line-through")!.textContent).toBe("hw3.pdf");
    await act(async () => {
      host.querySelector("button")!.click();
    });
    expect(getOpenBoxPath()).toBe(PATH);
  });

  it("does not mark a link removed because the check failed some other way", async () => {
    nas.statFile.mockRejectedValue(new ApiError("HTTP 500: boom", "http://nas.dadi", "id", 500));
    await render(LINK);
    expect(host.textContent).not.toContain("File removed");
  });

  it("checks only once it scrolls into view", async () => {
    vi.stubGlobal("IntersectionObserver", NeverInView);
    await render(LINK);
    expect(nas.statFile).not.toHaveBeenCalled();
  });

  it("does not check while the mesh is out of reach, and shows the link normally", async () => {
    connection.state = "disconnected";
    await render(LINK);
    expect(nas.statFile).not.toHaveBeenCalled();
    expect(host.textContent).toContain("hw3.pdf");
    expect(host.textContent).not.toContain("File removed");
  });

  it("offers the file actions on right-click: the link, the path and save, but no rename or trash", async () => {
    nas.statFile.mockResolvedValue({ name: "hw 3 (final).pdf", path: PATH, kind: "file", size: 1, modified: "", media_type: "application/pdf" });
    await render(LINK);
    await act(async () => {
      host.querySelector("button")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });
    const ids = opened[0]!.actions.flatMap((action) => (action === "separator" ? [] : [action.id]));
    expect(ids).toEqual(["file.open", "file.copy-link", "file.copy-path", "file.save"]);
  });
});

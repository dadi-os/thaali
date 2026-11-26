// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../api/errors";
import type { NasFileEntry, NasFileList } from "../../../../types/nas";

const HOME = "/var/home/dadi";

const nas = vi.hoisted(() => ({ listFiles: vi.fn(), uploadFile: vi.fn(), trashFile: vi.fn(), moveFile: vi.fn(), makeFolder: vi.fn() }));
const connection = vi.hoisted(() => ({ state: "connected" }));
vi.mock("../../../api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../../api")>()), nas }));
vi.mock("../../../hooks/useConnection", () => ({ useConnection: () => ({ state: connection.state }) }));

import { Explorer } from "./Explorer";

MotionGlobalConfig.skipAnimations = true;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function entry(name: string, kind: NasFileEntry["kind"], size = 0, parent = `${HOME}/msu`): NasFileEntry {
  return { name, path: `${parent}/${name}`, kind, size, modified: "2026-11-10T12:00:00Z", media_type: kind === "folder" ? "" : "text/plain" };
}

const MSU: NasFileEntry[] = [entry("work", "folder"), entry("zeta.txt", "file", 5), entry("alpha.txt", "file", 900)];

function listing(entries: NasFileEntry[]): (path: string) => Promise<NasFileList> {
  return async (path) => ({ path, entries: path === `${HOME}/msu` ? entries : [] });
}

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  connection.state = "connected";
  for (const fn of Object.values(nas)) {
    fn.mockReset();
  }
  nas.listFiles.mockImplementation(listing(MSU));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** The Explorer, controlled the way a surface holds it, opened on /msu. */
function Surface({ initial = [] as NasFileEntry[] }) {
  const [folder, setFolder] = useState(`${HOME}/msu`);
  const [selection, setSelection] = useState(initial);
  const [filter, setFilter] = useState("");
  return <Explorer folder={folder} onFolderChange={setFolder} selection={selection} onSelectionChange={setSelection} filter={filter} onFilterChange={setFilter} />;
}

async function render(initial: NasFileEntry[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Surface initial={initial} />
      </QueryClientProvider>,
    );
  });
  await settle();
}

/** Let the requests in flight answer and the screen follow. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const rowNames = () => [...host.querySelectorAll('[role="option"]')].map((row) => row.getAttribute("data-path")!.split("/").pop());

describe("the explorer's list", () => {
  it("shows folders first, then files by name, and re-sorts by size from the header", async () => {
    await render();
    expect(rowNames()).toEqual(["work", "alpha.txt", "zeta.txt"]);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Sort by Size"]')!.click();
    });
    await settle();
    expect(rowNames()).toEqual(["work", "zeta.txt", "alpha.txt"]);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[aria-label="Sort by Size"]')!.click();
    });
    await settle();
    expect(rowNames()).toEqual(["work", "alpha.txt", "zeta.txt"]);
  });

  it("filters the rows by name", async () => {
    await render();
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Filter by name"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "zeta");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(rowNames()).toEqual(["zeta.txt"]);
  });

  it("walks the rows with the arrow keys and opens a folder with Enter, then goes up with Backspace", async () => {
    await render();
    const press = async (key: string) => {
      await act(async () => {
        host.querySelector('[role="listbox"]')!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
      await settle();
    };
    await press("ArrowDown");
    expect(host.querySelector('[aria-selected="true"]')!.getAttribute("data-path")).toBe(`${HOME}/msu/work`);
    await press("ArrowDown");
    expect(host.querySelector('[aria-selected="true"]')!.getAttribute("data-path")).toBe(`${HOME}/msu/alpha.txt`);
    await press("ArrowUp");
    await press("Enter");
    expect(nas.listFiles).toHaveBeenCalledWith(`${HOME}/msu/work`);
    await press("Backspace");
    expect(rowNames()).toEqual(["work", "alpha.txt", "zeta.txt"]);
  });
});

describe("the explorer's states", () => {
  it("shows loading rows while the listing is on its way", async () => {
    nas.listFiles.mockImplementation(() => new Promise(() => undefined));
    await render();
    expect(host.querySelector('[aria-label="Loading folder"]')).not.toBeNull();
  });

  it("says a folder is empty and still accepts a drop", async () => {
    nas.listFiles.mockImplementation(listing([]));
    await render();
    expect(host.textContent).toContain("Nothing here");
    expect(host.querySelector('[role="listbox"]')).not.toBeNull();
  });

  it("says the mesh is out of reach without asking Nas", async () => {
    connection.state = "disconnected";
    await render();
    expect(host.textContent).toContain("dadi is unreachable");
    expect(nas.listFiles).not.toHaveBeenCalledWith(`${HOME}/msu`);
  });

  it("shows the failure's own words with a retry that asks again", async () => {
    nas.listFiles.mockRejectedValue(new ApiError('HTTP 500: {"error":{"type":"internal","message":"disk unreadable"}}', "http://nas.dadi", "id", 500));
    await render();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("disk unreadable");
    nas.listFiles.mockImplementation(listing(MSU));
    await act(async () => {
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Retry")!.click();
    });
    await settle();
    expect(rowNames()).toEqual(["work", "alpha.txt", "zeta.txt"]);
  });

  it("names a module that is not answering", async () => {
    nas.listFiles.mockRejectedValue(new ApiError("HTTP 502: bad gateway", "http://nas.dadi", "id", 502));
    await render();
    expect(host.textContent).toContain("Files aren’t available");
  });
});

describe("uploading by dropping Mac files", () => {
  /** Drop `files` on `target` the way the webview delivers them. */
  async function drop(target: Element, files: File[]) {
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { types: ["Files"], files } });
    await act(async () => {
      target.dispatchEvent(event);
    });
    await settle();
  }

  it("uploads into the open folder and shows where a taken name landed, from the path Nas answered with", async () => {
    nas.uploadFile.mockResolvedValue({ path: `${HOME}/msu/hw3 (2).zip`, name: "hw3 (2).zip", size: 1 });
    await render();
    await drop(host.querySelector('[role="listbox"]')!, [new File(["a"], "hw3.zip")]);
    expect(nas.uploadFile).toHaveBeenCalledWith(`${HOME}/msu`, expect.objectContaining({ name: "hw3.zip" }));
    expect(host.textContent).toContain("hw3 (2).zip");
  });

  it("uploads into a folder row when dropped on it", async () => {
    nas.uploadFile.mockResolvedValue({ path: `${HOME}/msu/work/a.md`, name: "a.md", size: 1 });
    await render();
    await drop(host.querySelector(`[data-path="${HOME}/msu/work"]`)!, [new File(["a"], "a.md")]);
    expect(nas.uploadFile).toHaveBeenCalledWith(`${HOME}/msu/work`, expect.objectContaining({ name: "a.md" }));
  });

  it("shows a failed upload inline, and loads the listing again so it matches the box", async () => {
    nas.uploadFile.mockRejectedValue(new ApiError('HTTP 413: {"error":{"type":"too_large","message":"larger than 200 MB"}}', "http://nas.dadi", "id", 413));
    await render();
    const before = nas.listFiles.mock.calls.length;
    await drop(host.querySelector('[role="listbox"]')!, [new File(["a"], "big.bin")]);
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("larger than 200 MB");
    expect(nas.listFiles.mock.calls.length).toBeGreaterThan(before);
  });
});

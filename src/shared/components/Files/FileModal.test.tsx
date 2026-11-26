// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MotionGlobalConfig } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import type { NasFileEntry } from "../../../types/nas";

const HOME = "/var/home/dadi";
const FOLDER = `${HOME}/msu/semester-5/cse-431/submissions`;

const nas = vi.hoisted(() => ({ statFile: vi.fn(), listFiles: vi.fn() }));
vi.mock("../../api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../api")>()), nas }));
vi.mock("../../hooks/useConnection", () => ({ useConnection: () => ({ state: "connected" }) }));

import { FileModal } from "./FileModal";

MotionGlobalConfig.skipAnimations = true;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const zip: NasFileEntry = { name: "hw3.zip", path: `${FOLDER}/hw3.zip`, kind: "file", size: 12, modified: "2026-11-20T12:00:00Z", media_type: "application/zip" };
const folderEntry = (path: string): NasFileEntry => ({ name: path.split("/").pop()!, path, kind: "folder", size: 0, modified: "2026-11-20T12:00:00Z", media_type: "" });
const notFound = (path: string) => new ApiError(`HTTP 404: {"error":{"type":"not_found","message":"${path}"}}`, "http://nas.dadi", "id", 404);

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  nas.statFile.mockReset();
  nas.listFiles.mockReset();
  nas.statFile.mockImplementation(async (path: string) => {
    if (path === zip.path) return zip;
    if (path === FOLDER || path === `${HOME}/msu`) return folderEntry(path);
    throw notFound(path);
  });
  nas.listFiles.mockImplementation(async (path: string) => ({ path, entries: path === FOLDER ? [zip] : [] }));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

const rows = () => [...document.body.querySelectorAll('[role="option"]')].map((row) => row.getAttribute("data-path"));

describe("the file modal at a box path", () => {
  it("opens a file's folder with the file selected", async () => {
    await render(<FileModal path={zip.path} onClose={() => undefined} />);
    expect(rows()).toEqual([zip.path]);
    expect(document.body.querySelector('[aria-selected="true"]')!.getAttribute("data-path")).toBe(zip.path);
    expect(document.body.textContent).toContain("No preview for application/zip");
  });

  it("opens a folder's listing with nothing selected", async () => {
    await render(<FileModal path={FOLDER} onClose={() => undefined} />);
    expect(rows()).toEqual([zip.path]);
    expect(document.body.querySelector('[aria-selected="true"]')).toBeNull();
  });

  it("opens the nearest parent that exists for a dead path, with one note, and the filename in the filter", async () => {
    await render(<FileModal path={`${FOLDER}/hw2.pdf`} onClose={() => undefined} />);
    expect(nas.statFile).toHaveBeenCalledWith(`${FOLDER}/hw2.pdf`);
    expect(rows()).toEqual([]);
    expect(document.body.textContent).toContain("No file named like");
    expect(document.body.textContent).toContain("File removed");
    expect(document.body.querySelector<HTMLInputElement>('input[aria-label="Filter by name"]')!.value).toBe("hw2.pdf");
    expect(nas.listFiles).toHaveBeenCalledWith(FOLDER);
  });

  it("walks up past several missing folders to the one that exists", async () => {
    await render(<FileModal path={`${HOME}/msu/gone/deeper/a.md`} onClose={() => undefined} />);
    expect(nas.listFiles).toHaveBeenCalledWith(`${HOME}/msu`);
    expect(document.body.textContent).toContain("File removed");
  });

  it("says why when the path cannot be checked at all", async () => {
    nas.statFile.mockRejectedValue(new ApiError('HTTP 500: {"error":{"type":"internal","message":"stat failed"}}', "http://nas.dadi", "id", 500));
    await render(<FileModal path={zip.path} onClose={() => undefined} />);
    expect(document.body.querySelector('[role="alert"]')!.textContent).toContain("stat failed");
  });
});

describe("pick mode", () => {
  it("hands back the selected paths and closes", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    await render(<FileModal path={zip.path} onPick={onPick} onClose={onClose} />);
    const insert = [...document.body.querySelectorAll("button")].find((button) => button.textContent === "Insert links")!;
    expect(insert.disabled).toBe(false);
    await act(async () => {
      insert.click();
    });
    expect(onPick).toHaveBeenCalledWith([zip.path]);
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps Insert links off until something is selected", async () => {
    await render(<FileModal path={FOLDER} onPick={vi.fn()} onClose={() => undefined} />);
    const insert = [...document.body.querySelectorAll("button")].find((button) => button.textContent === "Insert links")!;
    expect(insert.disabled).toBe(true);
  });

  it("does not offer Insert links outside pick mode", async () => {
    await render(<FileModal path={FOLDER} onClose={() => undefined} />);
    expect([...document.body.querySelectorAll("button")].some((button) => button.textContent === "Insert links")).toBe(false);
  });
});

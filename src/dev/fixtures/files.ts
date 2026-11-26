import { ApiError } from "../../shared/api/errors";
import type { NasFileEntry, NasFileList, NasFilePath, NasUploaded } from "../../types/nas";
import { ago, DAY } from "./time";

const HOME = "/var/home/dadi";

/** A 1x1 PNG, so an image preview has real bytes to draw. */
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

type Node = { entry: NasFileEntry; body: string | Uint8Array<ArrayBuffer> };

/** Files the fixture tree holds: path under the home, media type, age in days, contents. */
const FILES: Array<[string, string, number, string | Uint8Array<ArrayBuffer>]> = [
  ["msu/semester-5/cse-431/syllabus.pdf", "application/pdf", 80, "%PDF-1.4\n%fixture\n"],
  ["msu/semester-5/cse-431/materials/lecture-09.md", "text/markdown", 6, "# Lecture 9\n\nVirtual memory, page tables and the TLB.\n\n- Multi-level tables\n- Working sets\n"],
  ["msu/semester-5/cse-431/work/due.md", "text/markdown", 2, "# Due\n\n- HW3 (Nov 24)\n- Lab 5 (Dec 1)\n"],
  ["msu/semester-5/cse-431/work/solver.ts", "text/plain", 3, "export function solve(n: number): number {\n  return n <= 1 ? n : solve(n - 1) + solve(n - 2);\n}\n"],
  ["msu/semester-5/cse-431/submissions/hw3.zip", "application/zip", 1, "PK\u0003\u0004fixture"],
  ["career/resume/resume.pdf", "application/pdf", 12, "%PDF-1.4\n%fixture\n"],
  ["career/resume/headshot.png", "image/png", 40, PNG],
  ["Inbox/2026-11/receipt.png", "image/png", 4, PNG],
  ["Inbox/2026-11/notes.json", "application/json", 4, '{\n  "term": "Fall 2026",\n  "courses": ["CSE 431", "CSE 460"]\n}\n'],
  ["projects/dadi-notes.md", "text/markdown", 9, "# dadi notes\n\nThings to remember.\n"],
];

/** Folders that hold nothing, so the empty state is reachable. */
const EMPTY_FOLDERS = ["scratch"];

/** The error Nas answers with for a path that does not exist. */
function notFound(path: string): ApiError {
  return new ApiError(`HTTP 404: {"error":{"type":"not_found","message":"${path} does not exist"}}`, "http://nas.dadi", "7be0c2d4-1f9a-4a68-b5c3-2a84e0d91c57", 404);
}

/** The error Nas answers with for a move onto a name that is taken. */
function conflict(path: string): ApiError {
  return new ApiError(`HTTP 409: {"error":{"type":"conflict","message":"${path} already exists"}}`, "http://nas.dadi", "7be0c2d4-1f9a-4a68-b5c3-2a84e0d91c57", 409);
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function parentOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

/**
 * The box's file tree as the explorer's fixtures: a believable home (msu, career, Inbox, projects, scratch) held in
 * memory, with the writes a page makes (upload, mkdir, move, trash) applied so they stick until the page reloads.
 * `msu/semester-5/cse-431/submissions/hw2.pdf` is the dead path: it is not here, so it stats 404.
 */
export class FixtureFiles {
  private readonly nodes = new Map<string, Node>();

  constructor() {
    this.addFolder(HOME, 30);
    for (const folder of EMPTY_FOLDERS) {
      this.addFolder(`${HOME}/${folder}`, 3);
    }
    for (const [relative, mediaType, days, body] of FILES) {
      this.addFile(`${HOME}/${relative}`, mediaType, days * DAY, body);
    }
  }

  private addFolder(path: string, days: number): void {
    const parent = parentOf(path);
    if (path !== HOME && !this.nodes.has(parent)) {
      this.addFolder(parent, days);
    }
    this.nodes.set(path, { entry: { name: nameOf(path), path, kind: "folder", size: 0, modified: ago(days * DAY), media_type: "" }, body: "" });
  }

  private addFile(path: string, mediaType: string, age: number, body: string | Uint8Array<ArrayBuffer>): NasFileEntry {
    const parent = parentOf(path);
    if (!this.nodes.has(parent)) {
      this.addFolder(parent, age / DAY);
    }
    const size = typeof body === "string" ? new TextEncoder().encode(body).length : body.length;
    const entry: NasFileEntry = { name: nameOf(path), path, kind: "file", size, modified: ago(age), media_type: mediaType };
    this.nodes.set(path, { entry, body });
    return entry;
  }

  private node(path: string): Node {
    const node = this.nodes.get(path);
    if (node === undefined) {
      throw notFound(path);
    }
    return node;
  }

  /** `GET /fs/list`: folders first, then by name. */
  list(path: string): NasFileList {
    if (this.node(path).entry.kind !== "folder") {
      throw new ApiError(`HTTP 400: {"error":{"type":"not_a_folder","message":"${path} is not a folder"}}`, "http://nas.dadi", "7be0c2d4-1f9a-4a68-b5c3-2a84e0d91c57", 400);
    }
    const entries = [...this.nodes.values()]
      .map((node) => node.entry)
      .filter((entry) => parentOf(entry.path) === path && entry.path !== path)
      .sort((a, b) => Number(b.kind === "folder") - Number(a.kind === "folder") || a.name.localeCompare(b.name));
    return { path, entries };
  }

  /** `GET /fs/stat`: the entry, or a 404. */
  stat(path: string): NasFileEntry {
    return this.node(path).entry;
  }

  /** `GET /fs/raw`: the bytes, as text or as a blob of the file's media type. */
  raw(path: string, as: "text" | "blob"): string | Blob {
    const { entry, body } = this.node(path);
    if (as === "text") {
      return typeof body === "string" ? body : new TextDecoder().decode(body);
    }
    return new Blob([body], { type: entry.media_type });
  }

  /** `POST /fs/upload`: adds the file, numbering a taken name " (2)". */
  upload(form: FormData): NasUploaded {
    const folder = String(form.get("path"));
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("fixtures: upload without a file part");
    }
    this.node(folder);
    const free = this.freeName(folder, file.name);
    const entry = this.addFile(`${folder}/${free}`, file.type, 0, new Uint8Array(0));
    return { path: entry.path, name: free, size: file.size };
  }

  /** `POST /fs/mkdir`. */
  mkdir(path: string): NasFilePath {
    this.node(parentOf(path));
    this.addFolder(path, 0);
    return { path };
  }

  /** `POST /fs/move`: moves a file or a folder with what is under it; a 409 when `to` exists. */
  move(from: string, to: string): NasFilePath {
    this.node(from);
    if (this.nodes.has(to)) {
      throw conflict(to);
    }
    for (const [path, node] of [...this.nodes]) {
      if (path === from || path.startsWith(`${from}/`)) {
        const moved = `${to}${path.slice(from.length)}`;
        this.nodes.delete(path);
        this.nodes.set(moved, { ...node, entry: { ...node.entry, path: moved, name: nameOf(moved) } });
      }
    }
    return { path: to };
  }

  /** `POST /fs/trash`: the entry leaves the tree. */
  trash(path: string): NasFilePath {
    this.node(path);
    for (const key of [...this.nodes.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) {
        this.nodes.delete(key);
      }
    }
    return { path: `${HOME}/.trash/${path.slice(HOME.length + 1)}` };
  }

  private freeName(folder: string, name: string): string {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    for (let n = 1, candidate = name; ; n += 1, candidate = `${stem} (${n})${ext}`) {
      if (!this.nodes.has(`${folder}/${candidate}`)) {
        return candidate;
      }
    }
  }
}

/**
 * What the visual loop and the fidelity gate share: the dev server they screenshot, the Swift tools
 * they build, and a static server for a directory of reference pages.
 */
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

/** The port the visual dev server (vite.visual.config.ts) listens on. */
export const PORT = 5174;

/** The origin the pages are loaded from. */
export const ORIGIN = `http://127.0.0.1:${PORT}`;

/** Whether the visual dev server answers. */
async function serverUp() {
  try {
    return (await fetch(`${ORIGIN}/?fixtures=normal`)).ok;
  } catch {
    return false;
  }
}

/** Starts the visual dev server unless one is already up; returns the child to stop afterwards, or null. */
export async function ensureServer() {
  if (await serverUp()) return null;
  const child = spawn("npx", ["vite", "--config", "vite.visual.config.ts"], { cwd: root, stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) {
    if (await serverUp()) return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error("the vite visual server did not come up");
}

/** Builds the Swift tool `source` (a path under visual/) into visual/.build/<name> when it is stale; returns the binary's path. */
export function ensureTool(source, name) {
  const bin = join(here, ".build", name);
  const file = join(here, source);
  if (!existsSync(bin) || statSync(bin).mtimeMs < statSync(file).mtimeMs) {
    mkdirSync(join(here, ".build"), { recursive: true });
    const built = spawnSync("swiftc", ["-O", file, "-o", bin], { stdio: "inherit" });
    if (built.status !== 0) throw new Error(`swiftc failed to build ${source}`);
  }
  return bin;
}

const TYPES = { ".html": "text/html", ".woff2": "font/woff2", ".json": "application/json", ".png": "image/png", ".css": "text/css", ".js": "text/javascript" };

/** Serves the files under `dir` on `port` over HTTP; returns the server to close afterwards. */
export function serveDir(dir, port) {
  const base = resolve(dir);
  const server = createServer((request, response) => {
    const path = normalize(join(base, decodeURIComponent(new URL(request.url, "http://x").pathname)));
    if (!path.startsWith(base) || !existsSync(path) || !statSync(path).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
    createReadStream(path).pipe(response);
  });
  return new Promise((resolveListen) => server.listen(port, "127.0.0.1", () => resolveListen(server)));
}

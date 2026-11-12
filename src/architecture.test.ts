import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

/** Every source file of the app: not the dev fixtures and gallery, and not tests. */
function sources(dir: string = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "dev" ? [] : sources(path);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** The files, as paths from `src/`, whose text matches `pattern`. */
function filesMatching(pattern: RegExp): string[] {
  return sources()
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(SRC, path))
    .sort();
}

describe("where input and the operating system are handled", () => {
  it("offers a right-click menu only through useContextActions", () => {
    expect(filesMatching(/onContextMenu=|"contextmenu"/)).toEqual(["shared/interaction/contextMenu.ts", "shared/overlay/Menu.tsx"]);
  });

  it("binds keys only in the interaction layer", () => {
    expect(filesMatching(/addEventListener\(\s*"keydown"/)).toEqual(["shared/interaction/dismiss.ts", "shared/interaction/selection.ts", "shared/interaction/shortcuts.ts"]);
  });

  it("closes overlays only through the dismiss stack, never with its own Escape handler", () => {
    expect(filesMatching(/key === "Escape"/).filter((path) => !path.startsWith("shared/interaction/"))).toEqual(expect.not.arrayContaining(["shared/overlay/Dialog.tsx", "shared/overlay/Sheet.tsx", "shared/overlay/Popover/index.tsx"]));
  });

  it("reaches the Tauri APIs only from the desktop layer, the API layer and the one window-bound radio file", () => {
    const allowed = (path: string) => path.startsWith("shared/desktop/") || path.startsWith("shared/api/");
    expect(filesMatching(/from "@tauri-apps\//).filter((path) => !allowed(path))).toEqual(["features/ghar/radio.ts"]);
  });

  it("keeps the system from dragging links and media: one base rule, and no link that opts back in", () => {
    const base = readFileSync(join(SRC, "shared/theme/base.css"), "utf8");
    const rule = /(?:^|\n)\s*a,\s*a \*,[^{]*\{([^}]*)\}/.exec(base);
    expect(rule).not.toBeNull();
    expect(rule![1]).toContain("-webkit-user-drag: none");
    expect(rule![1]).toContain("user-drag: none");
    const links = sources().flatMap((path) => [...readFileSync(path, "utf8").matchAll(/<Link\b[^>]*?>/gs)].map((match) => ({ path: relative(SRC, path), tag: match[0] })));
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter(({ tag }) => !tag.includes("draggable={false}"))).toEqual([]);
    expect(filesMatching(/draggable=\{true\}|draggable="true"/)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { ancestorsOf, BOX_HOME, boxHref, parentPath, parseBoxHref } from "./boxLink";

describe("box links", () => {
  it("round-trips paths with spaces, parentheses and other characters that need encoding", () => {
    for (const path of [`${BOX_HOME}/msu/hw3.pdf`, `${BOX_HOME}/Inbox/2026-11/my notes (2).md`, `${BOX_HOME}/a b/c&d/é #1.txt`]) {
      const href = boxHref(path, false);
      expect(href).not.toMatch(/[ ()]/);
      expect(parseBoxHref(href)).toEqual({ path, folder: false });
    }
  });

  it("marks a folder with a trailing slash that parses back as a folder", () => {
    const href = boxHref(`${BOX_HOME}/msu/semester 5`, true);
    expect(href.endsWith("/")).toBe(true);
    expect(parseBoxHref(href)).toEqual({ path: `${BOX_HOME}/msu/semester 5`, folder: true });
  });

  it("writes the scheme with an empty host so the path stays absolute", () => {
    expect(boxHref(`${BOX_HOME}/x.md`, false)).toBe("box:///var/home/dadi/x.md");
  });

  it("refuses anything that is not an absolute box path or that climbs out of it", () => {
    expect(parseBoxHref("https://example.com/a")).toBeNull();
    expect(parseBoxHref("file:///etc/passwd")).toBeNull();
    expect(parseBoxHref("box://relative/path")).toBeNull();
    expect(parseBoxHref("box:///var/home/dadi/../../etc/passwd")).toBeNull();
    expect(parseBoxHref("box:///var/home/dadi/%2E%2E/x")).toBeNull();
    expect(parseBoxHref("box:///bad%zzescape")).toBeNull();
  });

  it("finds the folder above a path and every folder down to it", () => {
    expect(parentPath(`${BOX_HOME}/msu/a.md`)).toBe(`${BOX_HOME}/msu`);
    expect(parentPath(BOX_HOME)).toBe(BOX_HOME);
    expect(ancestorsOf(`${BOX_HOME}/msu/semester-5/a.md`)).toEqual([BOX_HOME, `${BOX_HOME}/msu`, `${BOX_HOME}/msu/semester-5`]);
  });
});

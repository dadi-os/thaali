import { describe, expect, it } from "vitest";
import { highlight } from "./FilePreview";

describe("highlight", () => {
  it.each([
    ["train.py", "text/x-python"],
    ["notes.txt", "text/plain"],
    ["paper.tex", "text/x-tex"],
    ["data.tsv", "text/tab-separated-values"],
    ["Makefile", "text/plain"],
    ["README", "text/plain"],
    ["constructor", "text/plain"],
    ["toString", "text/plain"],
    ["hasOwnProperty", "text/plain"],
    ["__proto__", "text/plain"],
    ["archive.constructor", "text/plain"],
    ["config.unknownext", "text/plain"],
  ])("colors %s without throwing", async (name, mediaType) => {
    expect(await highlight("a = 1\nb", name, mediaType)).toContain("<pre");
  });

  it("keeps working after a file named like an Object property", async () => {
    await highlight("x", "constructor", "text/plain");
    expect(await highlight("def f(): pass", "a.py", "text/x-python")).toContain("shiki");
  });
});

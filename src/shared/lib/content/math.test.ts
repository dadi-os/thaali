import { describe, expect, it } from "vitest";
import { normalizeMathDelimiters } from "./math";

describe("normalizeMathDelimiters", () => {
  it("rewrites \\( \\) as inline dollars", () => {
    expect(normalizeMathDelimiters("so \\( a \\rightarrow b \\) holds")).toBe("so $a \\rightarrow b$ holds");
  });

  it("rewrites a \\[ \\] on its own lines as a $$ block", () => {
    expect(normalizeMathDelimiters("Sum:\n\n\\[\nx^2 + y^2\n\\]\n")).toBe("Sum:\n\n$$\nx^2 + y^2\n$$\n");
  });

  it("keeps a list item's indent on a display block", () => {
    expect(normalizeMathDelimiters("- item\n\n  \\[ e^{i\\pi} \\]")).toBe("- item\n\n  $$\n  e^{i\\pi}\n  $$");
  });

  it("rewrites a \\[ \\] inside a sentence as inline $$", () => {
    expect(normalizeMathDelimiters("then \\[x\\] follows")).toBe("then $$x$$ follows");
  });

  it("leaves code fences, code spans and escaped backslashes alone", () => {
    const source = "```tex\n\\(x\\)\n```\nuse `\\(y\\)` and \\\\(z\\\\)";
    expect(normalizeMathDelimiters(source)).toBe(source);
  });

  it("leaves an unclosed fence's contents alone", () => {
    const source = "text\n~~~\n\\[x\\]\n";
    expect(normalizeMathDelimiters(source)).toBe(source);
  });
});

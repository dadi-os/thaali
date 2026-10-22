// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownBody } from "./Markdown";

const FIXTURE = [
  "Inline $\\rightarrow$ and \\(a^2\\) math.",
  "",
  "$$",
  "\\int_0^1 x\\,dx",
  "$$",
  "",
  "\\[",
  "e^{i\\pi} + 1 = 0",
  "\\]",
  "",
  "| Name | Value |",
  "| --- | --- |",
  "| ~~old~~ | **new** |",
  "",
  "- [x] done",
  "",
  "```ts",
  "const answer: number = 42;",
  "```",
  "",
  "See https://example.com/page.",
].join("\n");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
});

async function render(content: string): Promise<HTMLDivElement> {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<MarkdownBody content={content} />);
  });
  return host;
}

describe("MarkdownBody", () => {
  it("typesets inline and display math with KaTeX", async () => {
    const el = await render(FIXTURE);
    expect(el.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(4);
    expect(el.querySelectorAll(".katex-display").length).toBe(2);
    expect(el.textContent).not.toContain("$\\rightarrow$");
    expect(el.textContent).not.toContain("\\(");
  });

  it("renders GFM tables, strikethrough, task lists and link chips", async () => {
    const el = await render(FIXTURE);
    expect(el.querySelector(".chat-md__table table th")?.textContent).toBe("Name");
    expect(el.querySelector("del")?.textContent).toBe("old");
    expect(el.querySelector('input[type="checkbox"]')).not.toBeNull();
    expect(el.querySelector("a.chat-link-chip")?.getAttribute("href")).toBe("https://example.com/page");
  });

  it("colors a fenced code block with Shiki and keeps the copy button", async () => {
    const el = await render(FIXTURE);
    const block = el.querySelector('[data-streamdown="code-block"][data-language="ts"]');
    expect(block).not.toBeNull();
    expect(el.querySelector('.chat-md__code button[aria-label="Copy code"]')).not.toBeNull();
    await vi.waitFor(
      () => {
        const colors = [...block!.querySelectorAll<HTMLElement>("code span span")].map((span) =>
          span.style.getPropertyValue("--sdm-c"),
        );
        expect(colors.filter((color) => color.startsWith("#")).length).toBeGreaterThan(1);
        expect(new Set(colors).size).toBeGreaterThan(1);
      },
      { timeout: 15_000, interval: 50 },
    );
  });
});

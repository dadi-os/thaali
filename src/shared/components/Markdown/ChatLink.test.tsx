// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownBody, InlineMarkdown } from ".";
import { bareUrlLabel, linkLabel, parseHttp } from "./ChatLink";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
  document.querySelectorAll('[role="tooltip"]').forEach((tip) => tip.remove());
});

async function mount(node: React.ReactNode): Promise<HTMLDivElement> {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => {
    createRoot(host!).render(node);
  });
  return host;
}

const url = (href: string) => parseHttp(href)!;

describe("link labels", () => {
  it("shows host and path for a bare URL, dropping scheme, www and the trailing slash", () => {
    expect(bareUrlLabel(url("https://www.example.com/"))).toBe("example.com");
    expect(bareUrlLabel(url("https://example.com/docs/page/?x=1#top"))).toBe("example.com/docs/page");
  });

  it("cuts a long path with an ellipsis", () => {
    const label = bareUrlLabel(url(`https://example.com/${"segment/".repeat(12)}`));
    expect(label.endsWith("…")).toBe(true);
    expect([...label].length).toBe(36);
  });

  it("keeps a link's own words and replaces text that only spells the URL", () => {
    const target = url("https://example.com/a/b");
    expect(linkLabel(target, "the statement")).toBe("the statement");
    expect(linkLabel(target, "https://example.com/a/b")).toBe("example.com/a/b");
    expect(linkLabel(target, "www.example.com/a/b")).toBe("example.com/a/b");
    expect(linkLabel(target, "")).toBe("example.com/a/b");
  });

  it("leaves rich children alone", () => {
    const rich = ["a ", { type: "strong" }] as unknown as React.ReactNode;
    expect(linkLabel(url("https://example.com"), rich)).toBe(rich);
  });

  it("accepts only absolute http and https targets", () => {
    expect(parseHttp("https://example.com")).not.toBeNull();
    expect(parseHttp("http://example.com")).not.toBeNull();
    for (const href of ["/relative", "mailto:a@b.co", "javascript:alert(1)", "not a url", "file:///etc/hosts"]) {
      expect(parseHttp(href)).toBeNull();
    }
  });
});

describe("ChatLink in markdown", () => {
  it("renders a favicon before the link's own text and no chip", async () => {
    const el = await mount(<MarkdownBody content="Read [the statement](https://chase.com/s/1) now." />);
    const link = el.querySelector("a.chat-link")!;
    expect(link.textContent).toBe("the statement");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.firstElementChild?.tagName).toBe("IMG");
    expect(el.querySelector(".chat-link-chip")).toBeNull();
  });

  it("shows the full URL in a tooltip on keyboard focus", async () => {
    const full = "https://example.com/very/long/path/that/the/label/cuts?id=42";
    const el = await mount(<MarkdownBody content={`[docs](${full})`} />);
    const link = el.querySelector<HTMLAnchorElement>("a.chat-link")!;
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => {
      link.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(full);
  });

  it("swaps a favicon that fails to load for the link glyph", async () => {
    const el = await mount(<MarkdownBody content="[site](https://example.com)" />);
    await act(async () => {
      el.querySelector("img")!.dispatchEvent(new Event("error"));
    });
    const link = el.querySelector("a.chat-link")!;
    expect(link.querySelector("img")).toBeNull();
    expect(link.querySelector("svg")).not.toBeNull();
    expect(link.textContent).toBe("site");
  });

  it("renders a non-http target as plain text", async () => {
    const el = await mount(<MarkdownBody content="[mail me](mailto:a@b.co) and [here](/local)" />);
    expect(el.querySelector("a.chat-link")).toBeNull();
    expect(el.textContent).toContain("mail me and here");
  });
});

describe("InlineMarkdown links", () => {
  it("previews a bare URL as host and path and a named link as its text, with no anchor", async () => {
    const el = await mount(<InlineMarkdown content="See https://example.com/a/b and [notes](https://example.com/n)" />);
    expect(el.querySelector("a")).toBeNull();
    expect(el.textContent).toContain("See example.com/a/b and notes");
  });
});

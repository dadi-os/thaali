import { describe, expect, it } from "vitest";
import { encodeQuote, parseReply, QUOTED_CHARACTERS, quoteLead, quotes, withQuote } from "./replyQuote";

describe("quote encoding", () => {
  it("marks every line and ends with a blank line", () => {
    expect(encodeQuote("one\ntwo")).toBe("> one\n> two\n\n");
  });

  it("quotes a message as it reads, without Markdown marks", () => {
    expect(encodeQuote("## Hi\n**bold** and [link](https://x.y)")).toBe("> Hi\n> bold and link\n\n");
  });

  it("keeps a blank line inside the quote as a marked line", () => {
    expect(encodeQuote("a\n\nb")).toBe("> a\n> \n> b\n\n");
  });

  it("cuts a long quote with an ellipsis", () => {
    const encoded = encodeQuote("x".repeat(500));
    expect(encoded).toBe(`> ${"x".repeat(QUOTED_CHARACTERS)}…\n\n`);
  });

  it("round-trips the quote and the reply", () => {
    const sent = withQuote("first\nsecond", "Sounds good\nthanks");
    expect(parseReply(sent)).toEqual({ files: "", quote: "first\nsecond", body: "Sounds good\nthanks" });
  });

  it("round-trips a quote with a blank line and odd characters", () => {
    const sent = withQuote("a\n\n> b *c* `d`", "ok");
    expect(parseReply(sent)).toEqual({ files: "", quote: "a\n\nb c d", body: "ok" });
  });

  it("round-trips emoji, quotes and non-Latin text", () => {
    const sent = withQuote("Zoë “O'Brien” 😀 દાદી", "yes");
    expect(parseReply(sent)).toEqual({ files: "", quote: "Zoë “O'Brien” 😀 દાદી", body: "yes" });
  });

  it("parses a message with no quote as the body", () => {
    expect(parseReply("hello\n> not a quote")).toEqual({ files: "", quote: null, body: "hello\n> not a quote" });
  });

  it("parses a quote with nothing under it", () => {
    expect(parseReply("> only\n\n")).toEqual({ files: "", quote: "only", body: "" });
    expect(parseReply("> only")).toEqual({ files: "", quote: "only", body: "" });
  });

  it("leaves a blockquote in the reply alone", () => {
    const sent = withQuote("original", "> nested\n> lines\n\nmore");
    expect(parseReply(sent)).toEqual({ files: "", quote: "original", body: "> nested\n> lines\n\nmore" });
  });

  it("does not take a blockquote with no blank line after it for a quote", () => {
    expect(parseReply("> a\nb")).toEqual({ files: "", quote: null, body: "> a\nb" });
  });

  it("sends the words alone without a quote", () => {
    expect(withQuote(null, "hi")).toBe("hi");
  });
});

describe("replies sent with files", () => {
  const a = "[a.png](box:///var/home/dadi/Inbox/2026-11/a.png)";
  const b = "[b\\[1\\].pdf](box:///var/home/dadi/Inbox/2026-11/b%5B1%5D.pdf)";

  it("returns the links, the quote and the reply", () => {
    expect(parseReply(`${a}\n${b}\n> quoted\n\nreply`)).toEqual({ files: `${a}\n${b}`, quote: "quoted", body: "reply" });
  });

  it("takes a blank line between the links and the quote", () => {
    expect(parseReply(`${a}\n\n> quoted\n\nreply`)).toEqual({ files: a, quote: "quoted", body: "reply" });
  });

  it("round-trips what Khisso and Thaali send", () => {
    const sent = [a, b, withQuote("one\ntwo", "thanks").trim()].join("\n");
    expect(parseReply(sent)).toEqual({ files: `${a}\n${b}`, quote: "one\ntwo", body: "thanks" });
  });

  it("takes links and a quote with no reply", () => {
    expect(parseReply(`${a}\n> quoted`)).toEqual({ files: a, quote: "quoted", body: "" });
  });

  it("leaves links only as the body", () => {
    expect(parseReply(`${a}\n${b}`)).toEqual({ files: "", quote: null, body: `${a}\n${b}` });
  });

  it("leaves links and a reply with no quote as the body", () => {
    expect(parseReply(`${a}\nhello`)).toEqual({ files: "", quote: null, body: `${a}\nhello` });
  });

  it("leaves links after the quote in the body", () => {
    expect(parseReply(`> quoted\n\nsee ${a}\n${b}`)).toEqual({ files: "", quote: "quoted", body: `see ${a}\n${b}` });
  });

  it("does not take an ordinary link line for a file", () => {
    expect(parseReply("[x](https://x.y)\n> quoted")).toEqual({ files: "", quote: null, body: "[x](https://x.y)\n> quoted" });
  });
});

describe("quote helpers", () => {
  it("leads with the first line that has words", () => {
    expect(quoteLead("\n  first  \nsecond")).toBe("first");
  });

  it("recognises the message a quote came from, truncated or not", () => {
    const long = `${"word ".repeat(100)}end`;
    expect(quotes(parseReply(encodeQuote(long)).quote!, long)).toBe(true);
    expect(quotes("something else", long)).toBe(false);
  });
});

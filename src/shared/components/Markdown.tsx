import type { ReactNode } from "react";
import type { ElementContent } from "hast";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./CopyButton";

export interface MarkdownBodyProps {
  /** Markdown source to render. */
  content: string;
  /** Tighter spacing and body-size headings, for small panel text. */
  compact?: boolean;
}

/**
 * Markdown body — GFM prose with Cursor-style link chips (favicon + domain), and a copy
 * button on every code block.
 */
export function MarkdownBody({ content, compact = false }: MarkdownBodyProps) {
  return (
    <div className={compact ? "chat-md chat-md--compact" : "chat-md"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const components: Components = {
  a({ href, children }) {
    if (!href) {
      return <span>{children}</span>;
    }
    return <LinkChip href={href}>{children}</LinkChip>;
  },
  pre({ node, children }) {
    return (
      <div className="chat-md__code group/code relative">
        <pre>{children}</pre>
        <CopyButton
          text={hastText(node!.children).replace(/\n$/, "")}
          label="Copy code"
          className="absolute top-1.5 right-1.5 opacity-0 transition-opacity duration-fast ease-dadi group-hover/code:opacity-100 focus-within:opacity-100"
        />
      </div>
    );
  },
};

/** Plain text of parsed markdown nodes and everything under them, e.g. a code block's source. */
function hastText(nodes: ElementContent[]): string {
  return nodes
    .map((n) => (n.type === "text" ? n.value : n.type === "element" ? hastText(n.children) : ""))
    .join("");
}

/** Longest source an inline preview parses; anything past it could never fit on one line. */
const INLINE_MAX = 1200;

export interface InlineMarkdownProps {
  /** Markdown source to preview. */
  content: string;
}

/**
 * One-line markdown preview. Inline marks (bold, italic, code) keep their styling and
 * blocks (paragraphs, headings, lists, code fences) run together as one line, so the
 * parent's CSS `truncate` clips rendered text instead of raw syntax. Renders spans
 * only, so it is safe inside buttons.
 */
export function InlineMarkdown({ content }: InlineMarkdownProps) {
  return (
    <span className="inline-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={inlineComponents}>
        {content.slice(0, INLINE_MAX)}
      </ReactMarkdown>
    </span>
  );
}

/** A block flattened into the running line, spaced from the block after it. */
function Run({ children }: { children?: ReactNode }) {
  return <span>{children} </span>;
}

/** A container whose children are already runs, or a link shown as its text. */
function Group({ children }: { children?: ReactNode }) {
  return <span>{children}</span>;
}

const inlineComponents: Components = {
  p: Run,
  h1: Run,
  h2: Run,
  h3: Run,
  h4: Run,
  h5: Run,
  h6: Run,
  li: Run,
  blockquote: Run,
  pre: Run,
  tr: Run,
  th: Run,
  td: Run,
  ul: Group,
  ol: Group,
  table: Group,
  thead: Group,
  tbody: Group,
  a: Group,
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
  hr: () => null,
  br: () => <span> </span>,
  input: () => null,
};

/** Favicon + domain chip for an absolute http(s) link; other hrefs render as plain text. */
function LinkChip({
  href,
  children,
}: {
  href: string;
  children?: ReactNode;
}) {
  const domain = httpDomain(href);
  if (domain === null) {
    return <span>{children}</span>;
  }

  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-link-chip"
      title={href}
    >
      <img
        src={favicon}
        alt=""
        width={14}
        height={14}
        className="chat-link-chip__icon"
      />
      <span className="chat-link-chip__label">{domain}</span>
    </a>
  );
}

/**
 * Registrable host for an http(s) URL, without leading www.
 * Returns null when the href is not a parseable http(s) URL.
 */
function httpDomain(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  return url.hostname.replace(/^www\./i, "");
}

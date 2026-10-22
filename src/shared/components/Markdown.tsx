import "katex/dist/katex.min.css";
import { cloneElement, createElement, isValidElement } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import type { ElementContent } from "hast";
import type { Components as InlineComponents } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Streamdown } from "streamdown";
import type {
  CodeHighlighterPlugin,
  Components,
  ControlsConfig,
  DiagramPlugin,
  ExtraProps,
  PluginConfig,
} from "streamdown";
import type { ThemeInput } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import type { MermaidConfig, createMermaidPlugin } from "@streamdown/mermaid";
import { normalizeMathDelimiters } from "../lib/content/math";
import { logLine } from "../lib/platform/log";
import { CopyButton } from "./CopyButton";

export interface MarkdownBodyProps {
  /** Markdown source to render. */
  content: string;
  /** Tighter spacing and body-size headings, for small panel text. */
  compact?: boolean;
}

/**
 * Markdown body rendered by Streamdown: GFM prose, KaTeX math (`$…$`, `\(…\)`, `$$…$$`,
 * `\[…\]`), Shiki-colored code with a copy button, Mermaid diagrams, and Cursor-style
 * link chips (favicon + domain). Replies reach thaali whole, so it renders in static
 * mode without repairing unterminated syntax.
 */
export function MarkdownBody({ content, compact = false }: MarkdownBodyProps) {
  return (
    <Streamdown
      className={compact ? "chat-md chat-md--compact space-y-0" : "chat-md space-y-0"}
      mode="static"
      parseIncompleteMarkdown={false}
      plugins={plugins}
      components={components}
      controls={controls}
      lineNumbers={false}
      codeBlockMaxHeight={0}
    >
      {normalizeMathDelimiters(content)}
    </Streamdown>
  );
}

const DARK = "(prefers-color-scheme: dark)";

/** A `:root` token's current value. @throws When the token is not defined. */
function token(style: CSSStyleDeclaration, name: string): string {
  const value = style.getPropertyValue(name).trim();
  if (!value) {
    throw new Error(`theme token ${name} is not defined`);
  }
  return value;
}

/** Mermaid's base theme in thaali's current light or dark tokens. */
function mermaidTheme(): MermaidConfig {
  const style = getComputedStyle(document.documentElement);
  const font = '"Inter", sans-serif';
  return {
    theme: "base",
    darkMode: window.matchMedia(DARK).matches,
    fontFamily: font,
    themeVariables: {
      fontFamily: font,
      background: token(style, "--bone"),
      mainBkg: token(style, "--bone-raised"),
      primaryColor: token(style, "--bone-raised"),
      primaryTextColor: token(style, "--ink"),
      primaryBorderColor: token(style, "--sage-line"),
      secondaryColor: token(style, "--bone"),
      tertiaryColor: token(style, "--bone"),
      nodeBorder: token(style, "--sage-line"),
      lineColor: token(style, "--sage-deep"),
      textColor: token(style, "--ink"),
      edgeLabelBackground: token(style, "--bone"),
    },
  };
}

type MermaidPlugin = ReturnType<typeof createMermaidPlugin>;

let mermaidLoad: Promise<MermaidPlugin> | null = null;

/** Streamdown's Mermaid plugin, imported on the first diagram; a failed import is retried next time. */
function loadMermaid(): Promise<MermaidPlugin> {
  mermaidLoad ??= import("@streamdown/mermaid").then(
    (module) => module.createMermaidPlugin(),
    (err: unknown) => {
      mermaidLoad = null;
      throw err;
    },
  );
  return mermaidLoad;
}

/** Mermaid that loads with the first diagram and draws in the theme current at that moment. */
const mermaid: DiagramPlugin = {
  name: "mermaid",
  type: "diagram",
  language: "mermaid",
  getMermaid(initial?: MermaidConfig) {
    let config = initial;
    return {
      initialize(next: MermaidConfig) {
        config = next;
      },
      async render(id: string, source: string) {
        const plugin = await loadMermaid();
        return plugin.getMermaid({ ...config, ...mermaidTheme() }).render(id, source);
      },
    };
  },
};

/** Shiki themes for code, light then dark; the file viewer colors source in the same pair. */
const CODE_THEMES: [ThemeInput, ThemeInput] = ["vitesse-light", "vitesse-dark"];

let codeLoad: Promise<CodeHighlighterPlugin> | null = null;
let codeReady: CodeHighlighterPlugin | null = null;

/** Streamdown's Shiki plugin, imported with the first code block; a failed import is retried next time. */
function loadCode(): Promise<CodeHighlighterPlugin> {
  codeLoad ??= import("@streamdown/code").then(
    (module) => (codeReady = module.createCodePlugin({ themes: CODE_THEMES })),
    (err: unknown) => {
      codeLoad = null;
      throw err;
    },
  );
  return codeLoad;
}

/** The highlighter that has not loaded yet. @throws Always. */
function codeNotLoaded(): never {
  throw new Error("code highlighter is not loaded yet");
}

/**
 * Shiki that loads with the first code block: until then a block shows plain and is
 * colored when the import lands, as it would while a grammar loads.
 */
const code: CodeHighlighterPlugin = {
  name: "shiki",
  type: "code-highlighter",
  getThemes: () => CODE_THEMES,
  getSupportedLanguages: () => (codeReady ?? codeNotLoaded()).getSupportedLanguages(),
  supportsLanguage: (language) => (codeReady ?? codeNotLoaded()).supportsLanguage(language),
  highlight(options, callback) {
    if (codeReady !== null) {
      return codeReady.highlight(options, callback);
    }
    loadCode().then(
      (plugin) => {
        const result = plugin.highlight(options, callback);
        if (result !== null && callback) {
          callback(result);
        }
      },
      (err: unknown) => logLine("error", `code highlighter failed to load: ${String(err)}`, "markdown_code_load_failed"),
    );
    return null;
  },
};

const plugins: PluginConfig = {
  code,
  math: createMathPlugin({ singleDollarTextMath: false, errorColor: "var(--error)" }),
  mermaid,
};

const controls: ControlsConfig = {
  code: false,
  table: false,
  image: false,
  mermaid: { copy: false, download: false, fullscreen: true, panZoom: true },
};

/** A tag rendered bare, so `.chat-md` alone styles it instead of Streamdown's defaults. */
function bare(tag: string) {
  return function Bare({ node: _node, ...props }: HTMLAttributes<HTMLElement> & ExtraProps) {
    return createElement(tag, props);
  };
}

const components: Components = {
  h1: bare("h1"),
  h2: bare("h2"),
  h3: bare("h3"),
  h4: bare("h4"),
  h5: bare("h5"),
  h6: bare("h6"),
  ul: bare("ul"),
  ol: bare("ol"),
  li: bare("li"),
  blockquote: bare("blockquote"),
  hr: bare("hr"),
  strong: bare("strong"),
  thead: bare("thead"),
  tbody: bare("tbody"),
  tr: bare("tr"),
  th: bare("th"),
  td: bare("td"),
  sup: bare("sup"),
  sub: bare("sub"),
  inlineCode: bare("code"),
  a({ href, children }) {
    if (!href) {
      return <span>{children}</span>;
    }
    return <LinkChip href={href}>{children}</LinkChip>;
  },
  table({ node: _node, ...props }) {
    return (
      <div className="chat-md__table">
        <table {...props} />
      </div>
    );
  },
  pre({ node, children }) {
    const block = isValidElement<Record<string, unknown>>(children)
      ? cloneElement(children, { "data-block": "true" })
      : children;
    const code = node!.children[0];
    const language = code?.type === "element" ? code.properties.className : undefined;
    if (Array.isArray(language) && language.includes("language-mermaid")) {
      return block;
    }
    return (
      <div className="chat-md__code group/code relative">
        {block}
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

const inlineComponents: InlineComponents = {
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

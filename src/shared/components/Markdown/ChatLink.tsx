import { useState } from "react";
import type { ReactNode } from "react";
import { Tooltip } from "../../overlay/Tooltip";
import { Icon } from "../../ui/Icon";

/** Longest host-and-path label a bare URL shows before it is cut with an ellipsis. */
const LABEL_MAX = 36;

/** Wait before the full-URL tooltip shows under the pointer. */
const TOOLTIP_DELAY_MS = 450;

/** Parsed absolute http(s) URL, or null for anything else (relative, mailto:, javascript:, unparseable). */
export function parseHttp(href: string): URL | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? url : null;
}

/** Host without a leading www. */
function hostOf(url: URL): string {
  return url.hostname.replace(/^www\./i, "");
}

/** What a link with no words of its own shows: the host and the start of its path, cut at {@link LABEL_MAX}. */
export function bareUrlLabel(url: URL): string {
  const path = url.pathname.replace(/\/$/, "");
  const label = `${hostOf(url)}${path}`;
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label;
}

/** Whether `text` is just the URL spelled out, with or without its scheme, www or trailing slash. */
function isBareUrl(text: string, url: URL): boolean {
  const spelled = (value: string) => value.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
  return spelled(text) === spelled(url.href) || spelled(text) === spelled(url.href.replace(/#.*$/, ""));
}

/** The text of a link's children when they are plain text, else null. */
function plainText(children: ReactNode): string | null {
  if (typeof children === "string") {
    return children;
  }
  if (Array.isArray(children) && children.every((child) => typeof child === "string")) {
    return children.join("");
  }
  return null;
}

/**
 * The words a link shows: its own text, or {@link bareUrlLabel} when its text is only the URL (or empty).
 * @returns The children untouched when they are not plain text.
 */
export function linkLabel(url: URL, children: ReactNode): ReactNode {
  const text = plainText(children);
  if (text === null) {
    return children;
  }
  return text.trim() === "" || isBareUrl(text, url) ? bareUrlLabel(url) : children;
}

/** The URL's favicon; a neutral link glyph stands in when the image does not load. */
function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Icon name="link" size={12} style={{ display: "inline-block", verticalAlign: "-0.1em", marginRight: "0.3em", opacity: 0.7 }} />;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      width={14}
      height={14}
      className="chat-link__icon"
      onError={() => setFailed(true)}
    />
  );
}

/** Props of {@link ChatLink}. */
export type ChatLinkProps = {
  /** The link target as written. */
  href: string;
  /** The link's text as parsed. */
  children?: ReactNode;
};

/**
 * An inline link in chat text: the site's favicon before blue text, underlined only on hover, with the full URL in a
 * tooltip on hover and keyboard focus. It opens outside the app. A target that is not an absolute http(s) URL is plain text.
 */
export function ChatLink({ href, children }: ChatLinkProps) {
  const url = parseHttp(href);
  if (url === null) {
    return <span>{children}</span>;
  }
  const label = linkLabel(url, children);
  return (
    <Tooltip content={href} delayMs={TOOLTIP_DELAY_MS} wrap className="inline!">
      <a href={href} target="_blank" rel="noopener noreferrer" className="chat-link">
        <Favicon key={hostOf(url)} domain={hostOf(url)} />
        {label === children ? label : <span className="chat-link__url">{label}</span>}
      </a>
    </Tooltip>
  );
}

/** A link in a one-line preview: text only, with a bare URL cut to its host and path; plain text for a non-http target. */
export function PreviewLink({ href, children }: { href?: string; children?: ReactNode }) {
  const url = href === undefined ? null : parseHttp(href);
  return <span>{url === null ? children : linkLabel(url, children)}</span>;
}

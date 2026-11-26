/** The dadi home on the box: the root of the explorer and of every `box://` link. */
export const BOX_HOME = "/var/home/dadi";

/** The scheme a link to a file or folder on the box carries. */
export const BOX_SCHEME = "box://";

/** A parsed `box://` link. */
export type BoxLink = {
  /** The absolute path, with no trailing slash (except the root). */
  path: string;
  /** Whether the link ended in a slash, which marks a folder. */
  folder: boolean;
};

/** The last segment of an absolute path. */
export function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** The folder an absolute path is in; the home is its own parent, since nothing above it is listable. */
export function parentPath(path: string): string {
  return path === BOX_HOME || !path.startsWith(`${BOX_HOME}/`) ? BOX_HOME : path.slice(0, path.lastIndexOf("/"));
}

/** `path` joined with a child `name`. */
export function childPath(path: string, name: string): string {
  return `${path}/${name}`;
}

/** Every folder from the home down to `path`'s parent, outermost first; the home itself has none above it. */
export function ancestorsOf(path: string): string[] {
  const out: string[] = [];
  for (let p = parentPath(path); !out.includes(p); p = parentPath(p)) {
    out.unshift(p);
  }
  return out;
}

/** One path segment as it sits in a link: percent-encoded, with parentheses too, which would end a Markdown link early. */
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/\(/g, "%28").replace(/\)/g, "%29");
}

/** The `box://` link target for `path`: each segment percent-encoded, and a trailing slash for a folder. */
export function boxHref(path: string, folder: boolean): string {
  const encoded = path.split("/").map(encodeSegment).join("/");
  return `${BOX_SCHEME}${encoded}${folder && !encoded.endsWith("/") ? "/" : ""}`;
}

/**
 * Parse a link target as {@link boxHref} writes it.
 * @returns null for anything that is not an absolute `box://` path, or that climbs with `..`
 */
export function parseBoxHref(href: string): BoxLink | null {
  if (!href.startsWith(`${BOX_SCHEME}/`)) {
    return null;
  }
  const raw = href.slice(BOX_SCHEME.length);
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const segments = decoded.split("/").filter((segment, i) => segment !== "" || i === 0);
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    return null;
  }
  const folder = decoded.endsWith("/");
  const path = segments.join("/");
  return { path: path === "" ? "/" : path, folder };
}

/** The Markdown link to `path` as a message carries it: its name as the text (brackets escaped) and its {@link boxHref} as the target. */
export function boxMarkdownLink(path: string, folder: boolean): string {
  const name = baseName(path).replace(/[\\[\]]/g, "\\$&");
  return `[${name}](${boxHref(path, folder)})`;
}

/** The Inbox folder Ankur's uploads land in for the month `now` falls in (local time), as `<home>/Inbox/<yyyy-mm>`. */
export function inboxFolder(now: Date): string {
  return `${BOX_HOME}/Inbox/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

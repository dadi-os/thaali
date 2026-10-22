/** Opening or closing line of a fenced code block: up to three spaces, then three or more backticks or tildes. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** An inline code span: a backtick run, anything, and the same run again. */
const CODE_SPAN = /(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g;

/** `\[ … \]` not preceded by a backslash (`\\[` is an escaped backslash, then a bracket). */
const DISPLAY = /(?<!\\)\\\[([\s\S]+?)(?<!\\)\\\]/g;

/** `\( … \)` not preceded by a backslash. */
const INLINE = /(?<!\\)\\\(([\s\S]+?)(?<!\\)\\\)/g;

/**
 * `$ … $` that reads as LaTeX, not money: no space or digit just inside the opening `$`,
 * no space before the closing one, a `\`, `^` or `_` inside, and not touching a word or
 * another `$` on either side. `$\rightarrow$` and `$x^2$` match; `$5 and $10` does not.
 */
const SINGLE_DOLLAR = /(?<![\\$\w])\$(?![\s\d$])([^$\n]*?[\\^_][^$\n]*?)(?<![\s\\])\$(?![\w$])/g;

type Segment = { code: boolean; text: string };

/** The source cut into prose and code (fenced blocks and inline code spans), in order. */
function segments(source: string): Segment[] {
  const out: Segment[] = [];
  let prose = "";
  let block = "";
  let fence: string | null = null;

  for (const line of source.split(/(?<=\n)/)) {
    const marker = FENCE.exec(line)?.[1];
    if (fence === null) {
      if (marker === undefined) {
        prose += line;
        continue;
      }
      out.push(...proseSegments(prose));
      prose = "";
      fence = marker;
      block = line;
      continue;
    }
    block += line;
    const closes =
      marker !== undefined &&
      marker[0] === fence[0] &&
      marker.length >= fence.length &&
      line.trim() === marker;
    if (closes) {
      out.push({ code: true, text: block });
      block = "";
      fence = null;
    }
  }
  if (fence !== null) {
    out.push({ code: true, text: block });
  }
  out.push(...proseSegments(prose));
  return out;
}

/** Prose cut around its inline code spans. */
function proseSegments(prose: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const span of prose.matchAll(CODE_SPAN)) {
    const start = span.index;
    out.push({ code: false, text: prose.slice(last, start) });
    out.push({ code: true, text: span[0] });
    last = start + span[0].length;
  }
  out.push({ code: false, text: prose.slice(last) });
  return out;
}

/**
 * `\[ … \]` alone on its lines as a `$$` block (indented like the line it sat on, so it
 * stays inside a list item), or `$$ … $$` where it sits inside a sentence.
 */
function displayMath(match: string, inner: string, offset: number, prose: string): string {
  const lineStart = prose.lastIndexOf("\n", offset - 1) + 1;
  const indent = prose.slice(lineStart, offset);
  const end = offset + match.length;
  const lineEnd = prose.indexOf("\n", end);
  const rest = prose.slice(end, lineEnd === -1 ? prose.length : lineEnd);
  const tex = inner.trim();
  if (indent.trim() === "" && rest.trim() === "") {
    return `$$\n${indent}${tex}\n${indent}$$`;
  }
  return `$$${tex}$$`;
}

/**
 * Markdown with its math in the `$$ … $$` that remark-math reads (single-dollar math is
 * off, so a price stays a price): `\[ … \]` as a block or inline `$$`, and `\( … \)` and
 * LaTeX-looking `$ … $` as inline `$$`, leaving code blocks and code spans untouched.
 */
export function normalizeMathDelimiters(source: string): string {
  if (!source.includes("\\(") && !source.includes("\\[") && !source.includes("$")) {
    return source;
  }
  return segments(source)
    .map((segment) =>
      segment.code
        ? segment.text
        : segment.text
            .replace(DISPLAY, displayMath)
            .replace(INLINE, (_match, inner: string) => `$$${inner.trim()}$$`)
            .replace(SINGLE_DOLLAR, (_match, inner: string) => `$$${inner}$$`),
    )
    .join("");
}

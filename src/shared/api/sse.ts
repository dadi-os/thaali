/**
 * Shared SSE chunk parsing for Transport implementations.
 * Splits on blank lines, extracts `data:` payloads, and skips [DONE]; a malformed
 * payload throws so the stream fails visibly.
 * Returns the unconsumed trailing buffer fragment.
 */
export function consumeSseBuffer(
  buffer: string,
  onEvent: (data: unknown) => void,
): string {
  const chunks = buffer.split("\n\n");
  const rest = chunks.pop() ?? "";
  for (const chunk of chunks) {
    const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) {
      continue;
    }
    const raw = dataLine.slice(5).trim();
    if (!raw || raw === "[DONE]") {
      continue;
    }
    onEvent(JSON.parse(raw) as unknown);
  }
  return rest;
}

/** Join mesh base URL and path without double slashes. */
export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

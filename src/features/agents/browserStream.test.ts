import { describe, expect, it } from "vitest";
import { takeFrames } from "./browserStream";

/** One ffmpeg mpjpeg part around `body`, as Nas relays it. */
function part(body: number[]): Uint8Array {
  const head = new TextEncoder().encode(
    `--frame\r\nContent-type: image/jpeg\r\nContent-length: ${body.length}\r\n\r\n`,
  );
  return Uint8Array.from([...head, ...body, 13, 10]);
}

describe("takeFrames", () => {
  it("splits complete parts and keeps a partial one for the next chunk", () => {
    const stream = Uint8Array.from([...part([1, 2, 3]), ...part([13, 10, 13, 10, 9])]);
    const cut = stream.length - 4;
    const first = takeFrames(stream.subarray(0, cut));
    expect(first.frames.map((f) => [...f])).toEqual([[1, 2, 3]]);

    const joined = Uint8Array.from([...first.rest, ...stream.subarray(cut)]);
    const second = takeFrames(joined);
    expect(second.frames.map((f) => [...f])).toEqual([[13, 10, 13, 10, 9]]);
    expect(second.rest.length).toBe(2);
  });

  it("waits for a part whose headers have not all arrived", () => {
    const head = new TextEncoder().encode("--frame\r\nContent-length: 4\r\n");
    expect(takeFrames(head).frames).toEqual([]);
    expect(takeFrames(head).rest.length).toBe(head.length);
  });

  it("throws on a part without a Content-Length", () => {
    const bad = new TextEncoder().encode("--frame\r\nContent-type: image/jpeg\r\n\r\nxx");
    expect(() => takeFrames(bad)).toThrow(/Content-Length/);
  });
});

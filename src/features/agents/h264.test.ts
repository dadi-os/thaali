import { describe, expect, it } from "vitest";
import { H264Splitter, takeNalus } from "./h264";

const AUD = [0x09, 0xf0];
const SPS = [0x67, 0x42, 0xc0, 0x1f, 0xaa, 0xbb];
const PPS = [0x68, 0xce, 0x3c, 0x80];
const IDR = [0x65, 0x88, 0x84, 0x21];
const P_FRAME = [0x41, 0x9a, 0x00, 0x01];

/** Annex B bytes for `nalus`, each behind a start code (4-byte for the first, 3-byte after). */
function annexB(...nalus: number[][]): Uint8Array {
  return Uint8Array.from(nalus.flatMap((n, i) => [...(i === 0 ? [0, 0, 0, 1] : [0, 0, 1]), ...n]));
}

/** Three frames; the last delimiter is unfinished, so the final frame is not closed yet. */
const stream = annexB(AUD, SPS, PPS, IDR, AUD, P_FRAME, AUD, P_FRAME, AUD);

describe("takeNalus", () => {
  it("returns units once the next start code arrives and keeps the unfinished one", () => {
    const { nalus, rest } = takeNalus(annexB(AUD, SPS));
    expect(nalus.map((n) => [...n])).toEqual([AUD]);
    expect([...rest]).toEqual([0, 0, 1, ...SPS]);
  });

  it("strips the zero that extends a 4-byte start code", () => {
    const { nalus } = takeNalus(Uint8Array.from([0, 0, 1, ...AUD, 0, 0, 0, 1, ...SPS, 0, 0, 1]));
    expect(nalus.map((n) => [...n])).toEqual([AUD, SPS]);
  });
});

describe("H264Splitter", () => {
  it("configures once from the SPS and PPS, then yields each frame length-prefixed", () => {
    const events = new H264Splitter().push(stream);
    expect(events.map((e) => e.kind)).toEqual(["config", "frame", "frame"]);
    const [config, key, delta] = events;
    expect(config).toMatchObject({ kind: "config", config: { codec: "avc1.42c01f" } });
    if (config.kind !== "config" || key.kind !== "frame" || delta.kind !== "frame") {
      throw new Error("unexpected event kinds");
    }
    expect([...config.config.description]).toEqual([
      1, 0x42, 0xc0, 0x1f, 0xff, 0xe1, 0, SPS.length, ...SPS, 1, 0, PPS.length, ...PPS,
    ]);
    expect(key.frame.key).toBe(true);
    expect([...key.frame.data]).toEqual([0, 0, 0, IDR.length, ...IDR]);
    expect(delta.frame.key).toBe(false);
    expect([...delta.frame.data]).toEqual([0, 0, 0, P_FRAME.length, ...P_FRAME]);
  });

  it("gives the same events however the stream is chunked", () => {
    const whole = new H264Splitter().push(stream);
    const splitter = new H264Splitter();
    const pieces = Array.from(stream, (byte) => splitter.push(Uint8Array.of(byte))).flat();
    expect(pieces).toEqual(whole);
  });

  it("does not repeat a config that has not changed", () => {
    const splitter = new H264Splitter();
    splitter.push(stream);
    const again = splitter.push(annexB(SPS, PPS, IDR, AUD));
    expect(again.filter((e) => e.kind === "config")).toEqual([]);
  });
});

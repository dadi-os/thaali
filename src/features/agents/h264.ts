/**
 * Split Nas's raw H.264 stream (Annex B, an access unit delimiter before every frame) into
 * the pieces a WebCodecs `VideoDecoder` takes: one decoder configuration from the stream's
 * SPS and PPS, then one length-prefixed (AVCC) chunk per frame.
 */

/** NAL unit types the splitter acts on. */
const NAL_IDR = 5;
const NAL_SPS = 7;
const NAL_PPS = 8;
const NAL_AUD = 9;

/** What the decoder needs to start: the `codec` string and the `description` (avcC record). */
export type H264Config = { codec: string; description: Uint8Array<ArrayBuffer> };

/** One frame as length-prefixed NAL units; `key` frames can start decoding. */
export type H264Frame = { key: boolean; data: Uint8Array<ArrayBuffer> };

/** What the splitter has completed, in stream order. */
export type H264Event = { kind: "config"; config: H264Config } | { kind: "frame"; frame: H264Frame };

/** Offset of the first 00 00 01 at or after `from`, or -1. */
function startCode(buffer: Uint8Array, from: number): number {
  for (let i = from; i + 2 < buffer.length; i++) {
    if (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 1) {
      return i;
    }
  }
  return -1;
}

/**
 * takeNalus splits the complete NAL units off the front of an Annex B buffer, start codes
 * stripped, and returns them with the remainder from the start code of the unfinished one.
 * A unit is complete once the next start code has arrived.
 */
export function takeNalus(buffer: Uint8Array): { nalus: Uint8Array<ArrayBuffer>[]; rest: Uint8Array<ArrayBuffer> } {
  const nalus: Uint8Array<ArrayBuffer>[] = [];
  let start = startCode(buffer, 0);
  if (start < 0) {
    return { nalus, rest: buffer.slice(Math.max(0, buffer.length - 2)) };
  }
  for (;;) {
    const next = startCode(buffer, start + 3);
    if (next < 0) {
      return { nalus, rest: buffer.slice(start) };
    }
    let end = next;
    while (end > start + 3 && buffer[end - 1] === 0) {
      end--;
    }
    nalus.push(buffer.slice(start + 3, end));
    start = next;
  }
}

/** The avcC configuration record for `sps` and `pps` (NAL units without start codes). */
function avcConfig(sps: Uint8Array, pps: Uint8Array): H264Config {
  const description = new Uint8Array(11 + sps.length + pps.length);
  description.set([1, sps[1], sps[2], sps[3], 0xff, 0xe1, sps.length >> 8, sps.length & 0xff]);
  description.set(sps, 8);
  const at = 8 + sps.length;
  description.set([1, pps.length >> 8, pps.length & 0xff], at);
  description.set(pps, at + 3);
  const hex = [sps[1], sps[2], sps[3]].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { codec: `avc1.${hex}`, description };
}

/** True when `a` and `b` hold the same bytes. */
function sameBytes(a: Uint8Array | null, b: Uint8Array): boolean {
  return a !== null && a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/**
 * Stateful splitter for one stream. `push` takes the next network chunk and returns what it
 * completed: a config when the SPS and PPS first arrive or change, and a frame each time the
 * next delimiter closes the one before it, so a frame appears one frame period after it was
 * encoded.
 */
export class H264Splitter {
  private rest: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private sps: Uint8Array | null = null;
  private pps: Uint8Array | null = null;
  private pending: Uint8Array[] = [];
  private key = false;

  push(chunk: Uint8Array): H264Event[] {
    const joined = new Uint8Array(this.rest.length + chunk.length);
    joined.set(this.rest);
    joined.set(chunk, this.rest.length);
    const { nalus, rest } = takeNalus(joined);
    this.rest = rest;
    const events: H264Event[] = [];
    for (const nalu of nalus) {
      const type = nalu[0] & 0x1f;
      if (type === NAL_AUD) {
        const frame = this.closeFrame();
        if (frame) {
          events.push({ kind: "frame", frame });
        }
      } else if (type === NAL_SPS || type === NAL_PPS) {
        const config = this.setParameterSet(type, nalu);
        if (config) {
          events.push({ kind: "config", config });
        }
      } else {
        this.pending.push(nalu);
        this.key ||= type === NAL_IDR;
      }
    }
    return events;
  }

  /** The frame gathered since the last delimiter, or null when there is none. */
  private closeFrame(): H264Frame | null {
    if (this.pending.length === 0) {
      return null;
    }
    const data = new Uint8Array(this.pending.reduce((sum, n) => sum + 4 + n.length, 0));
    const view = new DataView(data.buffer);
    let at = 0;
    for (const nalu of this.pending) {
      view.setUint32(at, nalu.length);
      data.set(nalu, at + 4);
      at += 4 + nalu.length;
    }
    const frame = { key: this.key, data };
    this.pending = [];
    this.key = false;
    return frame;
  }

  /** Remember an SPS or PPS; returns the new config once both are known and one changed. */
  private setParameterSet(type: number, nalu: Uint8Array): H264Config | null {
    const known = type === NAL_SPS ? this.sps : this.pps;
    if (sameBytes(known, nalu)) {
      return null;
    }
    if (type === NAL_SPS) {
      this.sps = nalu;
    } else {
      this.pps = nalu;
    }
    return this.sps && this.pps ? avcConfig(this.sps, this.pps) : null;
  }
}

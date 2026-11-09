import { describe, expect, it } from "vitest";
import { capitalize, formatGb, formatUptime, loadTone } from "./format";

describe("System page formats", () => {
  it("writes bytes as gigabytes with the precision a size needs", () => {
    expect(formatGb(26.8 * 1e9)).toBe("25 GB");
    expect(formatGb(33.5 * 1e9)).toBe("31.2 GB");
    expect(formatGb(248 * 1e9)).toBe("231 GB");
  });

  it("writes uptime as Khisso does: the two largest nonzero units of days, hours and minutes", () => {
    expect(formatUptime(11 * 86_400 + 4 * 3600 + 59)).toBe("11 days, 4 hours");
    expect(formatUptime(86_400 + 3600)).toBe("1 day, 1 hour");
    expect(formatUptime(3600 + 57 * 60 + 12)).toBe("1 hour, 57 minutes");
    expect(formatUptime(5 * 60)).toBe("5 minutes");
    expect(formatUptime(30)).toBe("0 minutes");
  });

  it("tones a meter by how full it is", () => {
    expect(loadTone(40)).toBe("var(--sage)");
    expect(loadTone(80)).toBe("var(--clay)");
    expect(loadTone(95)).toBe("var(--error)");
  });

  it("capitalises a service name", () => {
    expect(capitalize("dwar")).toBe("Dwar");
  });
});

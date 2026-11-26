import { describe, expect, it } from "vitest";
import type { Transport } from "../transport";
import { createChaaviClient } from ".";

/** A transport whose icon route answers each domain from `icons` and anything else with the generic icon. */
function client(icons: Record<string, string>, asked: string[] = []) {
  const transport = {
    request: async (opts: { path: string }) => {
      asked.push(opts.path);
      const domain = decodeURIComponent(/^\/icons\/([^/]+)\//.exec(opts.path)![1]!);
      return new Blob([icons[domain] ?? "generic"]);
    },
  } as unknown as Transport;
  return createChaaviClient(transport, "http://chaavi.dadi");
}

describe("getSiteIcon", () => {
  it("returns the icon Chaavi serves for a domain", async () => {
    const icon = await client({ "github.com": "octocat" }).getSiteIcon("github.com");
    expect(await icon!.text()).toBe("octocat");
  });

  it("returns null when Chaavi answers with its generic icon, so the letter mark stays", async () => {
    expect(await client({}).getSiteIcon("unknown.example")).toBeNull();
  });

  it("asks only Chaavi's own https icon route, once per domain request", async () => {
    const asked: string[] = [];
    await client({}, asked).getSiteIcon("github.com");
    expect(asked).toEqual(["/icons/no-icon.invalid/icon.png", "/icons/github.com/icon.png"]);
  });
});

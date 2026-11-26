import { describe, expect, it } from "vitest";
import { siteDomain } from "./siteIcon";

const login = (...uris: string[]) => ({ type: "login" as const, login: { uris: uris.map((uri) => ({ uri })) } });

describe("siteDomain", () => {
  it("takes the host of the first website, with or without a scheme, www or a port", () => {
    expect(siteDomain(login("https://www.GitHub.com/login", "other.example"))).toBe("github.com");
    expect(siteDomain(login("dash.cloudflare.example:8443/x"))).toBe("dash.cloudflare.example");
    expect(siteDomain(login("apple.com"))).toBe("apple.com");
  });

  it("is null for a note, a login without a website, an app id, an IP address or a bare word", () => {
    expect(siteDomain({ type: "note" })).toBeNull();
    expect(siteDomain(login())).toBeNull();
    expect(siteDomain(login("androidapp://com.example.app"))).toBeNull();
    expect(siteDomain(login("192.168.1.5"))).toBeNull();
    expect(siteDomain(login("localhost"))).toBeNull();
    expect(siteDomain(login(""))).toBeNull();
  });
});

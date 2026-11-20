import { describe, expect, it } from "vitest";
import { plainPreview } from "./format";

describe("plainPreview", () => {
  it("shows a link's words and a bare URL's host and path, keeping the sentence's punctuation", () => {
    expect(plainPreview("Read [the statement](https://chase.com/s/1) and https://www.example.com/a/b/c.")).toBe(
      "Read the statement and example.com/a/b/c.",
    );
  });

  it("strips marks and joins lines", () => {
    expect(plainPreview("**Done**\n- `x` ok")).toBe("Done x ok");
  });
});

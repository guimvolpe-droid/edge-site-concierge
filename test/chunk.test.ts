import { describe, it, expect } from "vitest";
import { chunkText } from "../src/core/chunk";

describe("chunkText", () => {
  it("returns nothing for blank input", () => {
    expect(chunkText("   \n  ", "s")).toEqual([]);
  });

  it("keeps short text as a single chunk and preserves the source", () => {
    const c = chunkText("Hello world.", "https://site/x");
    expect(c).toHaveLength(1);
    expect(c[0].source).toBe("https://site/x");
  });

  it("splits long text into multiple overlapping chunks within the size bound", () => {
    const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} about the topic.`).join(" ");
    const c = chunkText(text, "s", { maxChars: 200, overlap: 40 });
    expect(c.length).toBeGreaterThan(1);
    expect(c.every((x) => x.text.length <= 240)).toBe(true);
  });
});

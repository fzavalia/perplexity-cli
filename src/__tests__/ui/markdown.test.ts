import { describe, it, expect } from "vitest";
import { createMarkdownRenderer } from "../../ui/markdown.js";

describe("createMarkdownRenderer", () => {
  const renderer = createMarkdownRenderer();

  it("renders paragraph as trimmed text", () => {
    const result = renderer.render("Hello world");
    expect(result).toBe("Hello world");
  });

  it("renders bold markdown", () => {
    const result = renderer.render("**bold**");
    expect(result).toContain("bold");
  });

  it("renders inline code markdown", () => {
    const result = renderer.render("`code`");
    expect(result).toContain("code");
  });

  it("trims trailing whitespace", () => {
    const result = renderer.render("Hello world\n\n");
    expect(result).toBe(result.trimEnd());
  });

  it("returns a string (not a Promise)", () => {
    const result = renderer.render("test");
    expect(typeof result).toBe("string");
  });
});

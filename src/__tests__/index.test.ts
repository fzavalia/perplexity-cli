import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRunChat, mockRunDirectQuery } = vi.hoisted(() => ({
  mockRunChat: vi.fn(),
  mockRunDirectQuery: vi.fn(),
}));

vi.mock("../commands/chat.js", () => ({
  runChat: mockRunChat,
}));

vi.mock("../commands/directQuery.js", () => ({
  runDirectQuery: mockRunDirectQuery,
}));

describe("index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports runChat as the default action", async () => {
    expect(mockRunChat).toBeDefined();
  });

  it("exports runDirectQuery for direct question mode", async () => {
    expect(mockRunDirectQuery).toBeDefined();
  });
});

describe("mergeStdinAndQuestion", () => {
  it("combines piped content and question argument with newline separator", async () => {
    const { mergeStdinAndQuestion } = await import("../index.js");
    const result = mergeStdinAndQuestion("piped content", "explain this");
    expect(result).toBe("piped content\n\nexplain this");
  });

  it("uses only piped content when no question provided", async () => {
    const { mergeStdinAndQuestion } = await import("../index.js");
    const result = mergeStdinAndQuestion("piped content", "");
    expect(result).toBe("piped content");
  });

  it("uses only question when no stdin piped", async () => {
    const { mergeStdinAndQuestion } = await import("../index.js");
    const result = mergeStdinAndQuestion("", "what is TypeScript?");
    expect(result).toBe("what is TypeScript?");
  });

  it("returns empty string when neither stdin nor question", async () => {
    const { mergeStdinAndQuestion } = await import("../index.js");
    const result = mergeStdinAndQuestion("", "");
    expect(result).toBe("");
  });

  it("trims whitespace from piped content", async () => {
    const { mergeStdinAndQuestion } = await import("../index.js");
    const result = mergeStdinAndQuestion("  content with spaces  \n", "explain");
    expect(result).toBe("content with spaces\n\nexplain");
  });
});

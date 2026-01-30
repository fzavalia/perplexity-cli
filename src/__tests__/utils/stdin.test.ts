import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";

describe("readStdinIfPiped", () => {
  const originalStdin = process.stdin;

  afterEach(() => {
    Object.defineProperty(process, "stdin", { value: originalStdin });
  });

  it("returns empty string when stdin.isTTY is true", async () => {
    const mockStdin = new Readable({ read() {} }) as typeof process.stdin;
    Object.defineProperty(mockStdin, "isTTY", { value: true });
    Object.defineProperty(process, "stdin", { value: mockStdin });

    const { readStdinIfPiped } = await import("../../utils/stdin.js");
    const result = await readStdinIfPiped();

    expect(result).toBe("");
  });

  it("reads and concatenates piped chunks", async () => {
    const mockStdin = new Readable({
      read() {
        this.push("hello ");
        this.push("world");
        this.push(null);
      },
    }) as typeof process.stdin;
    Object.defineProperty(mockStdin, "isTTY", { value: false });
    Object.defineProperty(process, "stdin", { value: mockStdin });

    const { readStdinIfPiped } = await import("../../utils/stdin.js");
    const result = await readStdinIfPiped();

    expect(result).toBe("hello world");
  });

  it("returns empty string for empty piped input", async () => {
    const mockStdin = new Readable({
      read() {
        this.push(null);
      },
    }) as typeof process.stdin;
    Object.defineProperty(mockStdin, "isTTY", { value: false });
    Object.defineProperty(process, "stdin", { value: mockStdin });

    const { readStdinIfPiped } = await import("../../utils/stdin.js");
    const result = await readStdinIfPiped();

    expect(result).toBe("");
  });
});

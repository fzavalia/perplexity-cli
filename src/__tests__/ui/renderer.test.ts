import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRenderer } from "../../ui/renderer.js";

let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRenderer", () => {
  describe("assistantToken", () => {
    it("writes newline on first token", () => {
      const r = createRenderer();
      r.assistantToken("hello");
      expect(stdoutWriteSpy).toHaveBeenCalledWith("\n");
      expect(stdoutWriteSpy).toHaveBeenCalledWith("hello");
    });

    it("formats citation references [N]", () => {
      const r = createRenderer();
      r.assistantToken("See [1] and [2]");
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining("[1]")
      );
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining("[2]")
      );
    });

    it("writes token directly after first", () => {
      const r = createRenderer();
      r.assistantToken("a");
      stdoutWriteSpy.mockClear();
      r.assistantToken("b");
      expect(stdoutWriteSpy).toHaveBeenCalledWith("b");
      expect(stdoutWriteSpy).not.toHaveBeenCalledWith("\n");
    });
  });

  describe("assistantEnd", () => {
    it("writes newline", () => {
      const r = createRenderer();
      r.assistantToken("x");
      stdoutWriteSpy.mockClear();
      r.assistantEnd();
      expect(stdoutWriteSpy).toHaveBeenCalledWith("\n");
    });

    it("resets first token flag", () => {
      const r = createRenderer();
      r.assistantToken("x");
      r.assistantEnd();
      stdoutWriteSpy.mockClear();
      r.assistantToken("y");
      expect(stdoutWriteSpy).toHaveBeenCalledWith("\n");
    });
  });

  describe("assistantComplete", () => {
    it("writes content with newline", () => {
      const r = createRenderer();
      r.assistantComplete("hello");
      expect(stdoutWriteSpy).toHaveBeenCalledWith("hello\n");
    });
  });

  describe("sources", () => {
    it("displays sources with index and url", () => {
      const r = createRenderer();
      r.sources([{ index: 1, title: "T", url: "https://x.com" }]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("https://x.com")
      );
    });
  });

  describe("error", () => {
    it("displays error message", () => {
      const r = createRenderer();
      r.error("bad thing");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("bad thing")
      );
    });
  });

  describe("info", () => {
    it("displays info message", () => {
      const r = createRenderer();
      r.info("some info");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("some info")
      );
    });
  });
});

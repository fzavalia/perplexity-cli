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
      const r = createRenderer({ isTTY: false });
      r.sources([{ index: 1, title: "T", url: "https://x.com" }]);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[1] https://x.com")
      );
    });
  });

  describe("error", () => {
    it("displays error message", () => {
      const r = createRenderer({ isTTY: false });
      r.error("bad thing");
      expect(consoleErrorSpy).toHaveBeenCalledWith("bad thing");
    });
  });

  describe("info", () => {
    it("displays info message", () => {
      const r = createRenderer({ isTTY: false });
      r.info("some info");
      expect(consoleLogSpy).toHaveBeenCalledWith("some info");
    });
  });

  describe("color mode", () => {
    it("error output contains the message on TTY", () => {
      const r = createRenderer({ isTTY: true, noColor: false });
      r.error("bad");
      const arg = consoleErrorSpy.mock.calls[0][0] as string;
      expect(arg).toContain("bad");
    });

    it("disables color when noColor is true", () => {
      const r = createRenderer({ isTTY: true, noColor: true });
      r.error("bad");
      expect(consoleErrorSpy).toHaveBeenCalledWith("bad");
    });
  });
});

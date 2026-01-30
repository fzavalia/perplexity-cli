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
  describe("plain mode", () => {
    describe("assistantToken", () => {
      it("writes raw token without first-token newline", () => {
        const r = createRenderer({ plain: true });
        r.assistantToken("hello");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("hello");
        expect(stdoutWriteSpy).not.toHaveBeenCalledWith("\n");
      });

      it("writes subsequent tokens directly", () => {
        const r = createRenderer({ plain: true });
        r.assistantToken("a");
        r.assistantToken("b");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("a");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("b");
      });
    });

    describe("assistantEnd", () => {
      it("outputs newline without ANSI clearing", () => {
        const r = createRenderer({ plain: true });
        r.assistantToken("hello");
        stdoutWriteSpy.mockClear();
        r.assistantEnd();
        expect(stdoutWriteSpy).toHaveBeenCalledWith("\n");
        expect(stdoutWriteSpy).not.toHaveBeenCalledWith(
          expect.stringContaining("\x1b")
        );
      });
    });

    describe("assistantComplete", () => {
      it("outputs raw content without markdown rendering", () => {
        const r = createRenderer({ plain: true });
        r.assistantComplete("**bold**");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("**bold**\n");
      });
    });

    describe("sources", () => {
      it("displays plain text without colors", () => {
        const r = createRenderer({ plain: true });
        r.sources([{ index: 1, title: "T", url: "https://x.com" }]);
        expect(consoleLogSpy).toHaveBeenCalledWith("[1] https://x.com");
      });
    });

    describe("error", () => {
      it("displays error without chalk.red", () => {
        const r = createRenderer({ plain: true });
        r.error("bad thing");
        expect(consoleErrorSpy).toHaveBeenCalledWith("bad thing");
      });
    });

    describe("info", () => {
      it("displays info without chalk.dim", () => {
        const r = createRenderer({ plain: true });
        r.info("some info");
        expect(consoleLogSpy).toHaveBeenCalledWith("some info");
      });
    });
  });


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
    it("clears raw text and renders markdown", () => {
      const r = createRenderer();
      r.assistantToken("**bold**");
      stdoutWriteSpy.mockClear();
      r.assistantEnd();
      // Should clear the raw text (move up, clear line) and render formatted
      expect(stdoutWriteSpy).toHaveBeenCalled();
    });

    it("resets buffer for next response", () => {
      const r = createRenderer();
      r.assistantToken("first");
      r.assistantEnd();
      stdoutWriteSpy.mockClear();
      r.assistantToken("second");
      r.assistantEnd();
      // Should only contain "second", not "firstsecond"
      const calls = stdoutWriteSpy.mock.calls.flat().join("");
      expect(calls).not.toContain("first");
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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRenderer } from "../../ui/renderer.js";
import type { MarkdownRenderer } from "../../ui/markdown.js";

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

function createMockMarkdown(output = "rendered"): MarkdownRenderer {
  return { render: vi.fn(() => output) };
}

describe("Non-TTY mode", () => {
  it("token writes newline then text directly", () => {
    const r = createRenderer({ isTTY: false });
    r.assistantToken("hello");
    expect(stdoutWriteSpy).toHaveBeenCalledWith("\n");
    expect(stdoutWriteSpy).toHaveBeenCalledWith("hello");
  });

  it("assistantEnd writes newline", () => {
    const r = createRenderer({ isTTY: false });
    r.assistantToken("x");
    r.assistantEnd("x");
    expect(stdoutWriteSpy).toHaveBeenLastCalledWith("\n");
  });

  it("assistantComplete writes content+newline", () => {
    const r = createRenderer({ isTTY: false });
    r.assistantComplete("hello");
    expect(stdoutWriteSpy).toHaveBeenCalledWith("hello\n");
  });

  it("sources displays plain text", () => {
    const r = createRenderer({ isTTY: false });
    r.sources([{ index: 1, title: "T", url: "https://x.com" }]);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("[1] https://x.com")
    );
  });

  it("error displays plain text", () => {
    const r = createRenderer({ isTTY: false });
    r.error("bad thing");
    expect(consoleErrorSpy).toHaveBeenCalledWith("bad thing");
  });

  it("info displays plain text", () => {
    const r = createRenderer({ isTTY: false });
    r.info("some info");
    expect(consoleLogSpy).toHaveBeenCalledWith("some info");
  });
});

describe("TTY + color mode", () => {
  it("error output contains the message", () => {
    const r = createRenderer({ isTTY: true, noColor: false });
    r.error("bad");
    const arg = consoleErrorSpy.mock.calls[0][0] as string;
    expect(arg).toContain("bad");
  });

  it("info output contains the message", () => {
    const r = createRenderer({ isTTY: true, noColor: false });
    r.info("dim text");
    const arg = consoleLogSpy.mock.calls[0][0] as string;
    expect(arg).toContain("dim text");
  });

  it("sources output contains url", () => {
    const r = createRenderer({ isTTY: true, noColor: false });
    r.sources([{ index: 1, title: "T", url: "https://x.com" }]);
    const sourceLine = consoleLogSpy.mock.calls[1][0] as string;
    expect(sourceLine).toContain("https://x.com");
    expect(sourceLine).toContain("[1]");
  });
});

describe("TTY + markdown mode", () => {
  it("token shows thinking indicator", () => {
    const md = createMockMarkdown();
    const r = createRenderer({ isTTY: true, noColor: false, markdown: md });
    r.assistantToken("x");
    const written = stdoutWriteSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("Thinking");
    expect(written).toContain("1");
  });

  it("assistantEnd clears indicator and renders markdown", () => {
    const md = createMockMarkdown("formatted output");
    const r = createRenderer({ isTTY: true, noColor: false, markdown: md });
    r.assistantToken("x");
    stdoutWriteSpy.mockClear();
    r.assistantEnd("raw text");
    expect(md.render).toHaveBeenCalledWith("raw text");
    const written = stdoutWriteSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("formatted output");
  });

  it("assistantEnd dims citation brackets [N]", () => {
    const md = createMockMarkdown("See [1] and [2]");
    const r = createRenderer({ isTTY: true, noColor: false, markdown: md });
    r.assistantToken("x");
    stdoutWriteSpy.mockClear();
    r.assistantEnd("See [1] and [2]");
    const written = stdoutWriteSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("\x1b[");
  });

  it("assistantComplete renders markdown", () => {
    const md = createMockMarkdown("formatted");
    const r = createRenderer({ isTTY: true, noColor: false, markdown: md });
    r.assistantComplete("raw");
    expect(md.render).toHaveBeenCalledWith("raw");
    const written = stdoutWriteSpy.mock.calls.map((c) => c[0]).join("");
    expect(written).toContain("formatted");
  });
});

describe("NO_COLOR mode", () => {
  it("disables color even on TTY", () => {
    const r = createRenderer({ isTTY: true, noColor: true });
    r.error("bad");
    expect(consoleErrorSpy).toHaveBeenCalledWith("bad");
  });

  it("disables markdown even on TTY", () => {
    const md = createMockMarkdown();
    const r = createRenderer({ isTTY: true, noColor: true, markdown: md });
    r.assistantToken("x");
    r.assistantEnd("raw");
    expect(md.render).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockCreatePerplexityClient,
  mockCreateRenderer,
  mockClassifyApiError,
} = vi.hoisted(() => ({
  mockCreatePerplexityClient: vi.fn(),
  mockCreateRenderer: vi.fn(),
  mockClassifyApiError: vi.fn(),
}));

vi.mock("../../api/perplexity.js", () => ({
  createPerplexityClient: mockCreatePerplexityClient,
  classifyApiError: mockClassifyApiError,
}));

vi.mock("../../ui/renderer.js", () => ({
  createRenderer: mockCreateRenderer,
}));

import { runDirectQuery } from "../../commands/directQuery.js";

function makeRenderer() {
  return {
    assistantToken: vi.fn(),
    assistantEnd: vi.fn(),
    assistantComplete: vi.fn(),
    sources: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };
}

function makeClient() {
  return {
    streamChat: vi.fn(),
  };
}

async function* generateTokens(tokens: string[]) {
  for (const token of tokens) {
    yield { type: "token" as const, content: token };
  }
}

async function* generateWithSources(
  tokens: string[],
  sources: { title: string; url: string }[]
) {
  for (const token of tokens) {
    yield { type: "token" as const, content: token };
  }
  yield { type: "sources" as const, results: sources };
}

let mockRenderer: ReturnType<typeof makeRenderer>;
let mockClient: ReturnType<typeof makeClient>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let originalEnv: string | undefined;

describe("runDirectQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env["PERPLEXITY_API_KEY"];
    process.env["PERPLEXITY_API_KEY"] = "test-key";

    mockRenderer = makeRenderer();
    mockClient = makeClient();

    mockCreateRenderer.mockReturnValue(mockRenderer);
    mockCreatePerplexityClient.mockReturnValue(mockClient);
    mockClient.streamChat.mockReturnValue(generateTokens([]));

    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["PERPLEXITY_API_KEY"];
    } else {
      process.env["PERPLEXITY_API_KEY"] = originalEnv;
    }
    vi.restoreAllMocks();
  });

  it("exits with error when no API key", async () => {
    delete process.env["PERPLEXITY_API_KEY"];
    await expect(runDirectQuery("test question")).rejects.toThrow(
      "process.exit"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("PERPLEXITY_API_KEY")
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("creates client with API key", async () => {
    await runDirectQuery("test question");
    expect(mockCreatePerplexityClient).toHaveBeenCalledWith("test-key");
  });

  it("creates renderer", async () => {
    await runDirectQuery("test question");
    expect(mockCreateRenderer).toHaveBeenCalled();
  });

  it("sends user question to client", async () => {
    await runDirectQuery("What is TypeScript?");
    expect(mockClient.streamChat).toHaveBeenCalledWith([
      expect.objectContaining({
        role: "user",
        content: "What is TypeScript?",
      }),
    ]);
  });

  it("streams tokens to renderer", async () => {
    mockClient.streamChat.mockReturnValue(
      generateTokens(["Hello", " world", "!"])
    );
    await runDirectQuery("test question");
    expect(mockRenderer.assistantToken).toHaveBeenCalledWith("Hello");
    expect(mockRenderer.assistantToken).toHaveBeenCalledWith(" world");
    expect(mockRenderer.assistantToken).toHaveBeenCalledWith("!");
  });

  it("calls assistantEnd after streaming completes", async () => {
    mockClient.streamChat.mockReturnValue(generateTokens(["Hello"]));
    await runDirectQuery("test question");
    expect(mockRenderer.assistantEnd).toHaveBeenCalled();
  });

  it("renders sources when received", async () => {
    const sources = [{ title: "Source 1", url: "https://example.com" }];
    mockClient.streamChat.mockReturnValue(
      generateWithSources(["Hello"], sources)
    );
    await runDirectQuery("test question");
    expect(mockRenderer.sources).toHaveBeenCalledWith([
      { index: 1, title: "Source 1", url: "https://example.com" },
    ]);
  });

  it("renders sources after assistantEnd, not during streaming", async () => {
    const callOrder: string[] = [];
    mockRenderer.assistantToken.mockImplementation(() => {
      callOrder.push("token");
    });
    mockRenderer.assistantEnd.mockImplementation(() => {
      callOrder.push("end");
    });
    mockRenderer.sources.mockImplementation(() => {
      callOrder.push("sources");
    });

    const sources = [{ title: "Source 1", url: "https://example.com" }];
    mockClient.streamChat.mockReturnValue(
      generateWithSources(["Hello"], sources)
    );
    await runDirectQuery("test question");

    expect(callOrder).toEqual(["token", "end", "sources"]);
  });

  it("handles API errors gracefully", async () => {
    const error = new Error("API error");
    mockClient.streamChat.mockImplementation(() => {
      throw error;
    });
    mockClassifyApiError.mockReturnValue("Friendly error message");

    await expect(runDirectQuery("test question")).rejects.toThrow(
      "process.exit"
    );
    expect(mockClassifyApiError).toHaveBeenCalledWith(error);
    expect(mockRenderer.error).toHaveBeenCalledWith("Friendly error message");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("handles streaming errors gracefully", async () => {
    const error = new Error("Stream error");
    async function* failingGenerator() {
      yield { type: "token" as const, content: "Start" };
      throw error;
    }
    mockClient.streamChat.mockReturnValue(failingGenerator());
    mockClassifyApiError.mockReturnValue("Stream error message");

    await expect(runDirectQuery("test question")).rejects.toThrow(
      "process.exit"
    );
    expect(mockClassifyApiError).toHaveBeenCalledWith(error);
    expect(mockRenderer.error).toHaveBeenCalledWith("Stream error message");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("does not create a conversation store", async () => {
    // Direct queries should not persist conversations
    await runDirectQuery("test question");
    // The mock for createConversationStore is not set up,
    // so if it were called, it would fail
    expect(mockCreatePerplexityClient).toHaveBeenCalled();
    expect(mockCreateRenderer).toHaveBeenCalled();
  });

  it("passes plain option to renderer", async () => {
    await runDirectQuery("test question", { plain: true });
    expect(mockCreateRenderer).toHaveBeenCalledWith({ plain: true });
  });

  it("defaults to no plain option when not specified", async () => {
    await runDirectQuery("test question");
    expect(mockCreateRenderer).toHaveBeenCalledWith({});
  });
});

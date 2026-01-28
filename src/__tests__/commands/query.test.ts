import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StreamEvent } from "../../api/perplexity.js";

const {
  mockCreatePerplexityClient,
  mockClassifyApiError,
  mockCreateConversationStore,
  mockCreateRenderer,
} = vi.hoisted(() => ({
  mockCreatePerplexityClient: vi.fn(),
  mockClassifyApiError: vi.fn((e: unknown) => `classified: ${e}`),
  mockCreateConversationStore: vi.fn(),
  mockCreateRenderer: vi.fn(),
}));

vi.mock("../../api/perplexity.js", () => ({
  createPerplexityClient: mockCreatePerplexityClient,
  classifyApiError: mockClassifyApiError,
}));

vi.mock("../../store/conversation.js", () => ({
  createConversationStore: mockCreateConversationStore,
}));

vi.mock("../../ui/renderer.js", () => ({
  createRenderer: mockCreateRenderer,
}));

import { runQuery } from "../../commands/query.js";

function makeStore() {
  return {
    ensureDirectory: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({
      id: "conv-1",
      title: "Test",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      messages: [],
    }),
    load: vi.fn().mockResolvedValue({
      id: "existing-conv",
      title: "Existing",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      messages: [{ id: "1", role: "user", content: "prev", createdAt: "2024-01-01" }],
    }),
    save: vi.fn().mockResolvedValue(undefined),
    addMessage: vi.fn().mockReturnValue({
      id: "msg-1",
      role: "user",
      content: "",
      createdAt: "2024-01-01",
    }),
    listSummaries: vi.fn().mockResolvedValue([]),
    hasConversations: vi.fn().mockResolvedValue(false),
    getLastUpdated: vi.fn().mockResolvedValue(null),
  };
}

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

function makeClient(events: StreamEvent[]) {
  return {
    async *streamChat() {
      for (const e of events) yield e;
    },
  };
}

let mockStore: ReturnType<typeof makeStore>;
let mockRendererObj: ReturnType<typeof makeRenderer>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let originalEnv: string | undefined;

describe("runQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env["PERPLEXITY_API_KEY"];
    process.env["PERPLEXITY_API_KEY"] = "test-key";

    mockStore = makeStore();
    mockRendererObj = makeRenderer();

    mockCreateConversationStore.mockReturnValue(mockStore);
    mockCreateRenderer.mockReturnValue(mockRendererObj);
    mockCreatePerplexityClient.mockReturnValue(
      makeClient([{ type: "token", content: "response" }])
    );

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
    await expect(runQuery("test")).rejects.toThrow("process.exit");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("PERPLEXITY_API_KEY")
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("creates new conversation for fresh query", async () => {
    await runQuery("What is TypeScript?");
    expect(mockStore.create).toHaveBeenCalledWith("What is TypeScript?");
  });

  it("loads existing conversation for follow-up", async () => {
    await runQuery("Follow up question", "existing-conv");
    expect(mockStore.load).toHaveBeenCalledWith("existing-conv");
    expect(mockStore.create).not.toHaveBeenCalled();
  });

  it("adds user message and streams tokens", async () => {
    mockCreatePerplexityClient.mockReturnValue(
      makeClient([
        { type: "token", content: "Hello" },
        { type: "token", content: " world" },
      ])
    );
    await runQuery("hi");
    expect(mockStore.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "conv-1" }),
      "user",
      "hi"
    );
    expect(mockRendererObj.assistantToken).toHaveBeenCalledWith("Hello");
    expect(mockRendererObj.assistantToken).toHaveBeenCalledWith(" world");
  });

  it("calls assistantEnd after streaming", async () => {
    await runQuery("hi");
    expect(mockRendererObj.assistantEnd).toHaveBeenCalled();
  });

  it("saves conversation with assistant response", async () => {
    await runQuery("hi");
    expect(mockStore.addMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "conv-1" }),
      "assistant",
      "response"
    );
    expect(mockStore.save).toHaveBeenCalled();
  });

  it("displays only cited sources", async () => {
    mockCreatePerplexityClient.mockReturnValue(
      makeClient([
        { type: "token", content: "See [1] for info" },
        {
          type: "sources",
          results: [
            { title: "S1", url: "https://s1.com" },
            { title: "S2", url: "https://s2.com" },
          ],
        },
      ])
    );
    await runQuery("hi");
    expect(mockRendererObj.sources).toHaveBeenCalledWith([
      { title: "S1", url: "https://s1.com", index: 1 },
    ]);
  });

  it("displays follow-up command", async () => {
    await runQuery("hi");
    expect(mockRendererObj.info).toHaveBeenCalledWith(
      expect.stringContaining("--follow-up conv-1")
    );
  });

  it("handles streaming error with classifyApiError and exit(1)", async () => {
    const error = new Error("stream failed");
    mockCreatePerplexityClient.mockReturnValue({
      async *streamChat() {
        throw error;
      },
    });
    await expect(runQuery("hi")).rejects.toThrow("process.exit");
    expect(mockClassifyApiError).toHaveBeenCalledWith(error);
    expect(mockRendererObj.error).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

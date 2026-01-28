import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  mockCreatePerplexityClient,
  mockCreateConversationStore,
  mockCreateRenderer,
  mockStartSession,
} = vi.hoisted(() => ({
  mockCreatePerplexityClient: vi.fn(),
  mockCreateConversationStore: vi.fn(),
  mockCreateRenderer: vi.fn(),
  mockStartSession: vi.fn(),
}));

vi.mock("../../api/perplexity.js", () => ({
  createPerplexityClient: mockCreatePerplexityClient,
}));

vi.mock("../../store/conversation.js", () => ({
  createConversationStore: mockCreateConversationStore,
}));

vi.mock("../../ui/renderer.js", () => ({
  createRenderer: mockCreateRenderer,
}));

vi.mock("../../repl/session.js", () => ({
  startSession: mockStartSession,
}));

import { runChat } from "../../commands/chat.js";

function makeStore() {
  return {
    ensureDirectory: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    addMessage: vi.fn(),
    listSummaries: vi.fn(),
    hasConversations: vi.fn(),
    getLastUpdated: vi.fn(),
  };
}

let mockStore: ReturnType<typeof makeStore>;
let mockRendererObj: { assistantToken: ReturnType<typeof vi.fn> };
let mockClient: { streamChat: ReturnType<typeof vi.fn> };
let exitSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let originalEnv: string | undefined;

describe("runChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalEnv = process.env["PERPLEXITY_API_KEY"];
    process.env["PERPLEXITY_API_KEY"] = "test-key";

    mockStore = makeStore();
    mockRendererObj = { assistantToken: vi.fn() };
    mockClient = { streamChat: vi.fn() };

    mockCreateConversationStore.mockReturnValue(mockStore);
    mockCreateRenderer.mockReturnValue(mockRendererObj);
    mockCreatePerplexityClient.mockReturnValue(mockClient);
    mockStartSession.mockResolvedValue(undefined);

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
    await expect(runChat()).rejects.toThrow("process.exit");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("PERPLEXITY_API_KEY")
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("creates client with API key", async () => {
    await runChat();
    expect(mockCreatePerplexityClient).toHaveBeenCalledWith("test-key");
  });

  it("creates store and ensures directory", async () => {
    await runChat();
    expect(mockCreateConversationStore).toHaveBeenCalled();
    expect(mockStore.ensureDirectory).toHaveBeenCalled();
  });

  it("creates renderer", async () => {
    await runChat();
    expect(mockCreateRenderer).toHaveBeenCalled();
  });

  it("starts session with correct deps", async () => {
    await runChat();
    expect(mockStartSession).toHaveBeenCalledWith({
      client: mockClient,
      store: mockStore,
      renderer: mockRendererObj,
      conversation: null,
    });
  });
});

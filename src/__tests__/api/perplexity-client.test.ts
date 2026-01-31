import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectEvents } from "../helpers.js";
import type { Message } from "../../types.js";

const mockCreate = vi.fn();

vi.mock("@perplexity-ai/perplexity_ai", () => ({
  default: vi.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import Perplexity from "@perplexity-ai/perplexity_ai";
import { createPerplexityClient, isValidModel, VALID_MODELS } from "../../api/perplexity.js";

function makeChunk(content: string | null, searchResults?: { title: string; url: string }[]) {
  return {
    choices: [{ delta: { content } }],
    ...(searchResults ? { search_results: searchResults } : {}),
  };
}

async function* asyncIterableFrom<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

describe("isValidModel", () => {
  it("returns true for valid models", () => {
    expect(isValidModel("sonar")).toBe(true);
    expect(isValidModel("sonar-pro")).toBe(true);
    expect(isValidModel("sonar-reasoning-pro")).toBe(true);
    expect(isValidModel("sonar-deep-research")).toBe(true);
  });

  it("returns false for invalid models", () => {
    expect(isValidModel("invalid-model")).toBe(false);
    expect(isValidModel("")).toBe(false);
    expect(isValidModel("sonar-small")).toBe(false);
  });
});

describe("VALID_MODELS", () => {
  it("contains expected models", () => {
    expect(VALID_MODELS).toContain("sonar");
    expect(VALID_MODELS).toContain("sonar-pro");
    expect(VALID_MODELS).toContain("sonar-reasoning-pro");
    expect(VALID_MODELS).toContain("sonar-deep-research");
    expect(VALID_MODELS).toHaveLength(4);
  });
});

describe("createPerplexityClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates Perplexity SDK client with API key", () => {
    createPerplexityClient("test-key");
    expect(Perplexity).toHaveBeenCalledWith({ apiKey: "test-key" });
  });

  describe("streamChat", () => {
    it("yields token events for chunks with content", async () => {
      mockCreate.mockResolvedValue(asyncIterableFrom([makeChunk("Hello")]));
      const client = createPerplexityClient("key");
      const events = await collectEvents(client.streamChat([]));
      expect(events).toEqual([{ type: "token", content: "Hello" }]);
    });

    it("yields multiple tokens in order", async () => {
      mockCreate.mockResolvedValue(
        asyncIterableFrom([makeChunk("Hello"), makeChunk(" "), makeChunk("world")])
      );
      const client = createPerplexityClient("key");
      const events = await collectEvents(client.streamChat([]));
      expect(events).toEqual([
        { type: "token", content: "Hello" },
        { type: "token", content: " " },
        { type: "token", content: "world" },
      ]);
    });

    it("skips chunks with null content", async () => {
      mockCreate.mockResolvedValue(
        asyncIterableFrom([makeChunk(null), makeChunk("text"), makeChunk(null)])
      );
      const client = createPerplexityClient("key");
      const events = await collectEvents(client.streamChat([]));
      expect(events).toEqual([{ type: "token", content: "text" }]);
    });

    it("yields sources event when search_results present", async () => {
      const sources = [
        { title: "Source 1", url: "https://example.com/1" },
        { title: "Source 2", url: "https://example.com/2" },
      ];
      mockCreate.mockResolvedValue(
        asyncIterableFrom([makeChunk("text", sources)])
      );
      const client = createPerplexityClient("key");
      const events = await collectEvents(client.streamChat([]));
      expect(events).toEqual([
        { type: "token", content: "text" },
        { type: "sources", results: sources },
      ]);
    });

    it("yields sources only once even if multiple chunks have them", async () => {
      const sources = [{ title: "S1", url: "https://s1.com" }];
      mockCreate.mockResolvedValue(
        asyncIterableFrom([makeChunk("a", sources), makeChunk("b", sources)])
      );
      const client = createPerplexityClient("key");
      const events = await collectEvents(client.streamChat([]));
      const sourceEvents = events.filter((e) => e.type === "sources");
      expect(sourceEvents).toHaveLength(1);
    });

    it("passes messages to SDK in correct format", async () => {
      mockCreate.mockResolvedValue(asyncIterableFrom([]));
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello", createdAt: "2024-01-01" },
        { id: "2", role: "assistant", content: "Hi", createdAt: "2024-01-02" },
      ];
      const client = createPerplexityClient("key");
      await collectEvents(client.streamChat(messages));
      expect(mockCreate).toHaveBeenCalledWith({
        model: "sonar-pro",
        stream: true,
        messages: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" },
        ],
      });
    });

    it("uses default model (sonar-pro) when not specified", async () => {
      mockCreate.mockResolvedValue(asyncIterableFrom([]));
      const client = createPerplexityClient("key");
      await collectEvents(client.streamChat([]));
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "sonar-pro" })
      );
    });

    it("uses specified model when provided", async () => {
      mockCreate.mockResolvedValue(asyncIterableFrom([]));
      const client = createPerplexityClient("key", "sonar-reasoning-pro");
      await collectEvents(client.streamChat([]));
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "sonar-reasoning-pro" })
      );
    });

    it("maps only role+content, strips id and createdAt", async () => {
      mockCreate.mockResolvedValue(asyncIterableFrom([]));
      const messages: Message[] = [
        { id: "abc", role: "user", content: "test", createdAt: "2024-01-01T00:00:00Z" },
      ];
      const client = createPerplexityClient("key");
      await collectEvents(client.streamChat(messages));
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0]).toEqual({ role: "user", content: "test" });
      expect(callArgs.messages[0]).not.toHaveProperty("id");
      expect(callArgs.messages[0]).not.toHaveProperty("createdAt");
    });

    it("passes abort signal to SDK when provided", async () => {
      mockCreate.mockResolvedValue(asyncIterableFrom([]));
      const controller = new AbortController();
      const client = createPerplexityClient("key");
      await collectEvents(client.streamChat([], { signal: controller.signal }));
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal })
      );
    });

    it("does not pass signal when not provided", async () => {
      mockCreate.mockResolvedValue(asyncIterableFrom([]));
      const client = createPerplexityClient("key");
      await collectEvents(client.streamChat([]));
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("signal");
    });
  });
});

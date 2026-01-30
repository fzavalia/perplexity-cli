import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockStore, createMockRenderer } from "../helpers.js";
import type { Conversation } from "../../types.js";
import type { PerplexityClient, StreamEvent } from "../../api/perplexity.js";

vi.mock("../../api/perplexity.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../api/perplexity.js")>();
  return { ...original, classifyApiError: vi.fn((e: unknown) => `classified: ${e}`) };
});

vi.mock("clipboardy", () => ({
  default: {
    writeSync: vi.fn(),
  },
}));

const mockRl = {
  prompt: vi.fn(),
  close: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
};

const mockStdin = {
  on: vi.fn(),
  setRawMode: vi.fn(),
  isRaw: false,
};

const mockStdout = {
  write: vi.fn(),
};

vi.mock("node:readline", () => ({
  createInterface: vi.fn(() => mockRl),
  emitKeypressEvents: vi.fn(),
}));

type KeypressHandler = (str: string | undefined, key: { name: string }) => void;

function getKeypressHandler(): KeypressHandler {
  const call = mockStdin.on.mock.calls.find((c: unknown[]) => c[0] === "keypress");
  if (!call) throw new Error("No keypress handler registered");
  return call[1] as KeypressHandler;
}

function simulatePasteStart(): void {
  const handler = getKeypressHandler();
  handler(undefined, { name: "paste-start" });
}

function simulatePasteEnd(): void {
  const handler = getKeypressHandler();
  handler(undefined, { name: "paste-end" });
}

import { classifyApiError } from "../../api/perplexity.js";
import { startSession } from "../../repl/session.js";
import clipboard from "clipboardy";

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-123",
    title: "Test",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    messages: [],
    ...overrides,
  };
}

function createMockClient(events: StreamEvent[] = []): PerplexityClient {
  return {
    async *streamChat() {
      for (const e of events) yield e;
    },
  };
}

type LineHandler = (line: string) => void;
type CloseHandler = () => void;

function getHandler(event: string): LineHandler | CloseHandler {
  const call = mockRl.on.mock.calls.find((c: unknown[]) => c[0] === event);
  if (!call) throw new Error(`No handler for "${event}"`);
  return call[1] as LineHandler | CloseHandler;
}

function store() {
  return createMockStore();
}

function renderer() {
  return createMockRenderer();
}

describe("startSession", () => {
  const originalStdin = process.stdin;
  const originalStdout = process.stdout;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Mock process.stdin and process.stdout for bracketed paste mode
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true });
    Object.defineProperty(process, "stdout", { value: mockStdout, writable: true });
    // Re-wire mockRl.close to emit close event
    mockRl.close.mockImplementation(() => {
      const closeHandler = getHandler("close") as CloseHandler;
      closeHandler();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(process, "stdin", { value: originalStdin, writable: true });
    Object.defineProperty(process, "stdout", { value: originalStdout, writable: true });
  });

  describe("Init", () => {
    it("shows intro message on start", () => {
      const s = store();
      const r = renderer();
      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      expect(r.info).toHaveBeenCalledWith(expect.stringContaining("Perplexity CLI"));
      expect(r.info).toHaveBeenCalledWith(expect.stringContaining("/help"));
    });

    it("prompts on start", () => {
      const s = store();
      const r = renderer();
      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      expect(mockRl.prompt).toHaveBeenCalled();
    });

    it("replays messages when resuming with existing conversation", () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation({
        messages: [
          { id: "1", role: "user", content: "hello", createdAt: "2024-01-01T00:00:00Z", sources: [] },
          { id: "2", role: "assistant", content: "hi there", createdAt: "2024-01-01T00:00:01Z", sources: [] },
        ],
      });
      startSession({ client: createMockClient(), store: s, renderer: r, conversation: conv });
      expect(r.assistantComplete).toHaveBeenCalledWith("hi there");
    });
  });

  describe("Messages", () => {
    it("creates conversation on first message (deferred)", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "reply" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("hello");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.create).toHaveBeenCalledWith("hello");
    });

    it("adds user message and saves", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "reply" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("hello");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.addMessage).toHaveBeenCalledWith(conv, "user", "hello");
      expect(s.save).toHaveBeenCalled();
    });

    it("streams tokens to renderer", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([
        { type: "token", content: "Hello" },
        { type: "token", content: " world" },
      ]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("hi");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.assistantToken).toHaveBeenCalledWith("Hello");
      expect(r.assistantToken).toHaveBeenCalledWith(" world");
    });

    it("calls assistantEnd after streaming", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "reply" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("hi");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.assistantEnd).toHaveBeenCalled();
    });

    it("filters and displays only cited sources", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([
        { type: "token", content: "See [1] for info" },
        {
          type: "sources",
          results: [
            { title: "S1", url: "https://s1.com" },
            { title: "S2", url: "https://s2.com" },
          ],
        },
      ]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("hi");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.sources).toHaveBeenCalledWith([
        { title: "S1", url: "https://s1.com", index: 1 },
      ]);
    });

    it("adds assistant message and saves again", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "reply" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("hi");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.addMessage).toHaveBeenCalledWith(conv, "assistant", "reply", []);
      expect(s.save).toHaveBeenCalledTimes(2);
    });

    it("pauses and resumes readline", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "reply" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("hi");
      await vi.advanceTimersByTimeAsync(0);

      expect(mockRl.pause).toHaveBeenCalled();
      expect(mockRl.resume).toHaveBeenCalled();
    });
  });

  describe("Errors", () => {
    it("displays classified error and resumes readline", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const error = new Error("network failure");
      const client: PerplexityClient = {
        async *streamChat() {
          throw error;
        },
      };

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("hi");
      await vi.advanceTimersByTimeAsync(0);

      expect(classifyApiError).toHaveBeenCalledWith(error);
      expect(r.error).toHaveBeenCalled();
      expect(mockRl.resume).toHaveBeenCalled();
    });
  });

  describe("Multi-line paste (bracketed paste mode)", () => {
    it("enables bracketed paste mode on start", () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });

      expect(mockStdout.write).toHaveBeenCalledWith("\x1b[?2004h");
    });

    it("disables bracketed paste mode on close", async () => {
      const s = store();
      const r = renderer();

      const promise = startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/exit");
      await vi.advanceTimersByTimeAsync(0);

      await promise;
      expect(mockStdout.write).toHaveBeenCalledWith("\x1b[?2004l");
    });

    it("buffers lines during paste, submits on Enter after paste ends", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "ok" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;

      // Simulate paste start
      simulatePasteStart();

      // Lines during paste (pasted newlines)
      lineHandler("line1");
      lineHandler("line2");
      lineHandler("line3");

      // Nothing should be sent yet
      expect(s.addMessage).not.toHaveBeenCalled();

      // Simulate paste end
      simulatePasteEnd();

      // Still nothing sent (waiting for user to press Enter)
      expect(s.addMessage).not.toHaveBeenCalled();

      // User presses Enter (final line event after paste ends)
      lineHandler("");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.addMessage).toHaveBeenCalledWith(conv, "user", "line1\nline2\nline3");
    });

    it("submits immediately when user types and presses Enter (no paste)", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "ok" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;

      // User types and presses Enter (no paste events)
      lineHandler("hello");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.addMessage).toHaveBeenCalledWith(conv, "user", "hello");
    });

    it("allows continuing to type after paste before submitting", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "ok" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;

      // Simulate paste
      simulatePasteStart();
      lineHandler("pasted line 1");
      lineHandler("pasted line 2");
      simulatePasteEnd();

      // Nothing sent yet
      expect(s.addMessage).not.toHaveBeenCalled();

      // User continues typing and presses Enter
      lineHandler("typed line");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.addMessage).toHaveBeenCalledWith(
        conv,
        "user",
        "pasted line 1\npasted line 2\ntyped line"
      );
    });

    it("single-line / is slash command", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/help");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.info).toHaveBeenCalledWith(expect.stringContaining("Available commands"));
    });

    it("multi-line starting with / is regular message", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "ok" }]);

      startSession({ client, store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;

      // Paste multi-line content starting with /
      simulatePasteStart();
      lineHandler("/not a command");
      lineHandler("second line");
      simulatePasteEnd();

      // User presses Enter
      lineHandler("");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.addMessage).toHaveBeenCalledWith(conv, "user", "/not a command\nsecond line");
    });
  });

  describe("Slash commands", () => {
    it("/help shows help text", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/help");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.info).toHaveBeenCalledWith(expect.stringContaining("/help"));
      expect(r.info).toHaveBeenCalledWith(expect.stringContaining("/exit"));
    });

    it("/list shows empty message when no conversations", async () => {
      const s = store();
      const r = renderer();
      s.listSummaries.mockResolvedValue([]);

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/list");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.info).toHaveBeenCalledWith("No conversations yet.");
    });

    it("/list shows table when conversations exist", async () => {
      const s = store();
      const r = renderer();
      s.listSummaries.mockResolvedValue([
        { id: "abc123", title: "Test Conv", createdAt: "2024-01-01", updatedAt: "2024-01-02" },
      ]);

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/list");
      await vi.advanceTimersByTimeAsync(0);

      const infoCall = r.info.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes("abc123")
      );
      expect(infoCall).toBeTruthy();
    });

    it("/list shows max 20 entries", async () => {
      const s = store();
      const r = renderer();
      const many = Array.from({ length: 25 }, (_, i) => ({
        id: `id-${i}`,
        title: `Conv ${i}`,
        createdAt: "2024-01-01",
        updatedAt: "2024-01-01",
      }));
      s.listSummaries.mockResolvedValue(many);

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/list");
      await vi.advanceTimersByTimeAsync(0);

      const infoCall = r.info.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes("id-0")
      );
      expect(infoCall).toBeTruthy();
      // id-20 through id-24 should not appear
      const allInfoText = r.info.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(allInfoText).not.toContain("id-20");
    });

    it("/resume loads and replays conversation", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation({
        messages: [
          { id: "1", role: "user", content: "q", createdAt: "2024-01-01T00:00:00Z", sources: [] },
          { id: "2", role: "assistant", content: "a", createdAt: "2024-01-01T00:00:01Z", sources: [] },
        ],
      });
      s.load.mockResolvedValue(conv);

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/resume conv-123");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.load).toHaveBeenCalledWith("conv-123");
      expect(r.assistantComplete).toHaveBeenCalledWith("a");
    });

    it("/resume shows error for missing id", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/resume");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.error).toHaveBeenCalledWith("Usage: /resume <id>");
    });

    it("/resume shows error for not found", async () => {
      const s = store();
      const r = renderer();
      s.load.mockRejectedValue(new Error("not found"));

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/resume bad-id");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.error).toHaveBeenCalledWith("Conversation not found: bad-id");
    });

    it("/clear resets conversation to null", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: conv });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/clear");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.info).toHaveBeenCalledWith("Started new conversation.");
    });

    it("/exit closes readline", async () => {
      const s = store();
      const r = renderer();

      const promise = startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/exit");
      await vi.advanceTimersByTimeAsync(0);

      await promise;
      expect(r.info).toHaveBeenCalledWith("Goodbye!");
    });

    it("unknown command shows error", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/unknown");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.error).toHaveBeenCalledWith("Unknown command: /unknown");
    });

    it("/delete calls store.delete with id", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/delete abc123");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.delete).toHaveBeenCalledWith("abc123");
      expect(r.info).toHaveBeenCalledWith("Conversation deleted.");
    });

    it("/delete without id shows usage error", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/delete");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.delete).not.toHaveBeenCalled();
      expect(r.error).toHaveBeenCalledWith("Usage: /delete <id>");
    });

    it("/delete current conversation clears state", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation({ id: "current-conv" });
      s.create.mockResolvedValue(conv);
      const client = createMockClient([{ type: "token", content: "ok" }]);

      startSession({ client, store: s, renderer: r, conversation: conv });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/delete current-conv");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.info).toHaveBeenCalledWith("Conversation deleted.");

      // Sending a new message should create a new conversation
      s.create.mockClear();
      lineHandler("hello");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.create).toHaveBeenCalledWith("hello");
    });

    it("/delete shows error on failure", async () => {
      const s = store();
      const r = renderer();
      s.delete.mockRejectedValue(new Error("Conversation not found: bad-id"));

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/delete bad-id");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.error).toHaveBeenCalledWith("Error: Conversation not found: bad-id");
    });

    it("/help shows delete command", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/help");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.info).toHaveBeenCalledWith(expect.stringContaining("/delete"));
    });

    it("/copy copies last assistant response to clipboard", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation({
        messages: [
          { id: "1", role: "user", content: "hello", createdAt: "2024-01-01T00:00:00Z", sources: [] },
          { id: "2", role: "assistant", content: "hi there", createdAt: "2024-01-01T00:00:01Z", sources: [] },
        ],
      });

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: conv });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/copy");
      await vi.advanceTimersByTimeAsync(0);

      expect(clipboard.writeSync).toHaveBeenCalledWith("hi there");
      expect(r.info).toHaveBeenCalledWith("Response copied to clipboard.");
    });

    it("/copy shows error when no conversation exists", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/copy");
      await vi.advanceTimersByTimeAsync(0);

      expect(clipboard.writeSync).not.toHaveBeenCalled();
      expect(r.error).toHaveBeenCalledWith("No conversation yet.");
    });

    it("/copy shows error when no assistant response exists", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation({
        messages: [
          { id: "1", role: "user", content: "hello", createdAt: "2024-01-01T00:00:00Z", sources: [] },
        ],
      });

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: conv });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/copy");
      await vi.advanceTimersByTimeAsync(0);

      expect(clipboard.writeSync).not.toHaveBeenCalled();
      expect(r.error).toHaveBeenCalledWith("No assistant response to copy.");
    });

    it("/copy copies most recent assistant response when multiple exist", async () => {
      const s = store();
      const r = renderer();
      const conv = makeConversation({
        messages: [
          { id: "1", role: "user", content: "first question", createdAt: "2024-01-01T00:00:00Z", sources: [] },
          { id: "2", role: "assistant", content: "first answer", createdAt: "2024-01-01T00:00:01Z", sources: [] },
          { id: "3", role: "user", content: "second question", createdAt: "2024-01-01T00:00:02Z", sources: [] },
          { id: "4", role: "assistant", content: "second answer", createdAt: "2024-01-01T00:00:03Z", sources: [] },
        ],
      });

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: conv });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/copy");
      await vi.advanceTimersByTimeAsync(0);

      expect(clipboard.writeSync).toHaveBeenCalledWith("second answer");
    });

    it("/help shows copy command", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/help");
      await vi.advanceTimersByTimeAsync(0);

      expect(r.info).toHaveBeenCalledWith(expect.stringContaining("/copy"));
    });
  });

  describe("Close", () => {
    it("resolves promise on close", async () => {
      const s = store();
      const r = renderer();

      const promise = startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/exit");
      await vi.advanceTimersByTimeAsync(0);

      await expect(promise).resolves.toBeUndefined();
    });

    it("says 'Goodbye!' on /exit", async () => {
      const s = store();
      const r = renderer();

      const promise = startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      lineHandler("/exit");
      await vi.advanceTimersByTimeAsync(0);

      await promise;
      expect(r.info).toHaveBeenCalledWith("Goodbye!");
    });

    it("says newline+Goodbye on Ctrl+D (direct close)", async () => {
      const s = store();
      const r = renderer();

      mockRl.close.mockImplementationOnce(() => {});
      const promise = startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });

      // Simulate Ctrl+D: close event fires without /exit
      const closeHandler = getHandler("close") as CloseHandler;
      closeHandler();

      await promise;
      expect(r.info).toHaveBeenCalledWith("\n\nGoodbye!");
    });
  });

  describe("Empty input", () => {
    it("re-prompts without sending", async () => {
      const s = store();
      const r = renderer();

      startSession({ client: createMockClient(), store: s, renderer: r, conversation: null });
      const lineHandler = getHandler("line") as LineHandler;
      mockRl.prompt.mockClear();
      lineHandler("");
      await vi.advanceTimersByTimeAsync(0);

      expect(s.create).not.toHaveBeenCalled();
      expect(mockRl.prompt).toHaveBeenCalled();
    });
  });
});

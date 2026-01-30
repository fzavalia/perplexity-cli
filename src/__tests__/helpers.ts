import { vi } from "vitest";
import { EventEmitter } from "node:events";
import type { StreamEvent } from "../api/perplexity.js";
import type { ConversationStore } from "../store/conversation.js";
import type { Renderer } from "../ui/renderer.js";

export async function collectEvents(
  gen: AsyncGenerator<StreamEvent, void, undefined>
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for await (const event of gen) {
    events.push(event);
  }
  return events;
}

export function createMockReadline(): EventEmitter & {
  prompt: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
} {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    prompt: vi.fn(),
    close: vi.fn(() => emitter.emit("close")),
    pause: vi.fn(),
    resume: vi.fn(),
  });
}

export function createMockStore(): {
  [K in keyof ConversationStore]: ReturnType<typeof vi.fn>;
} {
  return {
    ensureDirectory: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    addMessage: vi.fn().mockReturnValue({
      id: "msg-1",
      role: "user",
      content: "",
      createdAt: new Date().toISOString(),
      sources: [],
    }),
    listSummaries: vi.fn().mockResolvedValue([]),
    hasConversations: vi.fn().mockResolvedValue(false),
    getLastUpdated: vi.fn().mockResolvedValue(null),
  };
}

export function createMockRenderer(): {
  [K in keyof Renderer]: ReturnType<typeof vi.fn>;
} {
  return {
    assistantToken: vi.fn(),
    assistantEnd: vi.fn(),
    assistantComplete: vi.fn(),
    sources: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };
}

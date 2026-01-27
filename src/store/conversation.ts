import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { nanoid } from "nanoid";
import type { Conversation, ConversationSummary, Message } from "../types.js";

const DEFAULT_BASE_PATH = join(homedir(), ".perplexity-cli", "conversations");
const INDEX_FILE = "index.json";
const TITLE_MAX_LENGTH = 60;

export type ConversationStore = {
  ensureDirectory(): Promise<void>;
  create(firstMessage: string): Promise<Conversation>;
  load(id: string): Promise<Conversation>;
  save(conversation: Conversation): Promise<void>;
  addMessage(
    conversation: Conversation,
    role: "user" | "assistant",
    content: string
  ): Message;
  listSummaries(): Promise<ConversationSummary[]>;
  hasConversations(): Promise<boolean>;
  getLastUpdated(): Promise<ConversationSummary | null>;
};

export function createConversationStore(
  basePath: string = DEFAULT_BASE_PATH
): ConversationStore {
  function indexPath(): string {
    return join(basePath, INDEX_FILE);
  }

  function conversationPath(id: string): string {
    return join(basePath, `${id}.json`);
  }

  async function readIndex(): Promise<ConversationSummary[]> {
    try {
      const data = await readFile(indexPath(), "utf-8");
      return JSON.parse(data) as ConversationSummary[];
    } catch {
      return [];
    }
  }

  async function writeIndex(summaries: ConversationSummary[]): Promise<void> {
    const sorted = summaries.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    await writeFile(indexPath(), JSON.stringify(sorted, null, 2));
  }

  async function updateIndex(conversation: Conversation): Promise<void> {
    const summaries = await readIndex();
    const existing = summaries.findIndex((s) => s.id === conversation.id);
    const summary: ConversationSummary = {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };

    if (existing >= 0) {
      summaries[existing] = summary;
    } else {
      summaries.push(summary);
    }

    await writeIndex(summaries);
  }

  function truncateTitle(text: string): string {
    if (text.length <= TITLE_MAX_LENGTH) return text;
    return text.slice(0, TITLE_MAX_LENGTH - 1) + "…";
  }

  return {
    async ensureDirectory() {
      await mkdir(basePath, { recursive: true });
      try {
        await readFile(indexPath(), "utf-8");
      } catch {
        await writeFile(indexPath(), "[]");
      }
    },

    async create(firstMessage: string) {
      const now = new Date().toISOString();
      const conversation: Conversation = {
        id: nanoid(10),
        title: truncateTitle(firstMessage),
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      await writeFile(
        conversationPath(conversation.id),
        JSON.stringify(conversation, null, 2)
      );
      await updateIndex(conversation);
      return conversation;
    },

    async load(id: string) {
      const data = await readFile(conversationPath(id), "utf-8");
      return JSON.parse(data) as Conversation;
    },

    async save(conversation: Conversation) {
      conversation.updatedAt = new Date().toISOString();
      await writeFile(
        conversationPath(conversation.id),
        JSON.stringify(conversation, null, 2)
      );
      await updateIndex(conversation);
    },

    addMessage(conversation, role, content) {
      const message: Message = {
        id: nanoid(10),
        role,
        content,
        createdAt: new Date().toISOString(),
      };
      conversation.messages.push(message);
      return message;
    },

    async listSummaries() {
      return readIndex();
    },

    async hasConversations() {
      const summaries = await readIndex();
      return summaries.length > 0;
    },

    async getLastUpdated() {
      const summaries = await readIndex();
      return summaries.length > 0 ? summaries[0] : null;
    },
  };
}

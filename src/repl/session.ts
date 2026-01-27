import { createInterface, type Interface } from "node:readline";
import type { Conversation } from "../types.js";
import type { Renderer } from "../ui/renderer.js";
import type { PerplexityClient } from "../api/perplexity.js";
import type { ConversationStore } from "../store/conversation.js";
import { classifyApiError } from "../api/perplexity.js";

const PASTE_DEBOUNCE_MS = 10;
const PROMPT = "> ";

type SessionDeps = {
  client: PerplexityClient;
  store: ConversationStore;
  renderer: Renderer;
  conversation: Conversation | null;
};

const HELP_TEXT = `Available commands:
  /help   Show this help message
  /retry  Resend the last user message
  /exit   Exit the session`;

export async function startSession(deps: SessionDeps): Promise<void> {
  const { client, store, renderer } = deps;
  let conversation = deps.conversation;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: PROMPT,
  });

  async function ensureConversation(firstMessage: string): Promise<Conversation> {
    if (conversation) return conversation;
    conversation = await store.create(firstMessage);
    return conversation;
  }

  async function sendMessage(content: string): Promise<void> {
    const conv = await ensureConversation(content);

    store.addMessage(conv, "user", content);
    await store.save(conv);

    try {
      rl.pause();
      let fullResponse = "";
      let sources: import("../api/perplexity.js").SearchResult[] = [];

      for await (const event of client.streamChat(conv.messages)) {
        if (event.type === "token") {
          renderer.assistantToken(event.content);
          fullResponse += event.content;
        } else if (event.type === "sources") {
          sources = event.results;
        }
      }

      renderer.assistantEnd();
      if (sources.length > 0) {
        renderer.sources(sources);
      }
      store.addMessage(conv, "assistant", fullResponse);
      await store.save(conv);
    } catch (error) {
      renderer.assistantEnd();
      renderer.error(classifyApiError(error));
    } finally {
      rl.resume();
      process.stdout.write("\n");
      rl.prompt();
    }
  }

  function handleSlashCommand(command: string): boolean {
    switch (command.trim()) {
      case "/exit":
        rl.close();
        return true;
      case "/help":
        renderer.info(HELP_TEXT);
        rl.prompt();
        return true;
      case "/retry":
        handleRetry();
        return true;
      default:
        renderer.error(`Unknown command: ${command.trim()}`);
        rl.prompt();
        return true;
    }
  }

  function handleRetry(): void {
    if (!conversation || conversation.messages.length === 0) {
      renderer.error("No message to retry.");
      rl.prompt();
      return;
    }

    const lastUserMessage = [...conversation.messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      renderer.error("No user message to retry.");
      rl.prompt();
      return;
    }

    // Remove messages from the last user message onward
    const lastUserIndex = conversation.messages.lastIndexOf(lastUserMessage);
    conversation.messages = conversation.messages.slice(0, lastUserIndex);

    sendMessage(lastUserMessage.content);
  }

  // Multi-line paste handling via debounce
  let lineBuffer: string[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function flushLineBuffer(): void {
    const content = lineBuffer.join("\n").trim();
    lineBuffer = [];
    debounceTimer = null;

    if (!content) {
      rl.prompt();
      return;
    }

    if (content.startsWith("/")) {
      handleSlashCommand(content);
      return;
    }

    sendMessage(content);
  }

  rl.on("line", (line: string) => {
    lineBuffer.push(line);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(flushLineBuffer, PASTE_DEBOUNCE_MS);
  });

  rl.on("close", () => {
    renderer.info("\nGoodbye!");
  });

  // Replay existing messages if resuming
  if (conversation && conversation.messages.length > 0) {
    for (const msg of conversation.messages) {
      if (msg.role === "user") {
        renderer.userMessage(msg.content);
      } else {
        renderer.assistantToken(msg.content);
        renderer.assistantEnd();
      }
    }
  }

  rl.prompt();
}

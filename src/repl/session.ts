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

const LIST_MAX_ITEMS = 20;

const HELP_TEXT = `Available commands:
  /help         Show this help message
  /list         List saved conversations
  /resume <id>  Resume a saved conversation`;

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
      const citedSources = sources
        .map((s, i) => ({ ...s, index: i + 1 }))
        .filter((s) => fullResponse.includes(`[${s.index}]`));
      if (citedSources.length > 0) {
        renderer.sources(citedSources);
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

  function handleSlashCommand(input: string): boolean {
    const trimmed = input.trim();
    const [command, ...args] = trimmed.split(/\s+/);

    switch (command) {
      case "/help":
        renderer.info(HELP_TEXT);
        rl.prompt();
        return true;
      case "/list":
        handleList();
        return true;
      case "/resume":
        handleResume(args[0]);
        return true;
      default:
        renderer.error(`Unknown command: ${command}`);
        rl.prompt();
        return true;
    }
  }

  function replayMessages(conv: Conversation): void {
    for (const msg of conv.messages) {
      if (msg.role === "user") {
        console.log(`${PROMPT}${msg.content}`);
      } else {
        renderer.assistantToken(msg.content);
        renderer.assistantEnd();
      }
    }
  }

  async function handleResume(id: string | undefined): Promise<void> {
    if (!id) {
      renderer.error("Usage: /resume <id>");
      rl.prompt();
      return;
    }

    try {
      conversation = await store.load(id);
      console.log();
      replayMessages(conversation);
    } catch {
      renderer.error(`Conversation not found: ${id}`);
    }
    rl.prompt();
  }

  async function handleList(): Promise<void> {
    try {
      const summaries = await store.listSummaries();

      if (summaries.length === 0) {
        renderer.info("No conversations yet.");
        rl.prompt();
        return;
      }

      const displayed = summaries.slice(0, LIST_MAX_ITEMS);
      const idWidth = Math.max(...displayed.map((s) => s.id.length), 2);
      const titleWidth = Math.max(...displayed.map((s) => s.title.length), 5);

      const header = `${"ID".padEnd(idWidth)}  ${"Title".padEnd(titleWidth)}  Last Updated`;
      const separator = "-".repeat(header.length);
      const rows = displayed.map((s) => {
        const date = new Date(s.updatedAt).toLocaleString();
        return `${s.id.padEnd(idWidth)}  ${s.title.padEnd(titleWidth)}  ${date}`;
      });

      renderer.info(["", header, separator, ...rows, ""].join("\n"));
    } catch {
      renderer.error("Failed to list conversations.");
    }
    rl.prompt();
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

  if (conversation && conversation.messages.length > 0) {
    replayMessages(conversation);
  }

  rl.prompt();
}

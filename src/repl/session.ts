import { createInterface, emitKeypressEvents } from "node:readline";
import type { Conversation } from "../types.js";
import type { Renderer } from "../ui/renderer.js";
import type { PerplexityClient, SearchResult } from "../api/perplexity.js";
import type { ConversationStore } from "../store/conversation.js";
import { classifyApiError } from "../api/perplexity.js";

const PASTE_BRACKET_START = "\x1b[?2004h";
const PASTE_BRACKET_END = "\x1b[?2004l";
const PROMPT = "\u276F ";

type SessionDeps = {
  client: PerplexityClient;
  store: ConversationStore;
  renderer: Renderer;
  conversation: Conversation | null;
};

const LIST_MAX_ITEMS = 20;

const INTRO_TEXT = `\n🚀 Perplexity CLI - Ask anything or type /help for commands`;

const HELP_TEXT = `Available commands:
  /help         Show this help message
  /list         List saved conversations
  /resume <id>  Resume a saved conversation
  /clear        Start a new conversation
  /exit         Exit the application`;

export function startSession(deps: SessionDeps): Promise<void> {
  const { client, store, renderer } = deps;
  let conversation = deps.conversation;
  let exitRequested = false;

  // Enable bracketed paste mode
  process.stdout.write(PASTE_BRACKET_START);

  // Track paste state via keypress events
  let isPasting = false;
  emitKeypressEvents(process.stdin);
  process.stdin.on("keypress", (_str: string | undefined, key: { name: string }) => {
    if (key?.name === "paste-start") {
      isPasting = true;
    } else if (key?.name === "paste-end") {
      isPasting = false;
    }
  });

  return new Promise<void>((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: PROMPT,
    });

    function showPrompt(): void {
      console.log();
      rl.prompt();
    }

    async function ensureConversation(firstMessage: string): Promise<Conversation> {
      if (conversation) return conversation;
      conversation = await store.create(firstMessage);
      return conversation;
    }

    async function sendMessage(content: string): Promise<void> {
      try {
        const conv = await ensureConversation(content);

        store.addMessage(conv, "user", content);
        await store.save(conv);

        rl.pause();
        let fullResponse = "";
        let sources: SearchResult[] = [];

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
        const sourcesToStore = citedSources.map(({ title, url }) => ({ title, url }));
        store.addMessage(conv, "assistant", fullResponse, sourcesToStore);
        await store.save(conv);
      } catch (error) {
        renderer.assistantEnd();
        renderer.error(classifyApiError(error));
      } finally {
        rl.resume();
        showPrompt();
      }
    }

    function handleSlashCommand(input: string): void {
      console.log();
      const trimmed = input.trim();
      const [command, ...args] = trimmed.split(/\s+/);

      switch (command) {
        case "/help":
          renderer.info(HELP_TEXT);
          showPrompt();
          return;
        case "/list":
          handleList().catch((e) => {
            renderer.error(String(e));
            showPrompt();
          });
          return;
        case "/resume":
          handleResume(args[0]).catch((e) => {
            renderer.error(String(e));
            showPrompt();
          });
          return;
        case "/clear":
          conversation = null;
          renderer.info("Started new conversation.");
          showPrompt();
          return;
        case "/exit":
          exitRequested = true;
          rl.close();
          return;
        default:
          renderer.error(`Unknown command: ${command}`);
          showPrompt();
          return;
      }
    }

    function replayMessages(conv: Conversation): void {
      for (const msg of conv.messages) {
        if (msg.role === "user") {
          console.log(`${PROMPT}${msg.content}`);
        } else {
          console.log();
          renderer.assistantComplete(msg.content);
          if (msg.sources.length > 0) {
            const indexedSources = msg.sources.map((s, i) => ({ ...s, index: i + 1 }));
            renderer.sources(indexedSources);
          }
        }
      }
    }

    async function handleResume(id: string | undefined): Promise<void> {
      if (!id) {
        renderer.error("Usage: /resume <id>");
        showPrompt();
        return;
      }

      try {
        conversation = await store.load(id);
        replayMessages(conversation);
      } catch {
        renderer.error(`Conversation not found: ${id}`);
      }
      showPrompt();
    }

    async function handleList(): Promise<void> {
      try {
        const summaries = await store.listSummaries();

        if (summaries.length === 0) {
          renderer.info("No conversations yet.");
          showPrompt();
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

        renderer.info([header, separator, ...rows].join("\n"));
      } catch (error) {
        renderer.error(`Failed to list conversations: ${error}`);
      }
      showPrompt();
    }

    let lineBuffer: string[] = [];

    function flushLineBuffer(): void {
      const content = lineBuffer.join("\n").trim();
      lineBuffer = [];

      if (!content) {
        showPrompt();
        return;
      }

      if (content.startsWith("/") && !content.includes("\n")) {
        handleSlashCommand(content);
        return;
      }

      sendMessage(content).catch((e) => renderer.error(String(e)));
    }

    rl.on("line", (line: string) => {
      lineBuffer.push(line);

      // Only submit when NOT in paste mode
      // This means user pressed Enter (not a pasted newline)
      if (!isPasting) {
        flushLineBuffer();
      }
    });

    rl.on("close", () => {
      process.stdout.write(PASTE_BRACKET_END);
      const goodbye = exitRequested ? "Goodbye!" : "\n\nGoodbye!";
      renderer.info(goodbye);
      resolve();
    });

    renderer.info(INTRO_TEXT);
    console.log();

    if (conversation && conversation.messages.length > 0) {
      replayMessages(conversation);
    }

    rl.prompt();
  });
}

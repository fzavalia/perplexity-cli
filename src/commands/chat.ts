import { createPerplexityClient } from "../api/perplexity.js";
import { createConversationStore } from "../store/conversation.js";
import { createMarkdownRenderer } from "../ui/markdown.js";
import { createRenderer } from "../ui/renderer.js";
import { startSession } from "../repl/session.js";

export async function runChat(): Promise<void> {
  const apiKey = process.env["PERPLEXITY_API_KEY"];

  if (!apiKey) {
    console.error(
      "No API key configured. Set the PERPLEXITY_API_KEY environment variable."
    );
    process.exit(1);
  }

  const client = createPerplexityClient(apiKey);
  const store = createConversationStore();
  const markdown = createMarkdownRenderer();
  const renderer = createRenderer({ markdown });

  await store.ensureDirectory();

  await startSession({ client, store, renderer, conversation: null });
}

import { createPerplexityClient } from "../api/perplexity.js";
import { createConversationStore } from "../store/conversation.js";
import { createRenderer } from "../ui/renderer.js";
import { startSession } from "../repl/session.js";

export type ChatOptions = {
  plain?: boolean;
};

export async function runChat(options: ChatOptions = {}): Promise<void> {
  const apiKey = process.env["PERPLEXITY_API_KEY"];

  if (!apiKey) {
    console.error(
      "No API key configured. Set the PERPLEXITY_API_KEY environment variable."
    );
    process.exit(1);
  }

  const client = createPerplexityClient(apiKey);
  const store = createConversationStore();
  const renderer = createRenderer({ plain: options.plain });

  await store.ensureDirectory();

  await startSession({ client, store, renderer, conversation: null });
}

import { createPerplexityClient, isValidModel } from "../api/perplexity.js";
import { createConversationStore } from "../store/conversation.js";
import { createRenderer } from "../ui/renderer.js";
import { startSession } from "../repl/session.js";

export type ChatOptions = {
  plain?: boolean;
  model?: string;
};

export async function runChat(options: ChatOptions = {}): Promise<void> {
  const apiKey = process.env["PERPLEXITY_API_KEY"];

  if (!apiKey) {
    console.error(
      "No API key configured. Set the PERPLEXITY_API_KEY environment variable."
    );
    process.exit(1);
  }

  if (options.model && !isValidModel(options.model)) {
    console.error(`Invalid model: ${options.model}`);
    console.error(
      "Valid models: sonar, sonar-pro, sonar-reasoning-pro, sonar-deep-research"
    );
    process.exit(1);
  }

  const client = createPerplexityClient(apiKey, options.model);
  const store = createConversationStore();
  const renderer = createRenderer({ plain: options.plain });

  await store.ensureDirectory();

  await startSession({ client, store, renderer, conversation: null });
}

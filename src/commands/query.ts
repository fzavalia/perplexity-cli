import { createPerplexityClient, classifyApiError } from "../api/perplexity.js";
import type { SearchResult } from "../api/perplexity.js";
import { createConversationStore } from "../store/conversation.js";
import { createMarkdownRenderer } from "../ui/markdown.js";
import { createRenderer } from "../ui/renderer.js";

export async function runQuery(
  question: string,
  followUpId?: string
): Promise<void> {
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

  const conversation = followUpId
    ? await store.load(followUpId)
    : await store.create(question);
  store.addMessage(conversation, "user", question);

  try {
    let fullResponse = "";
    let sources: SearchResult[] = [];

    for await (const event of client.streamChat(conversation.messages)) {
      if (event.type === "token") {
        renderer.assistantToken(event.content);
        fullResponse += event.content;
      } else if (event.type === "sources") {
        sources = event.results;
      }
    }

    renderer.assistantEnd(fullResponse);

    store.addMessage(conversation, "assistant", fullResponse);
    await store.save(conversation);

    const citedSources = sources
      .map((s, i) => ({ ...s, index: i + 1 }))
      .filter((s) => fullResponse.includes(`[${s.index}]`));

    if (citedSources.length > 0) {
      renderer.sources(citedSources);
    }

    renderer.info(`\nFollow up: perplexity --follow-up ${conversation.id} "your question"`);
  } catch (error) {
    renderer.assistantEnd("");
    renderer.error(classifyApiError(error));
    process.exit(1);
  }
}

import { createPerplexityClient, classifyApiError } from "../api/perplexity.js";
import type { SearchResult } from "../api/perplexity.js";
import { createMarkdownRenderer } from "../ui/markdown.js";
import { createRenderer } from "../ui/renderer.js";
import type { Message } from "../types.js";

export async function runQuery(question: string): Promise<void> {
  const apiKey = process.env["PERPLEXITY_API_KEY"];

  if (!apiKey) {
    console.error(
      "No API key configured. Set the PERPLEXITY_API_KEY environment variable."
    );
    process.exit(1);
  }

  const client = createPerplexityClient(apiKey);
  const markdown = createMarkdownRenderer();
  const renderer = createRenderer({ markdown });

  const messages: Message[] = [
    {
      id: "1",
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
    },
  ];

  try {
    let fullResponse = "";
    let sources: SearchResult[] = [];

    for await (const event of client.streamChat(messages)) {
      if (event.type === "token") {
        renderer.assistantToken(event.content);
        fullResponse += event.content;
      } else if (event.type === "sources") {
        sources = event.results;
      }
    }

    renderer.assistantEnd(fullResponse);

    const citedSources = sources
      .map((s, i) => ({ ...s, index: i + 1 }))
      .filter((s) => fullResponse.includes(`[${s.index}]`));

    if (citedSources.length > 0) {
      renderer.sources(citedSources);
    }
  } catch (error) {
    renderer.assistantEnd("");
    renderer.error(classifyApiError(error));
    process.exit(1);
  }
}

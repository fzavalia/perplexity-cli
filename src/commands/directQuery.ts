import {
  createPerplexityClient,
  classifyApiError,
  type SearchResult,
} from "../api/perplexity.js";
import { createRenderer } from "../ui/renderer.js";
import type { Message } from "../types.js";
import { nanoid } from "nanoid";

export type DirectQueryOptions = {
  plain?: boolean;
};

export async function runDirectQuery(
  question: string,
  options: DirectQueryOptions = {}
): Promise<void> {
  const apiKey = process.env["PERPLEXITY_API_KEY"];

  if (!apiKey) {
    console.error(
      "No API key configured. Set the PERPLEXITY_API_KEY environment variable."
    );
    process.exit(1);
  }

  const client = createPerplexityClient(apiKey);
  const renderer = createRenderer({ plain: options.plain });

  const userMessage: Message = {
    id: nanoid(),
    role: "user",
    content: question,
    createdAt: new Date().toISOString(),
    sources: [],
  };

  try {
    const stream = client.streamChat([userMessage]);
    let sources: SearchResult[] = [];

    for await (const event of stream) {
      if (event.type === "token") {
        renderer.assistantToken(event.content);
      } else if (event.type === "sources") {
        sources = event.results;
      }
    }

    renderer.assistantEnd();

    if (sources.length > 0) {
      const indexedSources = sources.map((source, i) => ({
        ...source,
        index: i + 1,
      }));
      renderer.sources(indexedSources);
    }
  } catch (error) {
    renderer.error(classifyApiError(error));
    process.exit(1);
  }
}

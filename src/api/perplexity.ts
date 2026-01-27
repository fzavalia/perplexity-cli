import Perplexity from "@perplexity-ai/perplexity_ai";
import type { Message } from "../types.js";

const MODEL = "sonar-pro";

export type SearchResult = {
  title: string;
  url: string;
};

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "sources"; results: SearchResult[] };

export type PerplexityClient = {
  streamChat(
    messages: Message[]
  ): AsyncGenerator<StreamEvent, void, undefined>;
};

export function createPerplexityClient(apiKey: string): PerplexityClient {
  const client = new Perplexity({ apiKey });

  return {
    async *streamChat(messages) {
      const stream = await client.chat.completions.create({
        model: MODEL,
        stream: true,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      let sourcesSent = false;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (typeof content === "string") {
          yield { type: "token", content };
        }

        if (!sourcesSent && chunk.search_results && chunk.search_results.length > 0) {
          sourcesSent = true;
          yield {
            type: "sources",
            results: chunk.search_results.map((r) => ({
              title: r.title,
              url: r.url,
            })),
          };
        }
      }
    },
  };
}

export function classifyApiError(error: unknown): string {
  if (error instanceof Perplexity.APIConnectionError) {
    return "Could not reach api.perplexity.ai. Check your connection.";
  }

  if (error instanceof Perplexity.APIError) {
    switch (error.status) {
      case 401:
        return "Invalid API key. Check your PERPLEXITY_API_KEY.";
      case 429: {
        const retryAfter = error.headers?.["retry-after"];
        const suffix = retryAfter ? ` Retry after ${retryAfter}s.` : "";
        return `Rate limited.${suffix}`;
      }
      default:
        if (error.status && error.status >= 500) {
          return `Perplexity server error (${error.status}). Try again later.`;
        }
        return `API error (${error.status}): ${error.message}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred.";
}

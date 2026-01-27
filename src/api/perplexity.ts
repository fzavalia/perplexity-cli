import OpenAI from "openai";
import type { Message } from "../types.js";

const MODEL = "sonar-pro";
const BASE_URL = "https://api.perplexity.ai";

export type PerplexityClient = {
  streamChat(
    messages: Message[]
  ): AsyncGenerator<string, void, undefined>;
};

export function createPerplexityClient(apiKey: string): PerplexityClient {
  const client = new OpenAI({
    apiKey,
    baseURL: BASE_URL,
  });

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

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    },
  };
}

export function classifyApiError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
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

  if (error instanceof OpenAI.APIConnectionError) {
    return "Could not reach api.perplexity.ai. Check your connection.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred.";
}

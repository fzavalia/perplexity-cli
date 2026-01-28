import chalk from "chalk";
import type { SearchResult } from "../api/perplexity.js";

export type IndexedSource = SearchResult & { index: number };

export type Renderer = {
  assistantToken(token: string): void;
  assistantEnd(): void;
  assistantComplete(content: string): void;
  sources(results: IndexedSource[]): void;
  error(message: string): void;
  info(message: string): void;
};

export function createRenderer(): Renderer {
  let isFirstToken = true;

  function colorCitations(text: string): string {
    return text.replace(/\[(\d+)\]/g, (_, n) => chalk.dim(`[${n}]`));
  }

  return {
    assistantToken(token: string) {
      if (isFirstToken) {
        process.stdout.write("\n");
        isFirstToken = false;
      }
      process.stdout.write(colorCitations(token));
    },

    assistantEnd() {
      process.stdout.write("\n");
      isFirstToken = true;
    },

    assistantComplete(content: string) {
      process.stdout.write(content + "\n");
    },

    sources(results: IndexedSource[]) {
      console.log("");
      for (const source of results) {
        console.log(chalk.dim(`[${source.index}] `) + chalk.blue.underline(source.url));
      }
    },

    error(message: string) {
      console.error(chalk.red(message));
    },

    info(message: string) {
      console.log(chalk.dim(message));
    },
  };
}

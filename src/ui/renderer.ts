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

type RendererOptions = {
  isTTY?: boolean;
  noColor?: boolean;
};

export function createRenderer(options: RendererOptions = {}): Renderer {
  const isTTY = options.isTTY ?? process.stdout.isTTY ?? false;
  const noColor = options.noColor ?? !!process.env["NO_COLOR"];
  const useColor = isTTY && !noColor;
  let isFirstToken = true;

  return {
    assistantToken(token: string) {
      if (isFirstToken) {
        process.stdout.write("\n");
        isFirstToken = false;
      }
      process.stdout.write(token);
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
        const label = useColor
          ? chalk.dim(`[${source.index}] `) + chalk.blue.underline(source.url)
          : `[${source.index}] ${source.url}`;
        console.log(label);
      }
    },

    error(message: string) {
      const formatted = useColor ? chalk.red(message) : message;
      console.error(formatted);
    },

    info(message: string) {
      const formatted = useColor ? chalk.dim(message) : message;
      console.log(formatted);
    },
  };
}

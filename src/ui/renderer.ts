import chalk from "chalk";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
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

marked.use(markedTerminal() as Parameters<typeof marked.use>[0]);

function renderMarkdown(text: string): string {
  const result = marked.parse(text, { async: false });
  return result.trim();
}

function colorCitations(text: string): string {
  return text.replace(/\[(\d+)\]/g, (_, n) => chalk.dim(`[${n}]`));
}

export function createRenderer(): Renderer {
  let isFirstToken = true;
  let buffer = "";
  let lineCount = 0;

  function countLines(text: string): number {
    const cols = process.stdout.columns || 80;
    let count = 0;
    for (const line of text.split("\n")) {
      count += Math.max(1, Math.ceil(line.length / cols));
    }
    return count;
  }

  function clearLines(count: number): void {
    for (let i = 0; i < count; i++) {
      process.stdout.write("\x1b[2K"); // Clear line
      if (i < count - 1) {
        process.stdout.write("\x1b[1A"); // Move up
      }
    }
    process.stdout.write("\r"); // Return to start of line
  }

  return {
    assistantToken(token: string) {
      if (isFirstToken) {
        process.stdout.write("\n");
        isFirstToken = false;
      }
      buffer += token;
      lineCount = countLines(buffer);
      process.stdout.write(token);
    },

    assistantEnd() {
      if (buffer) {
        clearLines(lineCount);
        const formatted = colorCitations(renderMarkdown(buffer));
        process.stdout.write(formatted + "\n");
      } else {
        process.stdout.write("\n");
      }
      buffer = "";
      lineCount = 0;
      isFirstToken = true;
    },

    assistantComplete(content: string) {
      const formatted = colorCitations(renderMarkdown(content));
      process.stdout.write(formatted + "\n");
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

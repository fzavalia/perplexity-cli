import chalk from "chalk";
import type { SearchResult } from "../api/perplexity.js";
import type { MarkdownRenderer } from "./markdown.js";

export type IndexedSource = SearchResult & { index: number };

export type Renderer = {
  assistantToken(token: string): void;
  assistantEnd(fullResponse: string): void;
  sources(results: IndexedSource[]): void;
  error(message: string): void;
  info(message: string): void;
};

type RendererOptions = {
  isTTY?: boolean;
  noColor?: boolean;
  markdown?: MarkdownRenderer;
};

export function createRenderer(options: RendererOptions = {}): Renderer {
  const isTTY = options.isTTY ?? process.stdout.isTTY ?? false;
  const noColor = options.noColor ?? !!process.env["NO_COLOR"];
  const useColor = isTTY && !noColor;
  const markdown = options.markdown;
  let isFirstToken = true;
  let rawBuffer = "";

  function countTerminalRows(text: string): number {
    const columns = process.stdout.columns || 80;
    const lines = text.split("\n");
    let rows = 0;
    for (const line of lines) {
      rows += Math.max(1, Math.ceil(line.length / columns));
    }
    return rows;
  }

  return {
    assistantToken(token: string) {
      if (isFirstToken) {
        process.stdout.write("\n");
        isFirstToken = false;
      }
      process.stdout.write(token);
      rawBuffer += token;
    },

    assistantEnd(fullResponse: string) {
      if (isTTY && useColor && markdown && fullResponse) {
        const contentRows = countTerminalRows(rawBuffer);
        const totalRows = contentRows + 1; // +1 for the leading blank line
        process.stdout.write(`\x1b[${totalRows}A\x1b[1G\x1b[0J`);
        const rendered = markdown.render(fullResponse);
        const styled = rendered.replace(/\[(\d+)\]/g, (m) => chalk.dim(m));
        process.stdout.write("\n" + styled + "\n");
      } else {
        process.stdout.write("\n");
      }
      isFirstToken = true;
      rawBuffer = "";
    },

    sources(results: IndexedSource[]) {
      console.log("");
      for (const source of results) {
        const label = useColor
          ? chalk.dim(`[${source.index}] `) + chalk.underline(source.url)
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

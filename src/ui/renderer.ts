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
  const useMarkdown = isTTY && useColor && !!markdown;
  let isFirstToken = true;
  let tokenCount = 0;

  function writeIndicator(): void {
    process.stdout.write(
      `\x1b[1G\x1b[2K${chalk.dim(`Thinking (${tokenCount})`)}`
    );
  }

  return {
    assistantToken(token: string) {
      if (isFirstToken) {
        process.stdout.write("\n");
        isFirstToken = false;
      }
      if (useMarkdown) {
        tokenCount++;
        writeIndicator();
      } else {
        process.stdout.write(token);
      }
    },

    assistantEnd(fullResponse: string) {
      if (useMarkdown && !isFirstToken) {
        process.stdout.write(`\x1b[1A\x1b[1G\x1b[0J`);
        if (fullResponse) {
          const rendered = markdown!.render(fullResponse);
          const styled = rendered.replace(/\[(\d+)\]/g, (m) => chalk.dim(m));
          process.stdout.write("\n" + styled + "\n");
        } else {
          process.stdout.write("\n");
        }
      } else {
        process.stdout.write("\n");
      }
      isFirstToken = true;
      tokenCount = 0;
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

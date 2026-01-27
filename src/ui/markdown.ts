import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

export type MarkdownRenderer = {
  render(markdown: string): string;
};

export function createMarkdownRenderer(): MarkdownRenderer {
  const terminalColumns = process.stdout.columns || 80;

  const marked = new Marked();
  marked.use(markedTerminal({ width: terminalColumns, tab: 2 }) as object);

  return {
    render(markdown: string): string {
      const result = marked.parse(markdown) as string;
      return result.trimEnd();
    },
  };
}

import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

export type MarkdownRenderer = {
  render(markdown: string): string;
};

export function createMarkdownRenderer(): MarkdownRenderer {
  return {
    render(markdown: string): string {
      const width = process.stdout.columns || 80;
      const marked = new Marked();
      // Cast needed: @types/marked-terminal doesn't match marked's extension type
      marked.use(markedTerminal({ width, tab: 2 }) as object);
      const result = marked.parse(markdown, { async: false });
      return result.trimEnd();
    },
  };
}

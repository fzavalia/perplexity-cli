import chalk from "chalk";

export type Renderer = {
  userMessage(content: string): void;
  assistantToken(token: string): void;
  assistantEnd(): void;
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
    userMessage(content: string) {
      const prefix = useColor ? chalk.dim("U: ") : "";
      console.log(`${prefix}${content}`);
    },

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

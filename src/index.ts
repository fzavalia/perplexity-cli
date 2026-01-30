#!/usr/bin/env node

import { createRequire } from "node:module";
import { program } from "commander";
import { runChat } from "./commands/chat.js";
import { runDirectQuery } from "./commands/directQuery.js";
import { readStdinIfPiped } from "./utils/stdin.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

export function mergeStdinAndQuestion(
  stdinContent: string,
  question: string
): string {
  const trimmedStdin = stdinContent.trim();
  if (trimmedStdin && question) {
    return `${trimmedStdin}\n\n${question}`;
  }
  return trimmedStdin || question;
}

program
  .name("perplexity")
  .description("Terminal interface to Perplexity chat models")
  .version(version)
  .option("-p, --plain", "Disable colors and markdown formatting")
  .option(
    "-m, --model <model>",
    "Model to use (sonar, sonar-pro, sonar-reasoning-pro, sonar-deep-research)"
  )
  .argument("[question...]", "Ask a question directly without entering REPL")
  .action(
    async (
      questionParts: string[],
      options: { plain?: boolean; model?: string }
    ) => {
      const stdinContent = await readStdinIfPiped();
      const questionArg = questionParts?.join(" ") || "";
      const fullContent = mergeStdinAndQuestion(stdinContent, questionArg);

      if (fullContent) {
        await runDirectQuery(fullContent, {
          plain: options.plain,
          model: options.model,
        });
      } else {
        await runChat({ plain: options.plain, model: options.model });
      }
    }
  );

program.parse();

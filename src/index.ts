#!/usr/bin/env node

import { createRequire } from "node:module";
import { program } from "commander";
import { runChat } from "./commands/chat.js";
import { runDirectQuery } from "./commands/directQuery.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

program
  .name("perplexity")
  .description("Terminal interface to Perplexity chat models")
  .version(version)
  .option("-p, --plain", "Disable colors and markdown formatting")
  .argument("[question...]", "Ask a question directly without entering REPL")
  .action(async (questionParts: string[], options: { plain?: boolean }) => {
    const question = questionParts?.join(" ");
    if (question) {
      await runDirectQuery(question, { plain: options.plain });
    } else {
      await runChat({ plain: options.plain });
    }
  });

program.parse();

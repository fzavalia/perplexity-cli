#!/usr/bin/env node

import { createRequire } from "node:module";
import { program } from "commander";
import { runChat } from "./commands/chat.js";
import { runQuery } from "./commands/query.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

program
  .name("perplexity")
  .description("Terminal interface to Perplexity chat models")
  .version(version)
  .argument("[question]", "Ask a question and exit")
  .option("--follow-up <id>", "Follow up on a saved conversation")
  .action((question?: string, opts?: { followUp?: string }) => {
    if (opts?.followUp && !question) {
      console.error("--follow-up requires a question argument.");
      process.exit(1);
    }
    return question ? runQuery(question, opts?.followUp) : runChat();
  });

program.parse();

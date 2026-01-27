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
  .action((question?: string) => (question ? runQuery(question) : runChat()));

program.parse();

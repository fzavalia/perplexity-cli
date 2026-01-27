#!/usr/bin/env node

import { program } from "commander";
import { runChat } from "./commands/chat.js";
import { runList } from "./commands/list.js";

program
  .name("perplexity")
  .description("Terminal interface to Perplexity chat models")
  .version("0.1.0")
  .action(runChat);

program
  .command("list")
  .description("List saved conversations")
  .option("-l, --limit <n>", "Max conversations to show", parseInt)
  .action(runList);

program.parse();

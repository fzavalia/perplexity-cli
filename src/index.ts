#!/usr/bin/env node

import { program } from "commander";
import { runChat } from "./commands/chat.js";

program
  .name("perplexity")
  .description("Terminal interface to Perplexity chat models")
  .version("0.1.0")
  .action(runChat);

program.parse();

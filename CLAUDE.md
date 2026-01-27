# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Perplexity CLI — a TypeScript terminal interface to Perplexity's chat models. See `MVP.md` for full spec.

## Architecture

```
src/
  index.ts           → CLI entry, commander setup, command routing
  commands/
    chat.ts          → interactive REPL entry
    list.ts          → list conversations
  api/
    perplexity.ts    → OpenAI SDK wrapper (baseURL: api.perplexity.ai)
  store/
    conversation.ts  → CRUD for conversation JSON files + index
  repl/
    session.ts       → readline loop, slash command dispatch (/exit, /help, /retry)
  ui/
    renderer.ts      → streaming output, TTY-aware formatting (chalk)
```

Data lives in `~/.perplexity-cli/` — conversations as `<id>.json` files with an `index.json` for fast listing.

## Tech stack

TypeScript (ES2020), Node.js >=18, commander, openai SDK, chalk, inquirer, nanoid.

## Conventions

- Conventional Commits: `<type>(scope): <description>` (feat, fix, docs, refactor, etc.)
- Small single-responsibility functions, descriptive names, no magic numbers
- Prefer self-documenting code over comments
- Dependency injection, Law of Demeter

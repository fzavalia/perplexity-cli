# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Perplexity CLI — a TypeScript terminal interface to Perplexity's chat models. See `README.md` for setup, usage, and project overview.

## Architecture

```
src/
  index.ts           → CLI entry (shebang), commander setup, default → chat
  types.ts           → shared types: Message, Conversation, ConversationSummary
  commands/
    chat.ts          → runChat(): validates PERPLEXITY_API_KEY, wires deps, starts session
  api/
    perplexity.ts    → createPerplexityClient(apiKey): streamChat async generator via OpenAI SDK
                       classifyApiError(): maps errors to user-friendly messages
  store/
    conversation.ts  → createConversationStore(): CRUD for conversation JSON files + index.json
  repl/
    session.ts       → startSession(deps): readline loop, multi-line paste (10ms debounce),
                       slash commands (/help, /list), deferred conversation creation
  ui/
    renderer.ts      → createRenderer(): streaming token output, TTY/NO_COLOR aware
```

Data lives in `~/.perplexity-cli/conversations/` — each conversation as `<id>.json` with an `index.json` for fast listing.

## Build & run

- `npm run build` — compile TypeScript to `dist/`
- `npm run dev` — watch mode
- `npm start` — run `dist/index.js`
- `npm test` / `npm run test:watch` — vitest

Auth: `export PERPLEXITY_API_KEY=<key>` (read from env, no config file).

## Tech stack

TypeScript (ES2020, ESM), Node.js >=18, commander, openai SDK, chalk v5, nanoid v5.

## Key patterns

- Factory functions (`createX`) returning typed objects — no classes
- Async generators for streaming API responses
- Deferred conversation creation (conversation starts as `null`, created on first user message)
- Multi-line paste via readline line-buffering with 10ms debounce

## Conventions

- Conventional Commits: `<type>(scope): <description>` (feat, fix, docs, refactor, etc.)
- Before committing: if a feature was added, changed, or removed, update `README.md` and `CLAUDE.md` to reflect the change
- Small single-responsibility functions, descriptive names, no magic numbers
- Prefer self-documenting code over comments
- Dependency injection, Law of Demeter

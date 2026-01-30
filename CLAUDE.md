# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Perplexity CLI — a TypeScript terminal interface to Perplexity's chat models. See `README.md` for setup, usage, and project overview.

## Architecture

```
src/
  index.ts           → CLI entry (shebang), commander setup, routes to runChat or runDirectQuery
  types.ts           → shared types: Message, Conversation, ConversationSummary
  commands/
    chat.ts          → runChat(): validates PERPLEXITY_API_KEY, wires deps, starts session
    directQuery.ts   → runDirectQuery(question): one-shot query, streams response, exits
  api/
    perplexity.ts    → createPerplexityClient(apiKey): streamChat async generator via OpenAI SDK
                       classifyApiError(): maps errors to user-friendly messages
  store/
    conversation.ts  → createConversationStore(): CRUD for conversation JSON files + index.json
  repl/
    session.ts       → startSession(deps): readline loop, multi-line paste (bracketed paste mode),
                       slash commands (/help, /list, /resume, /clear), deferred conversation creation
  ui/
    renderer.ts      → createRenderer(): streaming token output with markdown rendering
                       (marked + marked-terminal), color support for sources/errors/info
```

Data lives in `~/.perplexity-cli/conversations/` — each conversation as `<id>.json` with an `index.json` for fast listing.

## Tests

Unit tests live in `src/__tests__/`, mirroring the source structure:

```
src/__tests__/
  helpers.ts                  → shared test utilities (mock factories, collectEvents)
  index.test.ts               → CLI entry tests
  api/
    perplexity-error.test.ts  → classifyApiError tests (real SDK error constructors)
    perplexity-client.test.ts → streamChat tests (mocked SDK)
  commands/
    chat.test.ts              → runChat tests (mocked deps)
    directQuery.test.ts       → runDirectQuery tests (mocked deps)
  repl/
    session.test.ts           → startSession tests (mocked readline, fake timers)
  store/
    conversation.test.ts      → CRUD tests (real temp directories)
  ui/
    renderer.test.ts          → output tests (spied stdout/console)
```

## Build & run

- `npm run build` — compile TypeScript to `dist/`
- `npm run dev` — watch mode
- `npm start` — run `dist/index.js`
- `npm test` / `npm run test:watch` — vitest

Auth: `export PERPLEXITY_API_KEY=<key>` (read from env, no config file).

## Tech stack

TypeScript (ES2020, ESM), Node.js >=18, commander, @perplexity-ai/perplexity_ai SDK, chalk v5, nanoid v5.

## Key patterns

- Factory functions (`createX`) returning typed objects — no classes
- Async generators for streaming API responses
- Deferred conversation creation (conversation starts as `null`, created on first user message)
- Multi-line paste via bracketed paste mode (terminal signals paste-start/paste-end)

## Conventions

- Never commit unless explicitly asked to
- Conventional Commits: `<type>(scope): <description>` (feat, fix, docs, refactor, etc.)
- Before committing: if a feature was added, changed, or removed, update `README.md` and `CLAUDE.md` to reflect the change
- Small single-responsibility functions, descriptive names, no magic numbers
- Prefer self-documenting code over comments
- Dependency injection, Law of Demeter
- Always use TDD: write tests first (red), implement to pass (green), refactor

# Perplexity CLI - MVP (v0.1)

## Product overview

The **Perplexity CLI** is a terminal-first interface to Perplexity's chat models. It lets developers start and resume conversations without leaving the shell.

- Fast to invoke (`perplexity`) from anywhere.
- Persistent conversations stored locally as JSON.
- Minimal but ergonomic UX.

### API interaction

- Uses the Perplexity chat completions endpoint (OpenAI-compatible).
- Base URL: `https://api.perplexity.ai`.
- Auth: `Authorization: Bearer <PPLX_API_KEY>` header.
- Request: `{ model, messages, stream: true }`.
- Default model: `sonar-pro`.

---

## MVP scope

### 1. Authentication

- Read API key from `PPLX_API_KEY` environment variable only.
- Clear error when no key is found: _"No API key configured. Set the PPLX_API_KEY environment variable."_

### 2. Interactive REPL

```
perplexity
```

- `perplexity` with no args and no existing conversations starts a new conversation.
- `perplexity` with no args and existing conversations shows a picker: _New conversation / Resume last / Pick from list_.
- Inside the REPL:
  - Sending a line sends a user message; empty line is ignored.
  - Pasted multi-line input is sent as a single message.
  - `/exit` or `Ctrl+D` quits.
  - `/help` lists available commands.
  - `/retry` resends the last user message.
- Stream assistant tokens as they arrive.

### 3. Conversation persistence

- Auto-create `~/.perplexity-cli/conversations/` on first run if it doesn't exist.
- Store conversations as JSON files in `~/.perplexity-cli/conversations/`.
- Each file: `<conversationId>.json` with the following schema:

  ```ts
  type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: string;          // ISO
  };

  type Conversation = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Message[];
  };
  ```
- Maintain `index.json` with `{ id, title, createdAt, updatedAt }` per conversation for fast listing.
- Auto-title: use the first user message (truncated to ~60 chars) as the conversation title.

### 4. List conversations

- `perplexity list` prints a table: id, title, last updated.
  - `--limit <n>` to cap results (default 20).

### 5. Output formatting

- TTY: prefix user messages with dim `U:`, assistant messages with bold `P:`.
- Non-TTY: plain text, no colors, no prefixes.
- Respect `NO_COLOR` env var.

### 6. Error handling

- Missing API key: clear message + non-zero exit.
- HTTP 4xx/5xx: human-readable message + status code.
- Rate limit (429): show retry message, include `Retry-After` if available.
- Network errors: _"Could not reach api.perplexity.ai. Check your connection."_

---

## Out of scope (deferred)

These features are explicitly deferred past MVP:

- One-shot mode (`perplexity "prompt"`) and `--raw` flag
- `perplexity new [title]` (named new conversation)
- `perplexity resume [id]` (resume by id or interactive picker)
- `perplexity delete <id>` (delete conversation with confirmation)
- Model selection (`--model` flag, `perplexity models`, per-conversation model)
- Config file and config commands (`perplexity config`, `config path`, `config edit`, `config set`)
- `perplexity login` (API key prompt + config file storage)
- `perplexity archive <id>`
- `--code` / `--json` flags
- `--system` flag for one-off system prompts
- `defaultSystemPrompt`, `temperature`, `maxTokens`, `logLevel` config fields
- REPL commands: `/title`, `/model`, `/history`
- File/workspace context attachment
- Named profiles
- `--from-stdin` piped input mode

---

## Technical stack

| Concern         | Choice                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| Language         | TypeScript, targeting ES2020                                          |
| Runtime          | Node.js LTS (>=18)                                                    |
| CLI parsing      | `commander`                                                           |
| API client       | `openai` SDK configured with `baseURL: "https://api.perplexity.ai"`  |
| Colors           | `chalk`                                                               |
| Interactive      | `inquirer` (for conversation picker)                                  |
| IDs              | `nanoid` (short, URL-safe)                                            |

### Project structure

```
src/
  index.ts                      # entry point, commander setup, command routing
  commands/
    chat.ts                     # interactive REPL entry
    list.ts                     # list conversations
  api/
    perplexity.ts               # OpenAI-compatible client wrapper
  store/
    conversation.ts             # CRUD for conversation files + index
  repl/
    session.ts                  # readline loop, slash command dispatch
  ui/
    renderer.ts                 # streaming output, formatting, colors
```

---

## Definition of done

The MVP is complete when:

1. Setting `PPLX_API_KEY` env var authenticates all commands.
2. `perplexity` opens an interactive REPL with multi-turn context.
3. Conversations persist across sessions and can be listed and resumed.
4. Errors (no key, network, API) are handled gracefully with clear messages.
5. The package installs globally via `npm i -g` and exposes the `perplexity` binary.

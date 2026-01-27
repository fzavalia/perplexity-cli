# Perplexity CLI

A terminal interface to Perplexity's chat models with streaming responses, source citations, and conversation persistence.

## Features

- Streaming responses from Perplexity's `sonar-pro` model
- Markdown-formatted responses (headers, bold, code blocks, lists)
- Source citations displayed after each response
- Conversation history saved locally
- Multi-line paste support
- One-shot query mode (`perplexity "question"`)
- Follow-up queries (`perplexity --follow-up <id> "question"`)
- Slash commands: `/help`, `/list`, `/resume`, `/clear`

## Requirements

- Node.js >= 18
- [Perplexity API key](https://www.perplexity.ai/settings/api)

## Setup

```bash
git clone https://github.com/fzavalia/perplexity-cli.git
cd perplexity-cli
npm install
npm run build
```

Set your API key:

```bash
export PERPLEXITY_API_KEY=<your-key>
```

## Usage

Start an interactive conversation:

```bash
npm start
```

Ask a one-shot question (streams the answer and exits):

```bash
npm start -- "What is TypeScript?"
```

Follow up on a previous query using the conversation ID printed after each answer:

```bash
npm start -- --follow-up <id> "Tell me more about interfaces"
```

### Global install

```bash
npm link
perplexity                                              # interactive mode
perplexity "What is TypeScript?"                        # one-shot mode
perplexity --follow-up <id> "Tell me more"              # follow-up query
```

### Slash commands

| Command        | Description                    |
|----------------|--------------------------------|
| `/help`        | Show available commands         |
| `/list`        | List saved conversations        |
| `/resume <id>` | Resume a saved conversation     |
| `/clear`       | Start a new conversation        |
| `/exit`        | Exit the application            |

Use `/exit` or `Ctrl+D` to exit.

## Project structure

```
src/
  index.ts              CLI entry point
  types.ts              Shared type definitions
  commands/
    chat.ts             Chat command (interactive REPL)
    query.ts            Query command (one-shot question)
  api/
    perplexity.ts       Perplexity SDK client + error handling
  store/
    conversation.ts     Conversation persistence (~/.perplexity-cli/)
  repl/
    session.ts          Interactive readline session + slash commands
  ui/
    markdown.ts         Markdown-to-terminal rendering (marked + marked-terminal)
    renderer.ts         Streaming output + source citation display
```

## Development

```bash
npm run dev          # watch mode
npm test             # run tests
npm run test:watch   # watch tests
```

## License

MIT

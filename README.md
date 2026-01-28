# Perplexity CLI

A terminal interface to Perplexity's chat models with streaming responses, source citations, and conversation persistence.

![Demo](preview.gif)

## Features

- Streaming responses from Perplexity's `sonar-pro` model
- Source citations displayed after each response
- Conversation history saved locally
- Multi-line paste support
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

### Global install

```bash
npm link
perplexity
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
  api/
    perplexity.ts       Perplexity SDK client + error handling
  store/
    conversation.ts     Conversation persistence (~/.perplexity-cli/)
  repl/
    session.ts          Interactive readline session + slash commands
  ui/
    renderer.ts         Streaming output + source citation display
  __tests__/
    helpers.ts          Shared test utilities
    api/                Tests for API module
    commands/           Tests for command modules
    repl/               Tests for REPL session
    store/              Tests for conversation store
    ui/                 Tests for UI modules
```

## Development

```bash
npm run dev          # watch mode
npm test             # run tests
npm run test:watch   # watch tests
```

## License

MIT

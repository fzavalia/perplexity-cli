# Perplexity CLI

A terminal interface to Perplexity's chat models with streaming responses, source citations, and conversation persistence.

![Demo](preview.gif)

## Features

- Streaming responses from Perplexity models (sonar, sonar-pro, sonar-reasoning-pro, sonar-deep-research)
- Source citations displayed after each response
- Conversation history saved locally
- Multi-line paste support (bracketed paste mode)
- Direct question mode for one-shot queries
- Model selection via `--model` flag
- Slash commands: `/help`, `/list`, `/resume`, `/delete`, `/copy`, `/clear`

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

### Direct question mode

Ask a single question without entering the REPL:

```bash
perplexity "What is TypeScript?"
```

The answer is printed and the program exits. Useful for scripting and quick lookups.

### Plain output mode

Disable colors and markdown formatting for piping to other tools:

```bash
perplexity --plain "What is TypeScript?" | cat
perplexity -p "Explain async/await" > answer.txt
```

Works with both direct queries and interactive mode.

### Model selection

Choose a different Perplexity model:

```bash
perplexity --model sonar "Quick question"
perplexity -m sonar-reasoning-pro "Complex reasoning task"
```

Available models:

| Model | Description |
|-------|-------------|
| `sonar` | Fastest, cheapest ($1/1M tokens) |
| `sonar-pro` | Default, larger context (200k) |
| `sonar-reasoning-pro` | Better for complex reasoning |
| `sonar-deep-research` | In-depth research queries |

Works with both direct queries and interactive mode.

### Global install

```bash
npm link
perplexity
```

### Slash commands

| Command        | Description                      |
|----------------|----------------------------------|
| `/help`        | Show available commands          |
| `/list`        | List saved conversations         |
| `/resume <id>` | Resume a saved conversation      |
| `/delete <id>` | Delete a saved conversation      |
| `/copy`        | Copy last response to clipboard  |
| `/clear`       | Start a new conversation         |
| `/exit`        | Exit the application             |

Use `/exit` or `Ctrl+D` to exit.

## Project structure

```
src/
  index.ts              CLI entry point
  types.ts              Shared type definitions
  commands/
    chat.ts             Chat command (interactive REPL)
    directQuery.ts      Direct question mode (one-shot query)
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

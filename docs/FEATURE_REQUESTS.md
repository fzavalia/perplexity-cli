# Feature Requests

Potential improvements identified from end-user perspective.

## High Priority

### Resume Last Conversation
```bash
perplexity --continue  # or -c
```
Avoids the `/list` → find ID → `/resume <id>` workflow.

### Regenerate Response
```
/retry
```
Resend the last message if the response was cut off or unsatisfying.

### File Context
```bash
perplexity --file src/api.ts "explain this code"
perplexity -f schema.sql "optimize these queries"
```
Attach file content without copy-pasting.

## Medium Priority

### Search Conversations
```
/search <query>
```
Find conversations by content instead of scrolling through `/list`.

### Conversation Stats in List
Show message count in `/list` output:
```
abc123 | "How do I..." | 5 messages | 2 days ago
```

### Export Conversation
```
/export [filename]
```
Save current conversation as markdown for sharing or documentation.

### Quiet Resume
When resuming, show summary instead of replaying every message:
```
Resumed conversation "How to deploy..." (8 messages)
```

### System Prompt / Persona
```bash
perplexity --system "You are a senior TypeScript engineer" "review this"
```
Customize response style for different tasks.

### Configuration File
`~/.perplexity-cli/config.json` for defaults:
```json
{ "model": "sonar-pro", "systemPrompt": "Be concise" }
```
Avoid repeating flags.

### API Usage Tracking
```
/usage
Tokens used: 12,450 | Est. cost: $0.03
```
Helps budget-conscious users.

### Tags for Conversations
```
/tag work api-design
/list --tag work
```
Better organization than browsing by date.

### Brief/Detailed Modes
```bash
perplexity --brief "what is REST?"
perplexity --detailed "explain OAuth2 flows"
```
Control response verbosity.

## Nice to Have

### Rename Conversation
```
/rename <title>
```
Give a meaningful name instead of auto-generated truncation.

### Response Caching
Cache identical queries to avoid repeat API calls and costs.

### Clipboard Integration
```bash
perplexity --clipboard  # read question from clipboard
```

### Follow-up Without REPL
```bash
perplexity "what is rust?" --follow-up "compare to go"
```
Chain queries in scripts.

### Favorites
```
/star
/favorites
```
Quick access to important conversations.

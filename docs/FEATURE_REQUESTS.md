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

## Nice to Have

### Rename Conversation
```
/rename <title>
```
Give a meaningful name instead of auto-generated truncation.

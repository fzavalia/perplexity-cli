# Cancel Streaming Response with Escape

## Overview

Press `Escape` during a streaming response to cancel it. The partial response is discarded (not saved to conversation history), and "(cancelled)" is displayed.

## User Experience

1. User sends a message
2. Response starts streaming
3. User presses `Escape`
4. Streaming stops immediately
5. "(cancelled)" appears on a new line
6. Prompt is shown, ready for next input
7. Partial response is NOT saved to conversation history

## Technical Changes

### 1. `src/api/perplexity.ts`

- Add optional `signal?: AbortSignal` parameter to `streamChat`
- Pass signal to the Perplexity SDK's `create()` call
- The SDK will throw an `AbortError` when signal is aborted

### 2. `src/repl/session.ts`

- Create `AbortController` before calling `streamChat`
- Set stdin to raw mode during streaming to capture individual keypresses
- Listen for Escape key (`\x1b`) and call `controller.abort()`
- Catch abort and show "(cancelled)" via renderer
- Restore stdin mode and resume readline after streaming ends (in finally block)

### 3. `src/ui/renderer.ts`

- Add `cancelled()` method that outputs "(cancelled)" in muted color

## Edge Cases

- If user presses Escape when not streaming: no effect (not in raw mode)
- If stream errors AND user cancels: cancellation takes precedence
- Ctrl+C still exits the app as before

# Thinking Token Rendering — Architecture & Best Practices

## Overview

Qwen3-32B (and similar reasoning models) emit thinking tokens inline in `content` as `<think>...</think>answer`. This documents how they are rendered and what was deliberately avoided.

## Approach: Frontend Parse at Render Time

Thinking tokens are parsed **per message at render time** using an `indexOf`-based parser. The `ThinkingBlock` is bound directly to its message bubble — above the answer text, inline in the chat flow.

```
msg.content = "<think>reasoning...</think>answer text"
       ↓
parseMessage(msg.content)
       ↓
{ thinking: "reasoning...", text: "answer text", isThinkingComplete: true }
       ↓
<ThinkingBlock thinking=... />   ← above, per-bubble
<Markdown>{text}</Markdown>      ← below, clean
```

## Parser

```ts
function parseMessage(content: string): ParsedMessage {
  const openIdx = content.indexOf("<think>");
  const closeIdx = content.indexOf("</think>");
  if (openIdx === -1) return { thinking: null, text: content.trim(), isThinkingComplete: false };
  if (closeIdx === -1) {
    // Still streaming — partial thinking block, no answer yet
    return { thinking: content.slice(openIdx + 7).trim(), text: "", isThinkingComplete: false };
  }
  return {
    thinking: content.slice(openIdx + 7, closeIdx).trim(),
    text: content.slice(closeIdx + 8).trim(),
    isThinkingComplete: true,
  };
}
```

**Why `indexOf` not regex:** `indexOf` handles partial streams (closing tag not yet arrived) and is cheaper on high-frequency re-renders during streaming.

## ThinkingBlock UX Pattern

- **Auto-expands** while streaming (`isThinkingComplete === false`)
- **Auto-collapses** 600ms after `</think>` arrives, unless user has manually toggled
- **Bouncing dots** shown in header while streaming, static icon when complete
- **Invisible scrollbar** on the content area (`[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`)
- **Max height `max-h-48`** with scroll — prevents long reasoning chains from pushing answer off-screen

## What Was Avoided

| Approach | Why avoided |
|---|---|
| Global `thinking` state field in LangGraph + `onStateChanged` | Thinking belongs to a specific message, not global state. Global state loses the association when multiple messages exist. |
| Stripping `<think>` on the backend before storing | Prevents frontend from ever rendering thinking content; also corrupts message history if user expects to re-read reasoning. |
| Regex `/<think>(.*?)<\/think>/` for streaming | Non-greedy match requires both tags present — fails silently during streaming, leaking raw `<think>` tags into react-markdown. |
| Passing `<think>` tags to react-markdown | CommonMark treats unknown HTML blocks unpredictably — may swallow content between tags or render it as plain text mixed into the answer. Always strip before passing to markdown renderer. |
| `emit_intermediate_state` for thinking | Correct for widget/canvas state (already used for `active_widgets`, `widget_state`), wrong for per-message content that has natural ownership. |
| Global floating `ThinkingBlock` outside message list | Loses message association; disappears on next turn; can't be reviewed after the fact. |

## Files

| File | Role |
|---|---|
| `src/components/ChatSidebar.tsx` | `parseMessage` + `ThinkingBlock` for sidebar chat |
| `src/components/chat.tsx` | `parseMessage` + `ThinkingBlock` for full-screen chat |

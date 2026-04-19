# Widget Design System & Composition Flows

Reference for all dumb widgets, their data contracts, and the 3 composition flows the orchestrator uses.

## Design Tokens

All widgets share these inline styles (no Tailwind inside widget files):

| Token | Value |
|-------|-------|
| Container bg | `rgba(255,255,255,0.55)` + `blur(18px)` backdrop |
| Border radius | `22px` |
| Font body | `'DM Sans', system-ui, sans-serif` |
| Font display | `'Cormorant Garamond', Georgia, serif` |
| Primary | `#6b5fa5` |
| Rose | `#c4899c` |
| Gold | `#c9a55a` |
| Sage | `#7d9a6e` |
| Text dark/med/light | `#2d2640` / `#524a65` / `#8a7fa0` |

Every widget starts with a **question label** (10px, uppercase, `#9b8fb8`) telling users what it answers.

## Widget Catalog

### Interpretation Widgets (New Dream flow)

| ID | Tool | Question | Props | Data Source |
|----|------|----------|-------|-------------|
| `current_dream` | `show_current_dream` | "What does this dream mean?" | `title`, `quote`, `meaning`, `subconscious_emotion`, `life_echo` | `dream_knowledge` + `community_dreams` chunks |
| `dream_atmosphere` | `show_dream_atmosphere` | "What symbols appeared?" | `center_symbol`, `satellites[]` | Symbols from `dream_knowledge` chunk text |
| `textbook_card` | `show_textbook_card` | "What does psychology say?" | `symbol`, `excerpt`, `author`, `source` | Direct quote from `dream_knowledge` chunk |
| `community_mirror` | `show_community_mirror` | "Who else dreams about this?" | `symbol`, `snippets[{text, emotions[], similarity}]` | `community_dreams` search results |
| `echoes_card` | `show_echoes_card` | "Have you dreamed this before?" | `echoes[{date, title, text}]` | `user_*_dreams` search results |
| `followup_chat` | `show_followup_chat` | "What to explore next?" | `dream_title`, `prompts[]` | LLM-generated from retrieved chunks |

### Symbol Query Widgets

| ID | Tool | Question | Props | Data Source |
|----|------|----------|-------|-------------|
| `interpretation_synthesis` | `show_interpretation_synthesis` | "What does [symbol] mean?" | `symbol`, `subtitle`, `paragraphs[{text, source}]` | Multi-namespace: personal/textbook/community |
| `symbol_cooccurrence_network` | `show_symbol_cooccurrence_network` | "What appears alongside this?" | `center_symbol`, `nodes[{label, weight}]` | `get_symbol_graph()` → `doc_relations` |
| `emotion_split` | `show_emotion_split` | "What emotions does this carry?" | `symbol`, `symbol_emotions[{label, value}]`, `overall_emotions[{label, value}]` | Search results + user profile emotion tags |

### Analytics Widgets (Temporal/Pattern flow)

| ID | Tool | Question | Props | Data Source |
|----|------|----------|-------|-------------|
| `emotional_climate` | `show_emotional_climate` | "How do you feel when you dream?" | _(none — self-contained)_ | Fetches `/api/user-profile` → `emotion_distribution` |
| `recurrence_card` | `show_recurrence_card` | "What keeps coming back?" | _(none — self-contained)_ | Fetches `/api/user-profile` → `recurrence` |
| `dream_streak` | `show_dream_streak` | "How consistent are you?" | `streak`, `last7[]` | User profile streak data |
| `heatmap_calendar` | `show_heatmap_calendar` | "When do you dream most?" | `month`, `data[][]` (7×N, values 0-4) | User profile heatmap |
| `top_symbol` | `show_top_symbol` | "What symbol dominates?" | `symbol`, `count`, `window`, `cooccurrences[{label, count}]` | User profile recurrence[0] |
| `stat_card` | `show_stat_card` | "How do you compare?" | `label`, `personal`, `baseline`, `description` | User profile + `corpus_stats` baselines |
| `lucidity_gauge` | `show_lucidity_gauge` | "How vivid are your dreams?" | `level` (0-1), `label` | User dream `lucidity_score` |

### De-emphasized (exist but not in default flows)

| ID | Notes |
|----|-------|
| `sources_panel` | Redundant — `source_chunk_ids` on each widget + WidgetPanel's Sources overlay covers this |
| `emotion_radar` | Overlaps with `emotional_climate` and `emotion_split` |

## Composition Flows

The orchestrator system prompt (in `backend/agent/graph.py` → `ORCHESTRATOR_PROMPT`) defines 3 flows. Each starts with retrieval, then spawns widgets.

### Flow 1: New Dream

```
User submits a dream → record_dream + 3× search_dreams → spawn:

  current_dream (replace_all)     ← hero card, half width
  dream_atmosphere (add)          ← symbol list, third width
  textbook_card (add)             ← Jung/Freud quote, third width
  community_mirror (add)          ← similar dreams, third width
  echoes_card (add)               ← user's past, third width
  emotional_climate (add)         ← emotion bars, half width
  recurrence_card (add)           ← recurring symbols, third width
  followup_chat (add)             ← go-deeper prompts, third width
  stat_card (add)                 ← you vs baseline, third width
```

### Flow 2: Symbol Query

```
"What does water mean?" → 2× search_dreams + get_symbol_graph → spawn:

  interpretation_synthesis (replace_all)   ← multi-source, half width
  textbook_card (add)                      ← academic quote
  symbol_cooccurrence_network (add)        ← network graph, half width
  community_mirror (add)                   ← community dreams
  emotion_split (add)                      ← emotional fingerprint
  followup_chat (add)                      ← follow-ups
```

### Flow 3: Temporal/Pattern Query

```
"Show my patterns" → spawn (self-contained widgets fetch own data):

  emotional_climate (replace_all)   ← emotion landscape, half width
  heatmap_calendar (add)            ← activity grid, half width
  dream_streak (add)                ← journal rhythm, third width
  top_symbol (add)                  ← dominant symbol, third width
  recurrence_card (add)             ← recurring symbols, third width
  stat_card (add)                   ← comparison metric, third width
```

## Page Layout

- **Persistent "You asked" bar** above widget grid — shows `lastUserMessage` state, updated on manual send, sessionStorage auto-send, and followup prompt clicks
- **Widget grid**: 6-column CSS grid with `gridAutoFlow: "dense"`, widgets sized by `layout.width` (full=6, half=3, third=2) and `layout.height` (compact/medium/tall/fill)
- **Floating chat pill**: fixed at bottom center, followup prompts rendered as tags above it (extracted from `followup_chat` widget data by `WidgetPanel`)
- **Focus mode**: clicking a widget card opens it in a portal above a dimmed backdrop with Sources/Close action panel

## File Structure

```
examples/dreams/widgets/
  ├── {widget-name}/
  │   ├── widget.config.ts    ← WidgetConfig: id, tool (name + parameters), layout
  │   └── WidgetName.tsx      ← React component (PascalCase of id)
  └── ...

src/components/
  ├── WidgetPanel.tsx          ← Grid layout, focus/portal, source overlay
  └── WidgetToolRegistrar.tsx  ← Registers dumb widgets as CopilotKit frontend tools

src/app/dashboard/page.tsx     ← Main dashboard: agent subscription, input, widget rendering

backend/agent/graph.py         ← ORCHESTRATOR_PROMPT with composition rules
```

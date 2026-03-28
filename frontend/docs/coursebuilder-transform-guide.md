# CourseBuilder → Widget Transform Guide

> For any LLM working on the CourseBuilder agent, quiz scaffolds, or the publish transform.
> Read this BEFORE writing any code.

---

## Overview

A teacher uses **CourseBuilder** (Omniscience) to create an interactive educational widget
through chat. The agent generates code that previews live in Sandpack. When the teacher
saves/publishes, a **mechanical transform** converts those files into a **self-contained
smart widget** in the copilot-scaffold platform.

The transform is DUMB. Zero intelligence. If data is needed at the widget end, the
CourseBuilder agent must generate it. Your job is to make the agent generate the right
shapes so the transform is just format conversion.

---

## What CourseBuilder Generates (Sandpack files)

When a teacher selects "quiz" format, the agent works with these files:

```
/App.js              ← Sandpack host (DO NOT EDIT — template-provided)
/Simulation.js       ← Re-export entry (DO NOT EDIT — template-provided)
/{name}_quiz.jsx     ← THE component — agent writes all rendering here
/state.json          ← Tracked state fields — agent defines what to track
/data.json           ← Domain content — questions, topic, answer key, agent personality
```

### /App.js (template-provided, never touched)

Reads state.json for initial values, reads data.json for questions, passes standard
props to Simulation.js. The agent NEVER modifies this file.

```js
import Simulation from "./Simulation";
import stateSchema from "./state.json";
import dataConfig from "./data.json";
// ... builds initial state from schema + injects data.json questions
// ... renders <Simulation state={state} onStateChange={onStateChange} onEvent={onEvent} />
```

### /Simulation.js (template-provided, never touched)

Just a re-export so Sandpack has a stable entry point:

```js
export { default } from "./photosynthesis_quiz";
// The agent updates this import path when it names the quiz file.
```

### /{name}_quiz.jsx (agent writes this — the creative output)

This is the actual interactive component. The agent has full creative freedom here —
any question types, any layout, any animations, images, drag interactions, etc.

**CRITICAL CONTRACT — the component receives these props:**

```jsx
export default function PhotosynthesisQuiz({ state, onStateChange, onEvent }) {
  // state     — current tracked state (from state.json initials + user interactions)
  // onStateChange(patch) — merge partial update into state
  // onEvent({ type, data }) — emit events (for reactions system)
}
```

**The component OWNS its questions data.** Questions are defined as a const inside the
component (or imported from data.json via the App.js host — either works in Sandpack).
The key point: questions are part of the RENDERING, not part of tracked state.

**State reads from `state` prop, writes via `onStateChange(patch)`:**

```jsx
const { currentIndex, answers, results, phase, score } = state;

const handleSelect = (key) => {
  const correct = key === QUESTIONS[currentIndex].correctAnswer;
  onStateChange({
    answers: { ...answers, [String(currentIndex)]: key },
    results: { ...results, [String(currentIndex)]: correct ? "correct" : "wrong" },
    score: correct ? score + 1 : score,
  });
};
```

**The agent should use framer-motion for animations** (available in Sandpack via template
dependencies). Inline styles only (no Tailwind in Sandpack).

### /state.json (agent writes this — the state contract)

Defines every field the widget tracks. This is the **single source of truth** for what
becomes `TrackedStateField` entries and spawn tool return values at transform time.

**Required shape:**

```json
{
  "_schema": "description of the format for future reference",
  "state": {
    "fieldName": {
      "type": "number | string | object | array",
      "initial": <initial value>,
      "description": "Human-readable description — shown to the companion agent"
    }
  },
  "events": {
    "eventName": {
      "description": "When this fires",
      "data": { "fieldName": "type" }
    }
  }
}
```

**Example for a quiz:**

```json
{
  "state": {
    "currentIndex": {
      "type": "number",
      "initial": 0,
      "description": "Zero-based index of the active question"
    },
    "answers": {
      "type": "object",
      "initial": {},
      "description": "Map of question index (string) → selected option key"
    },
    "results": {
      "type": "object",
      "initial": {},
      "description": "Map of question index (string) → 'correct' or 'wrong'"
    },
    "phase": {
      "type": "string",
      "initial": "in_progress",
      "description": "Quiz phase: in_progress, review, or complete"
    },
    "score": {
      "type": "number",
      "initial": 0,
      "description": "Number of correct answers so far"
    },
    "totalQuestions": {
      "type": "number",
      "initial": 5,
      "description": "Total number of questions"
    }
  },
  "events": {
    "question_answered": {
      "description": "Fired when a student selects an answer",
      "data": { "questionIndex": "number", "isCorrect": "boolean" }
    }
  }
}
```

**Rules:**
- Every field the companion agent should be able to see or discuss → put it here
- `description` is critical — it becomes the agent's understanding of each field
- `initial` is critical — it becomes the spawn tool's return value
- Fields the agent doesn't need to track (local animation state, etc.) stay in the TSX as useState

### /data.json (agent writes this — domain knowledge for the companion agent)

Contains everything the companion agent needs to know to help the student. This does
NOT go into the component — it goes into `prompt.md` at transform time.

**Required shape:**

```json
{
  "topic": {
    "id": "photosynthesis",
    "title": "光合作用",
    "level": 1,
    "ageRange": [8, 14],
    "knowledgeContext": "Detailed domain knowledge the agent should have...",
    "pedagogicalPrompt": "How to teach this topic, what analogies to use..."
  },
  "answerKey": [
    { "questionId": "q1", "correctAnswer": "B", "explanation": "Because..." },
    { "questionId": "q2", "correctAnswer": "B", "explanation": "Because..." }
  ],
  "agentPersonality": "Friendly science tutor who uses simple analogies...",
  "reactions": []
}
```

**Rules:**
- `knowledgeContext` — everything the companion agent needs to teach this topic
- `answerKey` — so the agent can check answers and give hints without seeing the TSX
- `agentPersonality` — tone, teaching style, language level
- The agent should write this THOROUGHLY — this is the companion agent's entire brain

---

## The Transform (mechanical, no intelligence)

When a teacher publishes, the transform reads the 4 files and produces a widget directory.

### Input → Output mapping

```
CourseBuilder file          Transform step              Scaffold output
──────────────────          ──────────────              ───────────────

/{name}_quiz.jsx     ──→   Swap state wiring header    widgets/{name}_quiz/{Name}Quiz.tsx
                           (15 lines: props → useAgent)

/state.json          ──→   For each field:             widgets/{name}_quiz/config.py
                           - TrackedStateField(key, description)
                           - spawn tool return[key] = initial

/data.json           ──→   Template string:            widgets/{name}_quiz/prompt.md
                           - topic.knowledgeContext
                           - answerKey formatted
                           - agentPersonality
                           - tool descriptions

(generated)          ──→   From naming convention:      widgets/{name}_quiz/widget.config.ts
                                                        widgets/{name}_quiz/index.ts
```

### Transform step 1: TSX wiring swap

The ONLY code change. Replace the props-based header with the useAgent hook.

**Before (Sandpack props version):**
```jsx
export default function PhotosynthesisQuiz({ state, onStateChange, onEvent }) {
  const { currentIndex, answers, results, phase, score } = state;
  // ... rest of component
```

**After (widget protocol version):**
```tsx
import { useCallback } from "react";
import { useAgent as useV2Agent } from "@copilotkitnext/react";

export default function PhotosynthesisQuiz() {
  const { agent } = useV2Agent({ agentId: "orchestrator" });
  const ws = (agent.state as any)?.widget_state ?? {};

  const currentIndex: number = ws.currentIndex ?? 0;
  const answers: Record<string, string> = ws.answers ?? {};
  const results: Record<string, string> = ws.results ?? {};
  const phase: string = ws.phase ?? "in_progress";
  const score: number = ws.score ?? 0;

  const updateState = useCallback((patch: Record<string, unknown>) => {
    const cur = (agent.state as any) ?? {};
    agent.setState({ ...cur, widget_state: { ...(cur.widget_state ?? {}), ...patch } });
    fetch("/api/widget-state", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: agent.threadId, patch }),
    }).catch(() => {});
  }, [agent]);
  // ... rest of component (UNCHANGED)
```

**And replace all `onStateChange(` with `updateState(`.**
**And remove all `onEvent(` calls** (the agent sees state changes directly).

That's it. The rest of the component — all rendering, all interaction logic, all
styles — transfers unchanged.

### Transform step 2: config.py from state.json

Read state.json, produce Python:

```python
from langchain_core.tools import tool
from backend.agent.subagents.registry import SubagentConfig, TrackedStateField
from examples.textbook_content.shared_tools import quiz_domain_tools

@tool
def show_{name}_quiz() -> dict:
    """Show the {Title} Quiz. [Layout: full width, fill height]"""
    return {
        # For each field in state.json.state:
        #   "key": field.initial
        "currentIndex": 0,
        "answers": {},
        "results": {},
        "phase": "in_progress",
        "score": 0,
        "totalQuestions": 5,
    }

SUBAGENT = SubagentConfig(
    id="{name}_quiz",
    spawn_tool=show_{name}_quiz,
    domain_tools=quiz_domain_tools,
    prompt=_PROMPT,
    intro_message="...",
    tracked_state=[
        # For each field in state.json.state:
        #   TrackedStateField("key", "description")
        TrackedStateField("currentIndex", "Zero-based index of the active question"),
        TrackedStateField("answers", "Map of question index → selected option key"),
        # ...
    ],
)
```

### Transform step 3: prompt.md from data.json

Template:

```markdown
You are a {agentPersonality}.

## Your Knowledge

{topic.knowledgeContext}

## Answer Key

{for each entry in answerKey:}
- {questionId}: {correctAnswer} — {explanation}

## How to Help

- If a student is stuck, give a HINT — do not reveal the answer
- After they answer, briefly explain WHY
- Be encouraging regardless of right/wrong
- Use age-appropriate language (ages {topic.ageRange})
- Call handoff_to_orchestrator when the student wants to leave

## Tools

- set_page(index): Jump to a specific question
- go_to_review(): Show the results screen
- restart(): Reset everything
- handoff_to_orchestrator(): Return to main assistant
```

### Transform step 4: widget.config.ts (generated from naming)

```ts
import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "{name}_quiz",
  tool: {
    name: "show_{name}_quiz",
    description: "Show the {Title} Quiz. [Layout: full width, fill height]",
    parameters: {},
  },
  agent: "{name}_quiz",
  layout: { width: "full", height: "fill" },
};

export default config;
```

### Transform step 5: index.ts + barrel registration

```ts
// widgets/{name}_quiz/index.ts
export { default } from "./{Name}Quiz";
export { default as config } from "./widget.config";
```

Add to `examples/textbook_content/index.ts`:
```ts
export { default as {Name}Quiz, config as {name}QuizConfig } from "./widgets/{name}_quiz";
```

The `__init__.py` auto-discovers from `config.py` — no manual Python registration needed.

---

## Scaffold Directory Structure (output)

After transform, one widget = one self-contained directory:

```
examples/textbook_content/
├── __init__.py              ← Auto-discovers widgets/*/config.py (never edit)
├── shared_tools.py          ← Generic tools: set_page, go_to_review, restart
├── tools.py                 ← Empty (spawn tools live in each widget's config.py)
├── index.ts                 ← Barrel export (add one line per widget)
└── widgets/
    └── photosynthesis_quiz/           ← One dir per published widget
        ├── PhotosynthesisQuiz.tsx     ← Component (from {name}_quiz.jsx)
        ├── config.py                  ← SubagentConfig + spawn tool (from state.json)
        ├── prompt.md                  ← Agent knowledge (from data.json)
        ├── widget.config.ts           ← Frontend config (generated)
        ├── index.ts                   ← Re-exports (generated)
        └── __init__.py                ← Empty package marker
```

---

## Naming Conventions

All derived from one root: the quiz file name (e.g. `photosynthesis_quiz`).

| Thing | Format | Example |
|-------|--------|---------|
| Quiz JSX file (CourseBuilder) | `/{name}_quiz.jsx` | `/photosynthesis_quiz.jsx` |
| Widget directory | `widgets/{name}_quiz/` | `widgets/photosynthesis_quiz/` |
| TSX component file | `{PascalCase}.tsx` | `PhotosynthesisQuiz.tsx` |
| Component export name | `PascalCase` | `PhotosynthesisQuiz` |
| widget.config.ts `id` | `snake_case` | `photosynthesis_quiz` |
| widget.config.ts `tool.name` | `show_{id}` | `show_photosynthesis_quiz` |
| widget.config.ts `agent` | same as `id` | `photosynthesis_quiz` |
| SubagentConfig `id` | same as `id` | `photosynthesis_quiz` |
| Spawn tool function | `show_{id}` | `show_photosynthesis_quiz` |
| Barrel config export | `{camelCase}Config` | `photosynthesisQuizConfig` |

---

## What the CourseBuilder Agent MUST Generate

When a teacher says "create a photosynthesis quiz", the agent must produce:

1. **`/{name}_quiz.jsx`** — Full interactive component with:
   - Questions as a const inside the file (or structured data)
   - Props contract: `{ state, onStateChange, onEvent }`
   - Reads tracked state from `state` prop
   - Writes state via `onStateChange(patch)`
   - Fires events via `onEvent({ type, data })`
   - Rich visuals: images, big buttons, animations, feedback
   - TODO: search pre-built component library for UI primitives

2. **`/state.json`** — Every tracked field with:
   - `type` — data type
   - `initial` — starting value (becomes spawn tool return)
   - `description` — human-readable (becomes TrackedStateField description for agent)

3. **`/data.json`** — Everything the companion agent needs:
   - `topic` — id, title, level, ageRange, knowledgeContext, pedagogicalPrompt
   - `answerKey` — every question's correct answer + explanation
   - `agentPersonality` — how the agent should behave and talk
   - `reactions` — optional event-triggered responses

4. **Update `/Simulation.js`** — Change the re-export path:
   ```js
   export { default } from "./{name}_quiz";
   ```

**The agent prompt must explicitly instruct these outputs.** If a field is missing, the
transform breaks. The transform has no fallback intelligence.

---

## Sync Protocol: How Frontend ↔ Agent Stay in Sync

In the scaffold widget:

1. **Spawn** — Orchestrator calls `show_{name}_quiz()` → returns initial widget_state
   → skeleton stores in LangGraph checkpoint

2. **Student interacts** — Component calls `updateState(patch)`:
   - `agent.setState(...)` — instant frontend update
   - `POST /api/widget-state` — persists patch to LangGraph checkpoint

3. **Agent reads** — On next agent turn, skeleton reads checkpoint, injects current
   widget_state values into the system prompt under "Current widget state"

4. **Agent writes** — Agent calls domain tools (e.g. `set_page(3)`) → tool returns
   dict (e.g. `{"currentIndex": 3}`) → skeleton merges into widget_state → frontend
   sees the change via `agent.state.widget_state`

Both directions work. Student clicks → agent sees updated state. Agent calls tool →
student sees updated UI. The tracked_state declarations tell the skeleton which fields
to show the agent.

---

## Shared Domain Tools (quiz type)

All quiz widgets share these tools via `shared_tools.py`:

- **`set_page(index)`** — Jump to question by index. Agent must check `currentIndex`
  and `totalQuestions` before calling. Returns `{"currentIndex": index, "phase": "in_progress"}`.

- **`go_to_review()`** — Switch to review screen. Returns `{"phase": "review"}`.

- **`restart()`** — Reset all state. Returns `{"currentIndex": 0, "answers": {}, "results": {}, "score": 0, "phase": "in_progress"}`.

- **`handoff_to_orchestrator()`** — Auto-injected by skeleton, not in shared_tools.

Non-quiz widget types (labs, lessons, dialogues) will have their own shared_tools with
different generic tools (e.g. `set_variable`, `advance_scene`, etc.).

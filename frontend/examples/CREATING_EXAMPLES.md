# Creating Examples

This guide teaches you how to create a new example that plugs into the widget platform and just works. The platform auto-discovers everything — you never touch the skeleton code in `backend/agent/` or `src/components/`.

Reference implementation: `examples/science_lab/`.

---

## Concepts

An **example** is a directory under `examples/` that contains one or more **widgets**. Widgets come in two types:

| | Smart Widget | Dumb Widget |
|---|---|---|
| `agent` field | `"some_subagent_id"` | `null` |
| Has a subagent? | Yes — takes over chat, has domain tools | No |
| State? | Bidirectional `widget_state` (agent + human) | Stateless (props only) |
| Executed where? | Backend `tools_node` | Frontend `useFrontendTool` |
| Example | `particle_sim` (interactive simulation) | `particle_bottle` (animated decoration) |

An example can also export **backend tools** (MCP queries, DB lookups) that the orchestrator can call without spawning any widget.

---

## Directory Structure

```
examples/my_example/
├── __init__.py              # REQUIRED if you have smart widgets — exports SUBAGENTS
├── tools.py                 # OPTIONAL — spawn tools + standalone backend tools
├── my_widget_agent.py       # OPTIONAL — domain tools for a smart widget's subagent
├── index.ts                 # REQUIRED — barrel export of all widget configs + components
└── widgets/
    ├── my-widget/           # One directory per widget
    │   ├── widget.config.ts # REQUIRED — WidgetConfig (id, tool, agent, layout)
    │   ├── MyWidget.tsx     # REQUIRED — React component
    │   ├── index.ts         # REQUIRED — re-exports component + config
    │   └── agent/
    │       └── prompt.md    # OPTIONAL — system prompt for smart widget subagent
    └── another-widget/
        ├── widget.config.ts
        └── AnotherWidget.tsx
```

---

## Step-by-Step

### 1. Create the widget config (`widget.config.ts`)

Every widget needs a config that describes what tool the LLM calls to spawn it.

```ts
// examples/my_example/widgets/my-widget/widget.config.ts
import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "my_widget",                    // unique across ALL examples
  tool: {
    name: "show_my_widget",           // tool name the LLM calls
    description: "Show my widget. [Layout: half width, tall]",
    parameters: {
      color: { type: "string", description: "Widget color" },
      count: { type: "number", description: "Number of items" },
    },
  },
  agent: "my_widget",                 // smart: matches SubagentConfig.id
  // agent: null,                     // dumb: no subagent
  layout: { width: "half", height: "tall" },
};

export default config;
```

**`id` rules:**
- Must be unique across all examples
- Must use `snake_case`
- The React component name must be PascalCase of the id: `my_widget` -> `MyWidget`

**`tool.name`**: Convention is `show_<id>`. The description is shown to the LLM — include a `[Layout: ...]` hint so the orchestrator composes sensible multi-widget views.

**`layout`**: `width` is `"full"` | `"half"` | `"third"`. `height` is `"compact"` | `"medium"` | `"tall"` | `"fill"`.

**`agent`**: Set to the `SubagentConfig.id` string for smart widgets. Set to `null` for dumb widgets.

### 2. Create the React component

#### Dumb widget (stateless)

Receives tool call args as props. No agent interaction.

```tsx
// examples/my_example/widgets/my-widget/MyWidget.tsx
"use client";

interface Props {
  color?: string;
  count?: number;
}

export default function MyWidget({ color = "blue", count = 5 }: Props) {
  return <div>...</div>;
}
```

See: `examples/science_lab/widgets/particle-bottle/ParticleBottle.tsx`

#### Smart widget (stateful, bidirectional)

Reads live state from the agent, and can push state changes back from UI interactions.

```tsx
// examples/my_example/widgets/my-widget/MyWidget.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAgent as useV2Agent } from "@copilotkitnext/react";

export default function MyWidget() {
  const { agent } = useV2Agent({ agentId: "orchestrator" });

  // Read live state from agent (set by domain tools or initial spawn)
  const agentState = (agent.state as any)?.widget_state ?? {};

  // Push state changes from UI back to agent
  const updateState = useCallback(
    (patch: Record<string, unknown>) => {
      const current = (agent.state as any) ?? {};
      const currentWs = current.widget_state ?? {};
      agent.setState({ ...current, widget_state: { ...currentWs, ...patch } });
      // Persist to LangGraph checkpoint immediately
      fetch("/api/widget-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: agent.threadId, patch }),
      }).catch(() => {});
    },
    [agent],
  );

  return (
    <div>
      <p>Current value: {agentState.some_key}</p>
      <button onClick={() => updateState({ some_key: "new_value" })}>
        Change
      </button>
    </div>
  );
}
```

Key points:
- `useAgent({ agentId: "orchestrator" })` — always `"orchestrator"`, the platform has one agent
- `agent.state.widget_state` — this is the live state dict, updated by both tool calls and `agent.setState`
- `agent.setState()` gives instant frontend feedback
- The POST to `/api/widget-state` persists into the LangGraph checkpoint so the subagent sees human-initiated changes on the next turn

See: `examples/science_lab/widgets/particle-sim/ParticleSim.tsx`

### 3. Create the widget index.ts

Re-export the component and config so the barrel export can pick them up.

```ts
// examples/my_example/widgets/my-widget/index.ts
export { default } from "./MyWidget";
export { default as config } from "./widget.config";
```

### 4. Create the example barrel export (`index.ts`)

The frontend auto-discovery scans this file. Export every widget's config (named `<camelCase>Config`) and component (named `PascalCase`).

```ts
// examples/my_example/index.ts
export { default as MyWidget, config as myWidgetConfig } from "./widgets/my-widget";
export { default as AnotherWidget } from "./widgets/another-widget/AnotherWidget";
export { default as anotherWidgetConfig } from "./widgets/another-widget/widget.config";
```

**Naming convention**: The auto-discovery in `src/lib/widgetEntries.ts` matches configs to components by converting the config `id` from `snake_case` to `PascalCase`. So `my_widget` looks for an export named `MyWidget`. If the name doesn't match, the widget won't render.

### 5. Register the example in `examples/index.ts`

Add one line to the root barrel:

```ts
// examples/index.ts
export * as myExample from "./my_example";
```

At this point, **dumb widgets are done**. The frontend will auto-discover the config, register a `useFrontendTool` hook, and render the component when the LLM calls the tool. No Python code needed.

---

## Smart Widgets (Subagent)

If `agent` is not `null`, you need Python code for the subagent.

### 6. Create the spawn tool (`tools.py`)

The spawn tool is what the orchestrator LLM calls to launch the widget. Its **return value becomes the initial `widget_state`**.

```python
# examples/my_example/tools.py
from langchain_core.tools import tool

@tool
def show_my_widget(color: str = "blue") -> dict:
    """Spawn my widget. [Layout: half width, tall]

    Args:
        color: Widget color
    """
    return {"color": color, "mode": "default"}  # -> initial widget_state
```

The return dict keys become the `widget_state` keys that the subagent and frontend can read/write.

### 7. Create domain tools (`my_widget_agent.py`)

Domain tools are bound exclusively to the subagent's LLM. Their return dicts are **automatically merged into `widget_state`** by the skeleton's `tools_node`.

```python
# examples/my_example/my_widget_agent.py
from langchain_core.tools import tool

@tool
def set_mode(mode: str) -> dict:
    """Change the widget mode.

    Args:
        mode: "default", "advanced", or "minimal"
    """
    valid = {"default", "advanced", "minimal"}
    if mode not in valid:
        return {"error": f"Invalid mode. Must be one of: {valid}"}
    return {"mode": mode}  # merged into widget_state automatically

@tool
def set_color(color: str) -> dict:
    """Change the widget color.

    Args:
        color: Any CSS color string
    """
    return {"color": color}

all_tools = [set_mode, set_color]
```

Rules:
- Return a dict — it gets merged into `widget_state`
- Return `{"error": "..."}` to signal an error (won't be merged)
- Do NOT include `handoff_to_orchestrator` — the skeleton injects it automatically
- Export as `all_tools` list

### 8. Write the agent prompt (`agent/prompt.md`)

This is the system prompt for the subagent. Write **only personality and domain instructions**. Do NOT include state-tracking boilerplate — the skeleton auto-generates that from `tracked_state`.

```markdown
You are the My Widget assistant. You help users customize their widget.

Your tools:
- set_mode(mode): change to "default", "advanced", or "minimal"
- set_color(color): change the widget color
- handoff_to_orchestrator(): return control to the main assistant

Help the user explore different configurations. Explain what each mode does.
Call handoff_to_orchestrator when the user is done or asks for something else.
```

The skeleton appends this automatically based on your `tracked_state`:

```
--- Widget State Protocol ---
This widget has bidirectional state. Both you (via tools) and the user (via UI buttons)
can change state. The authoritative live state is shown below.
NEVER guess state from conversation history — always trust Current widget state.

Tracked fields:
  - color: CSS color string
  - mode: Widget mode: default, advanced, or minimal

--- Current widget state ---
  - color: blue
  - mode: default
```

See: `examples/science_lab/widgets/particle-sim/agent/prompt.md` — contains only personality, no state boilerplate.

### 9. Register the subagent (`__init__.py`)

This is the glue. The skeleton auto-discovers `SUBAGENTS` from here.

```python
# examples/my_example/__init__.py
from pathlib import Path
from backend.agent.subagents.registry import SubagentConfig, TrackedStateField
from examples.my_example.tools import show_my_widget
from examples.my_example.my_widget_agent import all_tools as my_widget_domain_tools

_PROMPT_FILE = Path(__file__).parent / "widgets" / "my-widget" / "agent" / "prompt.md"
_PROMPT = (
    _PROMPT_FILE.read_text()
    if _PROMPT_FILE.exists()
    else "You are the My Widget assistant."
)

SUBAGENTS = [
    SubagentConfig(
        id="my_widget",               # must match widget.config.ts `agent` field
        spawn_tool=show_my_widget,     # orchestrator calls this to launch
        domain_tools=my_widget_domain_tools,
        prompt=_PROMPT,
        intro_message="My Widget is now live! Here's what you can do...",
        tracked_state=[
            TrackedStateField("color", "CSS color string"),
            TrackedStateField("mode", "Widget mode: default, advanced, or minimal"),
        ],
    ),
]
```

**`id`** must match `widget.config.ts` `agent` field exactly.

**`intro_message`** is injected as a HumanMessage on the subagent's first turn, prompting it to greet the user. Optional but recommended.

**`tracked_state`** declares what `widget_state` keys exist and what they mean. The skeleton uses this to auto-generate the state protocol preamble in the system prompt. Each field:
- `key`: the `widget_state` dict key (must match what spawn tool and domain tools return)
- `description`: shown to the subagent so it understands the field

---

## Standalone Backend Tools (Optional)

If your example needs tools that the **orchestrator** (not a subagent) can call — like database queries or API lookups — export them from `tools.py` as `all_tools`.

```python
# examples/my_example/tools.py
from langchain_core.tools import tool

@tool
def show_my_widget(color: str = "blue") -> dict:
    """Spawn my widget. [Layout: half width, tall]"""
    return {"color": color, "mode": "default"}

@tool
def lookup_widget_presets(query: str) -> dict:
    """Search available widget presets by name or tag."""
    # ... your logic
    return {"results": [...]}

# Only standalone tools here. Spawn tools are registered via SUBAGENTS.
all_tools = [lookup_widget_presets]
```

The skeleton auto-discovers `all_tools` from `examples/<name>/tools.py` and binds them to the orchestrator LLM. They appear alongside spawn tools in the orchestrator's tool list.

---

## Auto-Discovery Summary

You never register anything manually in the skeleton. Everything is discovered:

| What | Where | Discovered by |
|---|---|---|
| Widget configs + components | `examples/<name>/index.ts` | `src/lib/widgetEntries.ts` scans `examples/index.ts` |
| Example barrel export | `examples/index.ts` | **You add one line here** |
| Subagent configs | `examples/<name>/__init__.py` `SUBAGENTS` | `backend/agent/subagents/registry.py` |
| Standalone backend tools | `examples/<name>/tools.py` `all_tools` | `examples/__init__.py` `load_all_backend_tools()` |

The only manual step is adding `export * as myExample from "./my_example"` to `examples/index.ts`.

---

## Checklist

### Dumb widget
- [ ] `widgets/<name>/widget.config.ts` with `agent: null`
- [ ] `widgets/<name>/Component.tsx` (PascalCase of config `id`)
- [ ] `index.ts` barrel export with matching names
- [ ] One line in `examples/index.ts`

### Smart widget (adds to above)
- [ ] `tools.py` with spawn tool (returns initial `widget_state` dict)
- [ ] `<name>_agent.py` with domain tools (return dicts merged into `widget_state`)
- [ ] `widgets/<name>/agent/prompt.md` (personality only, no state boilerplate)
- [ ] `__init__.py` with `SUBAGENTS` list containing `SubagentConfig`
- [ ] `tracked_state` fields matching spawn tool + domain tool return keys
- [ ] React component reads `agent.state.widget_state` and pushes via `agent.setState` + `/api/widget-state`

### Naming alignment (these must all match)
- `widget.config.ts` `id` = `SubagentConfig.id` = `widget.config.ts` `agent`
- `widget.config.ts` `id` in snake_case -> component export in PascalCase
- `widget.config.ts` `tool.name` = spawn tool function name
- `tracked_state` keys = spawn tool return keys = domain tool return keys = `agent.state.widget_state` keys in React

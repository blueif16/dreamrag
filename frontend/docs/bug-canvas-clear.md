# Canvas Clear — Backend Tool → Frontend State Pattern

## How it works

The agent can remove widgets from the canvas via a backend tool (`clear_canvas`) that writes directly into LangGraph state. The frontend subscribes to state changes and calls `setSpawned` accordingly.

```
[1] LLM calls clear_canvas(widget_ids?)
      ↓  routed to backend (clear_canvas is in backend_tool_names)

[2] tools_node (graph.py) — intercepts before executing
      ↓  writes state["canvas_clear"] = { ids: [...] | null, seq: <timestamp> }
      ↓  adds ToolMessage with result (LLM sees confirmation)

[3] AG-UI protocol streams updated state to frontend
      ↓  onStateChanged fires with new canvas_clear signal

[4] page.tsx useEffect — agent.subscribe({ onStateChanged })
      ↓  reads canvas_clear.ids
      ↓  ids null/empty → setSpawned([])           (clear all)
      ↓  ids present   → setSpawned(prev.filter())  (remove specific)
```

## Why backend not frontend tool

A `useFrontendTool` for `clear_canvas` never reaches the LLM reliably because it isn't registered through the `WidgetToolRegistrar` pattern (which mounts tools at page root). A backend tool is always visible to the LLM via `backend_tools` and routes through the custom `tools_node` which can write arbitrary state.

## Usage by the agent

- **Switch views**: `clear_canvas()` (no args) + new widget tools — in one response
- **Replace one widget**: `clear_canvas(widget_ids=["user_card"])` + `show_user_card(...)` — in one response
- **Add alongside existing**: just call the new widget tool, no clear needed

## Files changed

| File | Change |
|---|---|
| `backend/agent/tools.py` | Added `clear_canvas` backend tool |
| `backend/agent/graph.py` | Custom `tools_node` intercepts call, writes `canvas_clear` to state |
| `backend/agent/state.py` | Added `canvas_clear: Optional[Dict]` field |
| `src/app/(chat)/page.tsx` | `useEffect` subscribes to `onStateChanged`, reacts to `canvas_clear` |

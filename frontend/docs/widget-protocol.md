# Widget Protocol — Smart vs Dumb Widgets

Documents the full lifecycle for both widget types: how the LLM spawns them, how state is tracked, and how the frontend renders and clears them.

---

## Widget Types

| | Smart widget | Dumb widget |
|---|---|---|
| `agent` field in config | `string` (subagent ID) | `null` |
| Spawn mechanism | Backend `tools_node` | Frontend `useFrontendTool` |
| State tracking | `widget_state` (live, mutable) | `active_widgets` (written by `_sync_dumb_widgets` on next turn) |
| Interactive after spawn | Yes — subagent takes over chat | No — display-only |
| Example | `particle_sim` | `red_flower`, `firework` |

---

## Smart Widget Lifecycle

```
[1] LLM calls spawn tool (e.g. show_particle_sim)
      ↓  spawn tool is in _backend_tool_names
      ↓  route_orchestrator → "tools"
[2] tools_node runs on the SAME turn:
      - writes active_widgets: [{id, type:"smart", props}]
      - writes widget_state: <initial state from spawn_tool.func()>
      - sets focused_agent = cfg.id
      - injects cfg.intro_message → pending_agent_message
      ↓  returns state patch
[3] route_after_tools:
      - if pending_agent_message → route to subagent node for greeting
      - else → END (subagent activates on next user turn)
[4] STATE_SNAPSHOT emitted with updated active_widgets + widget_state
[5] onStateChanged on frontend:
      - mirrors active_widgets + widget_state into spawned[]
      - widget rendered with props merged with widget_state
[6] Subsequent user messages routed to subagent (focused_agent)
      - subagent LLM calls domain tools → tools_node → widget_state updated
      - STATE_SNAPSHOT streams updated widget_state live
[7] User or subagent calls handoff_to_orchestrator
      - focused_agent cleared, orchestrator resumes
```

---

## Dumb Widget Lifecycle

```
[1] LLM calls frontend tool (e.g. show_red_flower)
      ↓  NOT in _backend_tool_names
      ↓  route_orchestrator → END (AG-UI protocol handles it)
[2] AG-UI sends tool call event to client
[3] useFrontendTool handler fires on client:
      - calls onOptimisticRender(widget) → sets expectedDumbIds ref
      - calls setSpawned() with new widget (optimistic render, immediate)
      - returns JSON: {spawned:true, widgetId, operation, props}
[4] Client appends ToolMessage with that JSON to agent.messages
[5] Client fires follow-up runAgent
[6] Backend receives follow-up:
      - langgraph_default_merge_state merges ToolMessage into graph state
      - aupdate_state writes messages into checkpointer
[7] orchestrator_node runs:
      - LLM sees ToolMessage, produces final text response
      - _sync_dumb_widgets(state, patch) reads ToolMessage content:
          * {spawned:true, widgetId, operation, props} → upserts active_widgets
          * operation="replace_all" → active_widgets = [new_widget]
          * operation="add"        → appends if not already present
          * operation="replace_one" → removes same id then appends
      - patch now contains updated active_widgets
[8] Final STATE_SNAPSHOT emitted with active_widgets containing dumb widget
[9] onStateChanged on frontend:
      - checks expectedDumbIds ref
      - skips any snapshot where NOT all expected IDs are present
        (intermediate snapshots reflect stale graph state pre-sync)
      - once confirmed: clears expectedDumbIds, calls setSpawned(nextSpawned)
```

---

## Canvas Operations (`operation` param)

All spawn tools (smart and dumb) accept an `operation` parameter (default `replace_all`).

| Value | Behaviour |
|---|---|
| `replace_all` | Clear all existing widgets, show only this one |
| `add` | Add alongside existing widgets |
| `replace_one` | Remove only this widget's slot if present, then add |

The `_with_operation_param` wrapper in `graph.py` adds this param to all smart spawn tools. The `useFrontendTool` handler in `WidgetToolRegistrar.tsx` reads it from args and applies the same logic optimistically.

---

## clear_canvas

```
[1] LLM calls clear_canvas(widget_ids?)
      ↓  in skeleton_tools → _backend_tool_names
      ↓  route_orchestrator → "tools"
[2] tools_node: filters active_widgets by ids (or clears all)
[3] STATE_SNAPSHOT: active_widgets = [] (or subset)
[4] onStateChanged: expectedDumbIds is empty, trusts backend → setSpawned([])
```

Works for both smart and dumb widgets because both are now tracked in `active_widgets`.

---

## Why the 1-turn delay for dumb widgets

Smart widget spawn tools go through `tools_node` which can write `active_widgets` synchronously on the same graph turn as the LLM call. Dumb widget tool calls are routed directly to the client via AG-UI — the graph ends that turn without running `tools_node`. The client executes the handler, appends the result as a `ToolMessage`, and fires a follow-up `runAgent`. Only on that follow-up turn does `orchestrator_node` run `_sync_dumb_widgets` and write `active_widgets`.

This creates a window where the backend emits intermediate `STATE_SNAPSHOT` events with stale `active_widgets` (e.g. still showing the previous widget, or empty). The `expectedDumbIds` ref in `page.tsx` guards against this by skipping snapshots that don't confirm the optimistically-rendered widget IDs.

---

## Key Files

| File | Role |
|---|---|
| `src/types/state.ts` | `ActiveWidget`, `WidgetConfig`, `OrchestratorState` types |
| `src/lib/widgetEntries.ts` | Auto-discovers all widget configs + components from examples |
| `src/app/(chat)/page.tsx` | `onStateChanged` subscriber, `expectedDumbIds` latch, `WidgetToolRegistrar` mounts |
| `src/components/WidgetToolRegistrar.tsx` | `useFrontendTool` registration, optimistic render, `onOptimisticRender` callback |
| `backend/agent/graph.py` | `_sync_dumb_widgets`, `tools_node`, `_with_operation_param`, `route_after_tools` |
| `backend/agent/state.py` | `OrchestratorState` with `active_widgets`, `widget_state`, `focused_agent` |
| `backend/agent/subagents/registry.py` | `SubagentConfig` dataclass, auto-discovery from examples |
| `examples/*/widgets/*/widget.config.ts` | Per-widget config: id, tool name/params, agent (null=dumb) |
| `examples/*/__init__.py` | Exports `SUBAGENTS` list for registry auto-discovery |

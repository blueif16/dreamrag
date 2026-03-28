# Widget Protocol Redesign — Investigation Prompt

## Context

The current widget management system has a confusing split between "smart" and "dumb" widgets. The backend only tracks smart widgets in `active_widgets`/`widget_state`, while dumb widgets manage themselves via local `setSpawned` calls that bypass all backend state. This makes operations like `clear=True` unreliable (only affects smart widgets) and prevents the model from seeing the full canvas state to make informed decisions.

## Current Problem

When model calls `show_firework(clear=True)`:
1. Backend sends `canvas_clear={ids:None}` + `active_widgets=["firework"]`
2. Frontend subscription clears `spawned=[]`
3. But dumb widget handlers bypass this and just append to `spawned`
4. Previous dumb widgets persist

## Goals

Design a **unified widget protocol** where:

1. **Single source of truth**: ALL widgets (smart and dumb) are tracked in backend state (`active_widgets`). Frontend `spawned` is derived entirely from backend state.

2. **Model visibility**: The model can query `active_widgets` to see every widget on canvas, including dumb ones, enabling it to make informed decisions about replacements, stacking, etc.

3. **Explicit operations**: `clear=True`, `replace`, `add`, `remove` are first-class operations the model can call. No hidden side effects.

4. **No frontend special-casing**: Dumb widgets use the same state management as smart widgets. Their handlers should update backend state, not bypass it with local `setSpawned`.

5. **Extensible**: New operations (e.g., `replace_widget`, `move_widget`, `stack_widgets`) should be easy to add.

## Investigation Tasks

1. **Read the current implementation**:
   - `backend/agent/graph.py` — how `active_widgets`, `widget_state`, `canvas_clear` work
   - `src/app/(chat)/page.tsx` — subscription callback, smart/dumb split
   - `src/components/WidgetToolRegistrar.tsx` — how dumb widget handlers work
   - `src/components/WidgetPanel.tsx` — how spawned widgets render
   - `src/hooks/use-agent.ts` — agent state API surface

2. **Identify all state flows**:
   - How does widget state flow from backend → frontend?
   - How does widget state flow from frontend → backend (dumb widgets)?
   - Where are the seams/bridges between these?

3. **Design the new protocol**:
   - Should `useFrontendTool` handler call backend `updateState` instead of local `setSpawned`?
   - Should there be a `WidgetToolRegistrar` equivalent that registers dumb widgets in backend state?
   - What should the state schema look like? Propose a clean structure.
   - How should `clear=True` work at the state level vs rendering level?
   - How should `replace`, `add`, `remove` operations work?

4. **Consider migration path**:
   - How to migrate existing smart/dumb widgets to the new protocol
   - Backwards compatibility concerns

## Files to Read

```
backend/agent/graph.py
src/app/(chat)/page.tsx
src/components/WidgetToolRegistrar.tsx
src/components/WidgetPanel.tsx
src/hooks/use-agent.ts
src/lib/types.ts
src/types/state.ts
src/lib/widgetEntries.ts
```

## Output

Write a detailed plan for the new widget protocol including:
- Proposed state schema
- New/modified API surface
- Operation types (clear, replace, add, remove, etc.)
- Code changes needed (which files, what to change)
- Migration approach

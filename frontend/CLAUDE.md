# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A full-stack AI agent platform: CopilotKit frontend (Next.js 15 + React 19) talks to a LangGraph orchestrator (FastAPI) via AG-UI protocol. The LLM spawns UI widgets onto a canvas through tool calls. Widgets are either **smart** (have a subagent that takes over chat) or **dumb** (display-only, rendered on the client).

## Commands

```bash
# Run both servers (kills existing processes on 3000/8000 first)
./startup.sh

# Run individually
npm run dev                                        # Frontend :3000
cd backend && source .venv/bin/activate && python server.py  # Backend :8000

# Build / lint / test
npm run build
npm run lint
npm run type-check                                 # tsc --noEmit
npm test                                           # jest
cd backend && pytest                               # pytest (asyncio_mode=auto)

# Backend venv setup (first time)
cd backend && uv venv --python 3.12 && source .venv/bin/activate && uv sync
```

## Package Versions -- NEVER CHANGE

Always use versions specified in `backend/pyproject.toml`. Never run `pip install` or change versions without explicit user approval.

- `copilotkit==0.1.75` -- v0.1.76+ broke import (`langchain.agents.middleware` removed)
- `ag-ui-langgraph>=0.0.26`
- Frontend ALWAYS uses `@copilotkitnext/react` and `@copilotkitnext/runtime` (the v2 API). NEVER import from `@copilotkit/react-core` or `@copilotkit/react-ui` in frontend code -- those are legacy v1 packages that happen to exist in node_modules but are not used.

## Architecture

### Request Flow

```
Browser → Next.js /api/copilotkit/[[...path]] → CopilotKit runtime → POST :8000/copilotkit
→ ag_ui_langgraph → LangGraphAGUIAgent → StateGraph(OrchestratorState)
```

### Graph Structure (backend/agent/graph.py)

- **Entry routing** (`route_entry`): if `focused_agent` is set, resume that subagent node; otherwise go to `orchestrator`.
- **Orchestrator node**: binds frontend tools + skeleton tools + spawn tools + example tools to LLM. Includes tool-call JSON repair for Qwen3 malformed args.
- **tools_node**: unified executor for all backend tool calls (spawn, clear_canvas, domain, example/MCP tools). Writes state patches (active_widgets, widget_state, focused_agent).
- **Subagent nodes**: created dynamically from registry. Each gets its own domain_tools + handoff_to_orchestrator.
- **Routing after tools** (`route_after_tools`): after spawn → subagent (if intro_message) or END; otherwise back to focused subagent or orchestrator.

### Widget System (Two Types)

**Smart widgets** (`agent: "subagent_id"` in config):
- Spawn tool routed to `tools_node` → writes `active_widgets`, `widget_state`, `focused_agent`
- Subagent takes over conversation, has domain tools
- State streamed live via `emit_intermediate_state`

**Dumb widgets** (`agent: null` in config):
- Tool routed to AG-UI → client `useFrontendTool` handler renders optimistically
- 1-turn delay: backend syncs via `_sync_dumb_widgets` on follow-up turn
- `expectedDumbIds` ref in page.tsx guards against stale intermediate snapshots

### Auto-Discovery (Plugin System)

Both frontend and backend auto-discover from `examples/`:
- **Frontend**: `examples/index.ts` re-exports; `src/lib/widgetEntries.ts` scans for WidgetConfig + Component pairs
- **Backend**: `examples/__init__.py` `load_all_backend_tools()` finds `examples/*/tools.py` with `all_tools` (standalone tools only — spawn tools come from SUBAGENTS)
- **Subagents**: `backend/agent/subagents/registry.py` finds `examples/*/__init__.py` with `SUBAGENTS` list

### Adding a New Example

1. Create `examples/my_example/` with widget dirs under `widgets/`
2. Each widget needs `widget.config.ts` (exports WidgetConfig) and a React component
3. Example `index.ts` re-exports all widget configs + components
4. Add `export * as myExample from "./my_example"` in `examples/index.ts`
5. For smart widgets: export `SUBAGENTS: SubagentConfig[]` from `examples/my_example/__init__.py`
6. For MCP/backend tools: export `all_tools` from `examples/my_example/tools.py`
7. Component name must be PascalCase of `config.id` with underscores removed (e.g. `red_flower` → `RedFlower`)

### Frontend Tool Registration

NEVER call `.runAgent()` directly on an agent instance. Always use `copilotkit.runAgent({ agent })` from `useCopilotKit()` -- direct calls bypass `buildFrontendTools()` and tools arrive as `[]` at the backend.

`WidgetToolRegistrar` components must be mounted at page root (unconditionally) so `useFrontendTool` effects fire before the first user message.

### Canvas Operations

All spawn tools accept `operation` param: `replace_all` (default, clears canvas), `add` (alongside existing), `replace_one` (remove same id then add). `clear_canvas` is only for removing without replacing.

## MCP Server: teaching-db

**Server:** `http://47.95.179.148:9999` (teaching-db v1.26.0)
**Client:** `examples/mcp_client.py` -- JSON-RPC over SSE, supports `list_tools` and `call` commands.

## Key State Fields (OrchestratorState)

- `active_widgets: List[{id, type, props}]` -- single source of truth for canvas
- `focused_agent: Optional[str]` -- which subagent owns chat (None = orchestrator)
- `widget_state: Dict` -- live mutable state for focused smart widget
- `pending_agent_message: Optional[str]` -- intro message injected on subagent's first turn

## Environment

- `LLM_PROVIDER`: `nebius` (default), `openai`, or `google`
- `NEBIUS_API_KEY`, `NEBIUS_MODEL` (default: `Qwen/Qwen3-32B-fast`)
- `OPENAI_API_KEY`, `OPENAI_MODEL` (default: `gpt-4o`)
- `GOOGLE_API_KEY`, `GOOGLE_MODEL`
- `SYSTEM_PROMPT`: override orchestrator system prompt
- Frontend env in `.env.local`, backend env in `backend/.env`

## Bug Records & Architecture Decisions

Detailed write-ups of past bugs and design decisions live in `docs/`:
- [`docs/bug-tool-registration-pipeline.md`](docs/bug-tool-registration-pipeline.md) -- tools arriving as `[]` at backend; full request flow trace
- [`docs/bug-canvas-clear.md`](docs/bug-canvas-clear.md) -- why clear_canvas is a backend tool, not frontend
- [`docs/thinking-token-rendering.md`](docs/thinking-token-rendering.md) -- inline `<think>` token parsing, what was avoided and why
- [`docs/widget-protocol.md`](docs/widget-protocol.md) -- smart vs dumb widget lifecycle, canvas operations, 1-turn delay

# Tool Registration Pipeline — Architecture & Bug Record

## Full Pipeline (verified 2026-03-19)

This documents the exact path frontend tools travel from React hook to Python LLM binding, and the bug that caused tools to arrive empty.

```
[1] useFrontendTool (WidgetToolRegistrar)
      ↓  copilotkit.addTool(tool)
      ↓  pushes to copilotkit.runHandler._tools[]

[2] copilotkit.runAgent({ agent })          ← CORRECT call site
      ↓  RunHandler.runAgent()
      ↓  buildFrontendTools(agent.agentId)
      ↓  filters _tools where (!tool.agentId || tool.agentId === agentId)
      ↓  maps to { name, description, parameters: jsonSchema }
      ↓  passes as tools[] in RunAgentInput

[3] ProxiedCopilotRuntimeAgent.run(input)
      ↓  HttpAgent serializes full RunAgentInput as JSON POST body
      ↓  POST /api/copilotkit/agent/orchestrator/run
      ↓  body: { threadId, runId, tools: [...], messages, state, ... }

[4] route.ts  (Next.js catch-all /api/copilotkit/[[...path]])
      ↓  clones request, logs body.tools count + names
      ↓  forwards to createCopilotEndpoint → handle-run.mjs

[5] handle-run.mjs
      ↓  RunAgentInputSchema.parse(body)  (Zod validation)
      ↓  agent.run(input)  → HttpAgent → POST http://localhost:8000/copilotkit

[6] backend/server.py  (FastAPI middleware)
      ↓  logs parsed body: tools[], full keys
      ↓  forwards to add_langgraph_fastapi_endpoint

[7] LangGraphAGUIAgent → ag_ui_langgraph
      ↓  deserializes RunAgentInput.tools → frontend actions
      ↓  populates state["copilotkit"]["actions"]

[8] backend/agent/graph.py  orchestrator_node
      ↓  frontend_actions = state["copilotkit"]["actions"]
      ↓  all_tools = [*frontend_actions, *backend_tools]
      ↓  llm.bind_tools(all_tools)
      ↓  LLM can now call show_topic_progress / show_user_card / show_particle_sim
```

**Verified log sequence (working):**
```
[WT]   addTool effect fired: name=show_topic_progress total_tools=1
[WT]   addTool effect fired: name=show_user_card      total_tools=2
[WT]   addTool effect fired: name=show_particle_sim   total_tools=3
[BOOT] firing auto-message, tools registered: 3
[route.ts] body.tools: count=3 names=show_topic_progress,show_user_card,show_particle_sim
[server]   RAW tools count: 3
[GRAPH]    frontend actions count: 3
[GRAPH]    Binding 4 tools to LLM (3 frontend + 1 backend)
LLM RESPONSE: tool_calls to frontend widgets
```

---

## Bug: tools arrived as `[]` at Python backend

**Symptom:** Frontend registered 3 tools. Python logged `frontend actions count: 0`. Agent responded in plain text instead of calling widget tools.

**Root cause:** `agent.runAgent()` was called directly on the `ProxiedCopilotRuntimeAgent` with no arguments. This bypasses the `CopilotKitCore.runAgent()` wrapper that injects tools.

```
// WRONG — tools never injected, tools:[] in POST body
v2Agent.runAgent()

// CORRECT — goes through RunHandler.buildFrontendTools(agentId)
copilotkit.runAgent({ agent: v2Agent })
```

**Internal path (why it matters):**
- `agent.runAgent()` → `AbstractAgent.runAgent(options?)` → options undefined → `tools: []` serialized
- `copilotkit.runAgent({ agent })` → `RunHandler.runAgent()` → `buildFrontendTools(agentId)` → reads `_tools[]` → passes populated array

**Affected files (fixed):**
- `src/components/chat.tsx` — `v2Agent.runAgent()` → `copilotkit.runAgent({ agent: v2Agent })`
- `src/components/ChatSidebar.tsx` — `agent.runAgent()` → `copilotkit.runAgent({ agent })`
- `src/app/(chat)/page.tsx` — boot message `agent.runAgent()` → `copilotkit.runAgent({ agent })`

**Prevention:** Never call `.runAgent()` directly on a `ProxiedCopilotRuntimeAgent` / `HttpAgent` instance. Always go through `copilotkit.runAgent({ agent })` from `useCopilotKit()`.

---

## Key internal types (copilotkitnext v2)

| Symbol | Package | Role |
|---|---|---|
| `useFrontendTool` | `@copilotkitnext/react` | Registers tool into `copilotkit.runHandler._tools[]` via useEffect |
| `useCopilotKit()` | `@copilotkitnext/react` | Returns `{ copilotkit: CopilotKitCoreReact }` |
| `copilotkit.runAgent({ agent })` | `@copilotkitnext/core` | Injects tools, runs agent |
| `buildFrontendTools(agentId)` | `@copilotkitnext/core` | Filters `_tools` where `!tool.agentId \|\| tool.agentId === agentId` |
| `RunAgentInput.tools` | `@ag-ui/client` | Wire format — JSON array of `{ name, description, parameters }` |
| `state["copilotkit"]["actions"]` | `copilotkit` Python SDK | Deserialized frontend tools inside LangGraph state |
| `CopilotKitState` | `copilotkit` Python SDK | Base state class providing `messages` + `copilotkit` keys |

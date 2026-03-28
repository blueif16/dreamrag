# CopilotKit v2 + LangGraph AG-UI — Research Findings & Corrected Code

## Root Cause Analysis

After researching CopilotKit source, docs, release notes, and open issues at your exact versions (`@copilotkit/react-core@1.54.0`, `@copilotkit/runtime@1.54.0`, `copilotkit[langgraph]==0.1.75`), the bug has **two contributing causes**:

### Cause 1: v2 Provider + v1 Runtime Endpoint Mismatch

You're using:
- **v2 Provider**: `CopilotKitProvider` from `@copilotkit/react-core/v2`
- **v1 Runtime Endpoint**: `copilotRuntimeNextJSAppRouterEndpoint` from `@copilotkit/runtime`

Starting at v1.50, CopilotKit internally migrated to a Hono-based architecture and removed GraphQL. The v2 provider (`CopilotKitProvider`) communicates using the new v2 protocol. The v1 endpoint helper `copilotRuntimeNextJSAppRouterEndpoint` was "ported" to v2 internally, but it uses `ExperimentalEmptyAdapter` which is a no-op LLM adapter—it was never designed to forward frontend tools to AG-UI agents. The v2 runtime uses `createCopilotEndpoint` + `InMemoryAgentRunner` instead.

**The v2 runtime path (`createCopilotEndpoint`) properly serializes frontend-registered tools into the AG-UI `RunAgentInput.tools` array. The v1 endpoint path may strip them.**

### Cause 2: Duplicate Tool Names

Your frontend log shows:
```
Total entries built: 5 [
  'show_topic_progress',  
  'show_user_card',
  'show_particle_sim',
  'show_topic_progress',   // DUPLICATE
  'show_user_card'         // DUPLICATE
]
```

5 entries but only 3 unique tool names. Registering two `useFrontendTool` hooks with the same `name` will cause the second to overwrite the first, and may cause serialization issues in the runtime.

### Cause 3 (Minor): `useCopilotChatInternal` is Internal API

`useCopilotChatInternal` is not a public API. The correct hook is `useCopilotChat` from `@copilotkit/react-core`.

---

## Answer 1: Provider/Hook Compatibility

### Does `CopilotKitProvider` from `@copilotkit/react-core/v2` exist and work?

**Yes.** At `@copilotkit/react-core@1.54.0`, the `/v2` subpath exports `CopilotKitProvider`. This is confirmed by the release notes ("Want the new v2 hooks? Import from `@copilotkit/react-core/v2`") and multiple GitHub issues using this exact import.

### Does `useFrontendTool` from `@copilotkit/react-core/v2` with `available: "remote"` serialize tools?

**Yes**, but it needs the v2 runtime endpoint to properly forward them. The official AG-UI frontend tools documentation shows:
```tsx
import { useFrontendTool } from "@copilotkit/react-core/v2";
useFrontendTool({
  name: "sayHello",
  available: "remote",
  parameters: z.object({ name: z.string() }),
  handler: async ({ name }) => { ... },
});
```

### What is the correct combination?

**Option A (Recommended — Full v2):**
- Provider: `CopilotKitProvider` from `@copilotkit/react-core/v2`
- Frontend tools: `useFrontendTool` from `@copilotkit/react-core/v2`
- Chat: `useCopilotChat` from `@copilotkit/react-core` (the v1 export works fine under v2 provider)
- Runtime: `createCopilotEndpoint` + `InMemoryAgentRunner` from `@copilotkit/runtime/v2`

**Option B (Fallback — Full v1):**
- Provider: `CopilotKit` from `@copilotkit/react-core`
- Frontend tools: `useCopilotAction` from `@copilotkit/react-core` (v1 equivalent of useFrontendTool)
- Chat: `useCopilotChat` from `@copilotkit/react-core`
- Runtime: `copilotRuntimeNextJSAppRouterEndpoint` from `@copilotkit/runtime`

---

## Answer 2: Runtime Route Configuration

### Should you use `LangGraphHttpAgent` or `HttpAgent`?

**Use `LangGraphHttpAgent` from `@copilotkit/runtime/langgraph`** for self-hosted FastAPI + `ag-ui-langgraph` + `LangGraphAGUIAgent`. This is exactly what the official docs recommend for your setup. `HttpAgent` from `@ag-ui/client` is for generic AG-UI endpoints (like Google ADK).

### Does `LangGraphHttpAgent` forward frontend tools?

**Yes**, when used with the v2 runtime. `LangGraphHttpAgent` is a thin wrapper that forwards the AG-UI request (including the `tools` array) to your FastAPI endpoint.

### Corrected `route.ts` (v2 runtime):

```typescript
// src/app/api/copilotkit/route.ts
import {
  CopilotRuntime,
  createCopilotEndpoint,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { handle } from "hono/vercel";

const runtime = new CopilotRuntime({
  agents: {
    orchestrator: new LangGraphHttpAgent({
      url: process.env.REMOTE_ACTION_URL || "http://localhost:8000/copilotkit",
    }),
  },
  runner: new InMemoryAgentRunner(),
});

const app = createCopilotEndpoint({
  runtime,
  basePath: "/api/copilotkit",
});

export const GET = handle(app);
export const POST = handle(app);
```

**Required additional dependency**: `hono` (for the Vercel adapter)
```bash
npm install hono
```

### If the v2 runtime import fails:

Try importing from the main package (v1.50+ exports these from root too):
```typescript
import { CopilotRuntime, InMemoryAgentRunner } from "@copilotkit/runtime";
```

Or if `createCopilotEndpoint` isn't available at 1.54.0 from the `/v2` subpath, fall back to v1:
```typescript
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";

const serviceAdapter = new ExperimentalEmptyAdapter();
const runtime = new CopilotRuntime({
  agents: {
    orchestrator: new LangGraphHttpAgent({
      url: process.env.REMOTE_ACTION_URL || "http://localhost:8000/copilotkit",
    }),
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
```

**If you use the v1 fallback runtime, also use v1 frontend hooks** (see Option B above).

---

## Answer 3: Dumb Widget Flow (agent: null) — Complete Code

### Frontend: Provider (no changes needed)

```tsx
// src/components/CopilotProvider.tsx
"use client";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import { ReactNode } from "react";

export function CopilotProvider({ children }: { children: ReactNode }) {
  return (
    <CopilotKitProvider
      runtimeUrl="/api/copilotkit"
      agent="orchestrator"
      showDevConsole={false}
    >
      {children}
    </CopilotKitProvider>
  );
}
```

### Frontend: Tool Registration (CORRECTED)

Key fixes:
1. Use Zod directly (not `configToZod` wrapper — verify it produces `z.object()`)
2. Deduplicate tool names
3. Remove `available: "remote"` (default behavior sends to both local + remote; OR keep it if you only want remote)

```tsx
// src/components/WidgetToolRegistrar.tsx
"use client";
import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { WidgetEntry, SpawnedWidget } from "@/lib/types";
import { Dispatch, SetStateAction } from "react";

interface Props {
  entry: WidgetEntry;
  setSpawned: Dispatch<SetStateAction<SpawnedWidget[]>>;
}

export function WidgetToolRegistrar({ entry, setSpawned }: Props) {
  // Build Zod schema directly — do NOT use a wrapper that might return a plain object
  const parameters = z.object(
    Object.fromEntries(
      Object.entries(entry.config.tool.parameters).map(([key, param]) => {
        let schema: z.ZodTypeAny;
        switch (param.type) {
          case "number":
            schema = z.number();
            break;
          case "boolean":
            schema = z.boolean();
            break;
          default:
            schema = z.string();
        }
        if (param.description) {
          schema = schema.describe(param.description);
        }
        if (param.default !== undefined) {
          schema = schema.default(param.default);
        }
        return [key, schema];
      })
    )
  );

  useFrontendTool(
    {
      name: entry.config.tool.name,
      description: entry.config.tool.description,
      parameters,
      handler: async (args) => {
        setSpawned((prev) => [
          ...prev.filter((w) => w.id !== entry.config.id),
          { id: entry.config.id, Component: entry.Component, props: args },
        ]);
        return JSON.stringify({ spawned: true, widgetId: entry.config.id });
      },
      render: ({ status }) => (
        <div>
          {status === "complete" ? "✅" : "⏳"} {entry.config.tool.name}
        </div>
      ),
    },
    [] // dependency array — important for v2 hooks
  );

  return null;
}
```

### Frontend: Widget Panel (deduplicate entries)

```tsx
// src/components/WidgetPanel.tsx
"use client";
import { useState, useMemo } from "react";
import { widgetEntries } from "@/lib/widgetEntries";
import { WidgetToolRegistrar } from "./WidgetToolRegistrar";

export function WidgetPanel() {
  const [spawned, setSpawned] = useState([]);

  // CRITICAL: Deduplicate by tool name to avoid registering the same tool twice
  const uniqueEntries = useMemo(() => {
    const seen = new Set<string>();
    return widgetEntries.filter((entry) => {
      if (seen.has(entry.config.tool.name)) return false;
      seen.add(entry.config.tool.name);
      return true;
    });
  }, []);

  return (
    <div>
      {/* Register tools (renders nothing visible) */}
      {uniqueEntries
        .filter((e) => e.config.agent === null) // Only dumb widgets register frontend tools
        .map((entry) => (
          <WidgetToolRegistrar
            key={entry.config.id}
            entry={entry}
            setSpawned={setSpawned}
          />
        ))}

      {/* Render spawned widgets */}
      {spawned.map((w) => (
        <div key={w.id}>
          <w.Component {...w.props} />
        </div>
      ))}
    </div>
  );
}
```

### Backend: Graph Node (reads frontend actions)

```python
# backend/agent/graph.py
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from copilotkit import copilotkit_customize_config
from .state import OrchestratorState

def orchestrator_node(state: OrchestratorState, config):
    """Main orchestrator node that has access to frontend tools."""
    
    # Frontend tools registered via useFrontendTool appear here
    frontend_actions = state.get("copilotkit", {}).get("actions", [])
    
    # Log for debugging
    print(f"[orchestrator] Frontend actions count: {len(frontend_actions)}")
    for action in frontend_actions:
        print(f"  - {action.get('name', 'unnamed')}")
    
    # Combine frontend + backend tools
    all_tools = [*frontend_actions, *backend_tools]
    
    # Bind tools to LLM
    llm_with_tools = llm.bind_tools(all_tools)
    
    messages = state["messages"]
    response = llm_with_tools.invoke(messages)
    
    return {"messages": [response]}
```

### End-to-End Flow (Dumb Widget):
1. User sends "Show me the student card for Alice, age 12"
2. Frontend serializes `show_user_card` tool in AG-UI request → runtime → FastAPI
3. Backend receives tool in `state["copilotkit"]["actions"]`
4. LLM sees the tool, decides to call `show_user_card(username="Alice", age=12)`
5. AG-UI streams `TOOL_CALL_START` → `TOOL_CALL_END` events back to frontend
6. Frontend `useFrontendTool` handler fires, spawns the `<UserCard>` component
7. `render` callback shows loading/complete status inline in chat

---

## Answer 4: Smart Widget Flow (agent: { id: "..." })

Smart widgets should NOT use `useFrontendTool`. The tool lives on the backend because it needs to mutate graph state (`focused_agent`). The frontend just needs `useRenderToolCall` to render when the backend emits.

### Backend: Tool Definition

```python
# backend/agent/tools.py
from langchain_core.tools import tool
from copilotkit import copilotkit_emit_tool_call
import json

@tool
def show_ice_cream_maker(temperature: float = 20.0) -> str:
    """Spawn the ice cream simulation widget with the given temperature."""
    return json.dumps({
        "spawned": True,
        "widgetId": "ice_cream_maker",
        "temperature": temperature,
    })
```

### Backend: Graph Node for Smart Widgets

```python
# In your orchestrator or tool execution node
from copilotkit import copilotkit_emit_tool_call
import uuid

async def smart_tool_node(state: OrchestratorState, config):
    """Execute backend tools and emit frontend renders for smart widgets."""
    
    last_message = state["messages"][-1]
    
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        
        # Execute the backend tool
        result = tools_by_name[tool_name].invoke(tool_args)
        
        # If this is a smart widget tool, also emit to frontend for rendering
        if tool_name.startswith("show_"):
            await copilotkit_emit_tool_call(
                config=config,
                name=tool_name,
                args=tool_args,
            )
        
        # Update graph state for routing
        if tool_name == "show_ice_cream_maker":
            state["focused_agent"] = "ice-cream-expert"
    
    return {
        "messages": [ToolMessage(content=result, tool_call_id=tool_call["id"])],
        "focused_agent": state.get("focused_agent"),
    }
```

### Frontend: Render Backend Tool Calls

```tsx
// src/components/SmartWidgetRenderer.tsx
"use client";
import { useRenderToolCall } from "@copilotkit/react-core";
// or from v2: import { useRenderToolCall } from "@copilotkit/react-core/v2";
import { IceCreamMaker } from "@/widgets/IceCreamMaker";

export function SmartWidgetRenderer() {
  useRenderToolCall({
    name: "show_ice_cream_maker",
    render: ({ args, status }) => {
      if (status === "complete") {
        return <IceCreamMaker temperature={args.temperature} />;
      }
      return <div>Loading ice cream maker...</div>;
    },
  });

  return null;
}
```

---

## Answer 5: Version Compatibility

### Are your current versions compatible?

| Package | Version | Compatible? |
|---|---|---|
| `@copilotkit/react-core` | 1.54.0 | ✅ Yes — v2 subpath exists |
| `@copilotkit/react-ui` | 1.54.0 | ✅ Yes |
| `@copilotkit/runtime` | 1.54.0 | ✅ Yes — but verify `createCopilotEndpoint` is exported from `/v2` |
| `copilotkit[langgraph]` | 0.1.75 | ✅ Yes — last stable before 0.1.76 import break |
| `ag-ui-langgraph` | >=0.0.26 | ✅ Yes |

### Your versions are fine. The issue is the runtime endpoint, not version incompatibility.

If `createCopilotEndpoint` is not available at `@copilotkit/runtime@1.54.0/v2`, add `hono` and try:

```json
// package.json additions
{
  "hono": "^4.6.0",
  "@copilotkit/react-core": "1.54.0",
  "@copilotkit/react-ui": "1.54.0",
  "@copilotkit/runtime": "1.54.0"
}
```

Python deps stay the same:
```toml
# pyproject.toml — no changes needed
"copilotkit[langgraph]==0.1.75"
"ag-ui-langgraph>=0.0.26"
"langgraph>=0.3.25,<1.1.0"
```

---

## Answer 6: The `useCopilotChatInternal` Question

**`useCopilotChatInternal` is NOT a public API.** It is an internal hook and should not be used.

### Correct headless chat hook:

```tsx
// src/components/ChatSidebar.tsx
"use client";
import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";

export function ChatSidebar() {
  const {
    visibleMessages,
    appendMessage,
    setMessages,
    deleteMessage,
    reloadMessages,
    stopGeneration,
    isLoading,
  } = useCopilotChat();

  const sendMessage = (content: string) => {
    appendMessage(new TextMessage({ content, role: Role.User }));
  };

  return (
    <div>
      {visibleMessages.map((message) => (
        <div key={message.id}>
          {message.role === "user" ? "You: " : "Agent: "}
          {message.content}
          {/* Render generative UI if present */}
          {message.role === "assistant" && message.generativeUI?.()}
        </div>
      ))}
      {/* Your input UI here */}
    </div>
  );
}
```

This is imported from `@copilotkit/react-core` (NOT `/v2`). It works under both v1 and v2 providers.

---

## Debugging Checklist

If tools still show as `[]` after applying the fixes above:

1. **Check the HTTP request from browser → runtime**: Open DevTools Network tab, find the POST to `/api/copilotkit`. Look at the request body — does it contain a `tools` array with your tool definitions? If not, the frontend isn't serializing them.

2. **Check the HTTP request from runtime → FastAPI**: In your FastAPI logs, check the request body. If the browser sends tools but FastAPI receives `"tools": []`, the runtime is stripping them.

3. **Verify Zod schemas**: Add `console.log(JSON.stringify(parameters))` before `useFrontendTool`. If it logs `undefined` or `{}`, your `configToZod` is broken.

4. **Fix duplicates**: Your 5 entries should be 3 unique tools. Deduplicate before registering.

5. **Try `agents__unsafe_dev_only` (bypasses runtime entirely)**:
```tsx
import { HttpAgent } from "@ag-ui/client";
// In your provider:
<CopilotKitProvider
  agents__unsafe_dev_only={{
    orchestrator: new HttpAgent({
      url: "http://localhost:8000/copilotkit",
    }),
  }}
>
```
If tools appear with this approach but not with the runtime, the bug is in the runtime forwarding.

6. **Try v1 `useCopilotAction` as a control test**:
```tsx
import { useCopilotAction } from "@copilotkit/react-core";

useCopilotAction({
  name: "show_user_card",
  description: "Display the student's profile card",
  parameters: [
    { name: "username", type: "string", description: "Student's display name", required: true },
    { name: "age", type: "number", description: "Student's age", required: true },
  ],
  handler: async ({ username, age }) => {
    console.log("Tool called!", username, age);
  },
});
```
If this works but `useFrontendTool` doesn't, the issue is specifically in the v2 hook serialization.

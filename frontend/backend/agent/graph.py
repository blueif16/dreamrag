"""Widget platform orchestrator graph — skeleton only.

No example names, no widget names, no domain-specific logic.
All content is injected at startup via the subagent registry.
"""
import os
import json
import logging
from dotenv import load_dotenv
from pydantic import create_model, Field as PydanticField
from langchain_core.tools import StructuredTool

load_dotenv()

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import SystemMessage, ToolMessage

from .state import OrchestratorState
from .tools import skeleton_tools, clear_canvas, handoff_to_orchestrator
from .subagents import load_subagent_registry
from examples import load_all_backend_tools


# ---------------------------------------------------------------------------
# Tool-call repair + retry helpers
# ---------------------------------------------------------------------------

def _repair_tool_call_args(raw_args: str) -> str | None:
    """Try to fix common Qwen3 JSON generation errors (e.g. trailing extra `}`)."""
    if not isinstance(raw_args, str):
        return None
    s = raw_args.strip()
    # Try as-is first
    try:
        json.loads(s)
        return s
    except json.JSONDecodeError:
        pass
    # Strip trailing extra closing braces one at a time
    while s.endswith("}"):
        s = s[:-1].rstrip()
        try:
            json.loads(s + "}")
            return s + "}"
        except json.JSONDecodeError:
            continue
    return None


def _repair_response(response):
    """Move repairable invalid_tool_calls into tool_calls on the response object."""
    invalid = getattr(response, "invalid_tool_calls", None)
    if not invalid:
        return response
    repaired = []
    still_invalid = []
    for itc in invalid:
        fixed_args = _repair_tool_call_args(itc.get("args", ""))
        if fixed_args is not None:
            try:
                parsed = json.loads(fixed_args)
            except Exception:
                parsed = {}
            repaired.append({
                "name": itc.get("name"),
                "args": parsed,
                "id": itc.get("id"),
                "type": "tool_call",
            })
            logger.info(f"[REPAIR] fixed invalid_tool_call: {itc.get('name')} args={fixed_args[:80]}")
        else:
            still_invalid.append(itc)
    if repaired:
        existing = list(getattr(response, "tool_calls", None) or [])
        response.tool_calls = existing + repaired
        response.invalid_tool_calls = still_invalid
    return response


async def _invoke_with_repair_and_retry(llm_with_tools, messages, config, label: str):
    """Invoke LLM, repair invalid tool calls, and retry once if tool_calls still empty."""
    response = await llm_with_tools.ainvoke(messages, config=config)
    if hasattr(response, "additional_kwargs"):
        response.additional_kwargs.pop("reasoning_content", None)
    response = _repair_response(response)
    # If we got invalid_tool_calls but no valid tool_calls, retry with error hint
    if (
        not getattr(response, "tool_calls", None)
        and getattr(response, "invalid_tool_calls", None)
    ):
        logger.warning(f"[{label}] all tool calls invalid after repair — retrying with hint")
        from langchain_core.messages import HumanMessage
        retry_messages = messages + [response, HumanMessage(
            content="Your previous tool call had malformed JSON arguments. "
                    "Please retry using valid JSON — make sure every opening brace has exactly one closing brace."
        )]
        response = await llm_with_tools.ainvoke(retry_messages, config=config)
        if hasattr(response, "additional_kwargs"):
            response.additional_kwargs.pop("reasoning_content", None)
        response = _repair_response(response)
        logger.info(f"[{label}] retry result: tool_calls={len(getattr(response, 'tool_calls', None) or [])}")
    return response

# ---------------------------------------------------------------------------
# Load registry at startup — all content comes from examples
# ---------------------------------------------------------------------------

_registry = load_subagent_registry()

# spawn tool name → SubagentConfig
_spawn_tool_map = {cfg.spawn_tool.name: cfg for cfg in _registry.values()}

# domain tool name → (tool callable, SubagentConfig)
_domain_tool_map = {
    t.name: t
    for cfg in _registry.values()
    for t in cfg.domain_tools
}

# Spawn tools to bind on orchestrator LLM (from registry)
_spawn_tools = [cfg.spawn_tool for cfg in _registry.values()]


def _with_operation_param(spawn_tool):
    """Wrap a spawn tool to add an `operation` param controlling canvas placement.

    Operations:
        replace_all (default): clear all existing widgets, show only this one.
        add:                   add this widget alongside existing ones.
        replace_one:           remove any existing widget with the same id, then add this one.
    """
    orig_schema = getattr(spawn_tool, "args_schema", None)
    from typing import Literal
    if orig_schema is not None:
        orig_fields = {
            name: (field.annotation, field)
            for name, field in orig_schema.model_fields.items()
        }
        NewSchema = create_model(
            orig_schema.__name__,
            **orig_fields,
            operation=(str, PydanticField(
                default="replace_all",
                description="Canvas placement: 'replace_all' clears all widgets then shows this one (default), 'add' adds alongside existing widgets, 'replace_one' removes only this widget's id then adds it.",
            )),
        )
    else:
        NewSchema = None
    new_description = (
        spawn_tool.description
        + "\nOptional `operation` (default 'replace_all'): 'replace_all' clears canvas first, 'add' adds alongside existing, 'replace_one' replaces only this widget."
    )
    return StructuredTool(
        name=spawn_tool.name,
        description=new_description,
        func=spawn_tool.func,
        args_schema=NewSchema,
    )


_spawn_tools_with_op = [_with_operation_param(t) for t in _spawn_tools]

# Standalone backend tools (MCP queries, DB lookups — no widget spawn or state mutation)
_backend_tools = load_all_backend_tools()
_backend_tool_map = {t.name: t for t in _backend_tools}

# Union of all tool names routed to tools_node (everything else goes to AG-UI / frontend)
_server_tool_names = (
    {t.name for t in skeleton_tools}
    | set(_spawn_tool_map.keys())
    | set(_domain_tool_map.keys())
    | set(_backend_tool_map.keys())
    | {handoff_to_orchestrator.name}
)


# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------

def get_llm():
    provider = os.getenv("LLM_PROVIDER", "nebius")
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=os.getenv("OPENAI_MODEL", "gpt-4o"), temperature=0.7)
    elif provider == "nebius":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=os.getenv("NEBIUS_MODEL", "Qwen/Qwen3-32B-fast"),
            base_url="https://api.tokenfactory.nebius.com/v1/",
            api_key=os.getenv("NEBIUS_API_KEY"),
            temperature=0.7,
            model_kwargs={"parallel_tool_calls": False},
        )
    else:
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=os.getenv("GOOGLE_MODEL", "gemini-3.1-flash-lite-preview"),
            temperature=0.7,
        )


llm = get_llm()


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

ORCHESTRATOR_PROMPT = """You are DreamRAG, an AI dream analysis orchestrator. You spawn glassmorphic dashboard widgets by calling tools.
Every widget on screen was created by a tool call — there is no other way to show UI.

━━━ RETRIEVAL PROTOCOL — ALWAYS do this before spawning for any dream analysis ━━━

For a NEW DREAM submission:
  1. record_dream(dream_text, user_id)                  — saves dream, returns dream_id
  2. search_dreams(dream_text, "dream_knowledge", 5)     — Jung/Freud/HVdC chunks
  3. search_dreams(dream_text, "community_dreams", 5)    — similar real dreams from corpus
  4. search_dreams(dream_text, "user_default_dreams", 3) — user's own past similar dreams

For a SYMBOL query (e.g. "what does water mean?"):
  1. search_dreams(symbol, "dream_knowledge", 5)
  2. search_dreams(symbol, "community_dreams", 5)
  3. get_symbol_graph(symbol)                            — co-occurrence satellites

Each search_dreams result contains chunks with an "id" field (integer). Collect these IDs.

━━━ WIDGET SYNTHESIS RULES ━━━

After retrieval, synthesize widget content FROM the returned chunks. Never invent:
- show_current_dream      → meaning from dream_knowledge chunks, life_echo from community_dreams chunks
- show_dream_atmosphere   → satellites = symbols found in dream_knowledge chunk text
- show_followup_chat      → prompts that probe specific concepts from retrieved chunks
- show_echoes_card        → echoes from user_*_dreams + community_dreams results (use actual content)
- show_textbook_card      → excerpt = direct quote/paraphrase from a dream_knowledge chunk
- show_community_mirror   → snippets = actual community_dreams results with their scores
- show_interpretation_synthesis → each paragraph from a different namespace, tag source accordingly

Pass source_chunk_ids on every agent-populated widget (array of chunk id integers that backed it).

Self-contained widgets — call with NO params, they fetch user stats themselves:
- show_emotional_climate()    ← no args
- show_recurrence_card()      ← no args

━━━ COMPOSITION RULES ━━━

NEW DREAM: record_dream + 3× search_dreams FIRST, then spawn:
  show_current_dream (replace_all) + show_dream_atmosphere (add) + show_textbook_card (add) +
  show_community_mirror (add) + show_echoes_card (add) + show_emotional_climate (add) +
  show_recurrence_card (add) + show_followup_chat (add)

SYMBOL query: search_dreams×2 + get_symbol_graph FIRST, then:
  show_interpretation_synthesis (replace_all) + show_textbook_card (add) +
  show_symbol_cooccurrence_network (add) + show_community_mirror (add) +
  show_emotion_split (add) + show_followup_chat (add)

TEMPORAL/PATTERN query:
  show_emotional_climate (replace_all) + show_heatmap_calendar (add) +
  show_dream_streak (add) + show_top_symbol (add) + show_lucidity_gauge (add)

GENERAL RULES:
- Backend tool calls (record_dream, search_dreams, get_symbol_graph) and widget spawns can be batched in the same turn
- First widget uses operation='replace_all', subsequent use operation='add'
- Keep text responses brief — the widgets ARE the response
- clear_canvas() is only for removing widgets without replacing
"""

SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", ORCHESTRATOR_PROMPT)


# ---------------------------------------------------------------------------
# Orchestrator node
# ---------------------------------------------------------------------------

async def orchestrator_node(state: OrchestratorState, config):
    copilotkit_state = state.get("copilotkit", {})
    frontend_actions = copilotkit_state.get("actions", [])

    logger.info(
        f"[ORCHESTRATOR] messages={len(state.get('messages', []))} "
        f"frontend={len(frontend_actions)} spawn_tools={len(_spawn_tools)} backend_tools={len(_backend_tools)} "
        f"focused={state.get('focused_agent')} "
        f"active_widgets={[w.get('id') for w in (state.get('active_widgets') or [])]}"
    )

    try:
        from copilotkit.langgraph import copilotkit_customize_config
        config = copilotkit_customize_config(
            config,
            emit_tool_calls=False,  # MCP + skeleton tools handled in tools_node, no CopilotKit interception needed
            emit_intermediate_state=[
                {"state_key": "active_widgets", "tool": "*", "tool_argument": "*"},
                {"state_key": "widget_state", "tool": "*", "tool_argument": "*"},
            ],
        )
    except ImportError:
        pass

    # Bind: frontend (dumb) tools + skeleton tools + spawn tools + standalone backend tools
    all_tools = [*frontend_actions, *skeleton_tools, *_spawn_tools_with_op, *_backend_tools]
    llm_with_tools = llm.bind_tools(all_tools)
    pending = state.get("pending_agent_message")
    messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    if pending:
        from langchain_core.messages import HumanMessage
        messages = messages + [HumanMessage(content=pending)]
        logger.info(f"[ORCHESTRATOR] injecting pending message: {pending[:60]}")
    response = await _invoke_with_repair_and_retry(llm_with_tools, messages, config, "ORCHESTRATOR")

    if getattr(response, "tool_calls", None):
        for tc in response.tool_calls:
            is_backend = tc.get("name", "") in _server_tool_names
            logger.info(f"  tool_call: {tc.get('name')} → {'backend' if is_backend else 'AG-UI'}")

    # Sync dumb widget state: scan the latest ToolMessages for frontend-tool results
    # (dumb widgets executed on the client) and upsert them into active_widgets so
    # the canvas is authoritative even for agent=null widgets.
    state_patch: dict = {"pending_agent_message": None, "messages": [response]}
    _sync_dumb_widgets(state, state_patch)
    return state_patch


def _sync_dumb_widgets(state: OrchestratorState, patch: dict) -> None:
    """Upsert/remove dumb widget entries in active_widgets based on ToolMessage results.

    When the LLM calls a frontend (dumb) tool, the AG-UI protocol executes the
    handler on the client and appends the result as a ToolMessage in the follow-up
    runAgent call.  The backend never passed through those results before — this
    function reads the latest batch of ToolMessages and updates active_widgets so
    the canvas state stays consistent (enabling clear_canvas and replace_all to work).
    """
    messages = state.get("messages", [])
    # Find the index of the most recent AI message that has tool_calls.
    # ToolMessages that follow it (higher indices) are the current round's results.
    last_ai_idx = -1
    for i in range(len(messages) - 1, -1, -1):
        if hasattr(messages[i], "tool_calls") and getattr(messages[i], "tool_calls", None):
            last_ai_idx = i
            break

    if last_ai_idx < 0:
        return

    latest_tool_results = [
        m for m in messages[last_ai_idx + 1:]
        if hasattr(m, "tool_call_id")
    ]

    logger.info(f"[DUMB_SYNC] last_ai_idx={last_ai_idx} tool_results={len(latest_tool_results)} active={[w.get('id') for w in (state.get('active_widgets') or [])]}")

    if not latest_tool_results:
        return

    for tm in latest_tool_results:
        try:
            c = json.loads(tm.content) if isinstance(tm.content, str) else tm.content
        except Exception:
            c = {}
        logger.info(f"[DUMB_SYNC] tool_result content={c}")

    current_active = list(state.get("active_widgets") or [])
    changed = False

    for tm in latest_tool_results:
        try:
            content = json.loads(tm.content) if isinstance(tm.content, str) else tm.content
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(content, dict):
            continue

        if content.get("spawned") is True:
            widget_id = content.get("widgetId")
            operation = content.get("operation", "replace_all")
            if not widget_id:
                continue
            new_widget = {"id": widget_id, "type": "dumb", "props": content.get("props", {})}
            if operation == "replace_all":
                current_active = [new_widget]
            elif operation == "replace_one":
                current_active = [w for w in current_active if w["id"] != widget_id] + [new_widget]
            else:  # add
                if not any(w["id"] == widget_id for w in current_active):
                    current_active.append(new_widget)
            changed = True
            logger.info(f"[ORCH] dumb widget sync: {widget_id} operation={operation}")

        elif content.get("cleared") is not None:
            ids = content["cleared"]
            if ids == "all":
                current_active = []
            elif isinstance(ids, list):
                current_active = [w for w in current_active if w["id"] not in ids]
            changed = True

    if changed:
        patch["active_widgets"] = current_active


def route_orchestrator(state: OrchestratorState):
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        has_backend = any(tc.get("name") in _server_tool_names for tc in last.tool_calls)
        logger.info(f"[ORCHESTRATOR] tool_calls={[tc.get('name') for tc in last.tool_calls]} → {'tools' if has_backend else 'END (AG-UI)'}")
        return "tools" if has_backend else END
    return END


# ---------------------------------------------------------------------------
# Subagent node factory — generic, works for any SubagentConfig
# ---------------------------------------------------------------------------

def make_subagent_node(cfg):
    """Return a node function for the given subagent config."""
    # Inject handoff_to_orchestrator so examples don't have to define it
    subagent_tools = cfg.domain_tools + [handoff_to_orchestrator]
    llm_with_tools = llm.bind_tools(subagent_tools)

    async def subagent_node(state: OrchestratorState, config):
        logger.info(
            f"[SUBAGENT:{cfg.id}] messages={len(state.get('messages', []))} "
            f"widget_state={state.get('widget_state')}"
        )
        try:
            from copilotkit.langgraph import copilotkit_customize_config
            _config = copilotkit_customize_config(
                config,
                emit_tool_calls=True,
                emit_intermediate_state=[
                    {"state_key": "widget_state", "tool": "*", "tool_argument": "*"},
                    {"state_key": "active_widgets", "tool": "*", "tool_argument": "*"},
                ],
            )
        except ImportError:
            _config = config

        pending = state.get("pending_agent_message")
        # Auto-generate state protocol preamble from tracked_state declaration
        ws = state.get("widget_state") or {}
        state_suffix = ""
        if cfg.tracked_state:
            field_lines = "\n".join(f"  - {f.key}: {f.description}" for f in cfg.tracked_state)
            state_suffix = (
                "\n\n--- Widget State Protocol ---\n"
                "This widget has bidirectional state. Both you (via tools) and the user (via UI buttons) "
                "can change state. The authoritative live state is shown below. "
                "NEVER guess state from conversation history — always trust Current widget state.\n\n"
                f"Tracked fields:\n{field_lines}"
            )
        if ws:
            state_lines = "\n".join(f"  - {k}: {v}" for k, v in ws.items())
            state_suffix += f"\n\n--- Current widget state ---\n{state_lines}"
        base_messages = [SystemMessage(content=cfg.prompt + state_suffix)] + state["messages"]
        if pending:
            from langchain_core.messages import HumanMessage
            base_messages = base_messages + [HumanMessage(content=pending)]
            logger.info(f"  [SUBAGENT:{cfg.id}] injecting pending message: {pending[:60]}")
        response = await _invoke_with_repair_and_retry(llm_with_tools, base_messages, _config, f"SUBAGENT:{cfg.id}")

        if getattr(response, "tool_calls", None):
            for tc in response.tool_calls:
                logger.info(f"  [SUBAGENT:{cfg.id}] tool_call: {tc.get('name')}")

        return {"pending_agent_message": None, "messages": [response]}

    subagent_node.__name__ = f"subagent_{cfg.id}"
    return subagent_node


def route_subagent(state: OrchestratorState):
    """Generic route for any subagent: tool call → tools_node, else → END."""
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END


# ---------------------------------------------------------------------------
# Shared tools node — generic, driven by registry
# ---------------------------------------------------------------------------

async def tools_node(state: OrchestratorState) -> dict:
    """Unified tool executor. Handles all backend tool calls from any node.

    State-mutating tools are handled inline; domain tools whose return values
    update widget_state are called and merged generically.
    """
    last = state["messages"][-1]
    tool_names = [tc["name"] for tc in getattr(last, "tool_calls", [])]
    logger.info(f"[TOOLS] entering tools_node — calls: {tool_names} focused={state.get('focused_agent')}")
    messages = []
    state_updates: dict = {}

    for tc in last.tool_calls:
        name = tc["name"]

        if name == "clear_canvas":
            ids = tc["args"].get("widget_ids") or None
            if ids is not None and len(ids) == 0:
                ids = None
            current_active = list(state_updates.get("active_widgets", state.get("active_widgets") or []))
            if ids is None:
                state_updates["active_widgets"] = []
            else:
                state_updates["active_widgets"] = [w for w in current_active if w["id"] not in ids]
            logger.info(f"[TOOLS] clear_canvas ids={ids}")
            messages.append(ToolMessage(
                content=json.dumps({"cleared": ids if ids else "all"}),
                tool_call_id=tc["id"], name=name,
            ))

        elif name in _spawn_tool_map:
            cfg = _spawn_tool_map[name]
            # Pop operation param before calling spawn_tool.func
            args = dict(tc["args"])
            operation = args.pop("operation", "replace_all")
            # Call the spawn tool — its return value is the initial widget_state
            initial_ws = cfg.spawn_tool.func(**args)
            if not isinstance(initial_ws, dict):
                initial_ws = {}
            state_updates["focused_agent"] = cfg.id
            state_updates["widget_state"] = initial_ws
            # Build the new widget entry
            new_widget = {"id": cfg.id, "type": "smart", "props": args}
            # Read from state_updates first (respects earlier clear_canvas in same turn)
            current_active = list(state_updates.get("active_widgets", state.get("active_widgets") or []))
            if operation == "replace_all":
                state_updates["active_widgets"] = [new_widget]
            elif operation == "replace_one":
                state_updates["active_widgets"] = [w for w in current_active if w["id"] != cfg.id] + [new_widget]
            else:  # add
                if not any(w["id"] == cfg.id for w in current_active):
                    current_active.append(new_widget)
                state_updates["active_widgets"] = current_active
            if cfg.intro_message:
                state_updates["pending_agent_message"] = cfg.intro_message
            logger.info(f"[TOOLS] spawn '{name}' → focused_agent={cfg.id} operation={operation} intro={bool(cfg.intro_message)}")
            messages.append(ToolMessage(
                content=json.dumps({"spawned": cfg.id, **initial_ws}),
                tool_call_id=tc["id"], name=name,
            ))

        elif name == "handoff_to_orchestrator":
            prev_agent = state.get("focused_agent")
            summary = tc["args"].get("summary", "")
            state_updates["focused_agent"] = None
            if summary:
                state_updates["pending_agent_message"] = f"[Handoff from {prev_agent}]: {summary}"
            logger.info(f"[TOOLS] handoff_to_orchestrator: {prev_agent} → orchestrator summary={bool(summary)}")
            messages.append(ToolMessage(
                content=json.dumps({"status": "handing_off"}),
                tool_call_id=tc["id"], name=name,
            ))

        elif name in _domain_tool_map:
            fn = _domain_tool_map[name]
            result = fn.func(**tc["args"])
            # Merge result dict into widget_state
            if isinstance(result, dict) and "error" not in result:
                current_ws = dict(state.get("widget_state") or {})
                current_ws.update(result)
                state_updates["widget_state"] = current_ws
                logger.info(f"[TOOLS] domain '{name}' → widget_state={current_ws}")
            messages.append(ToolMessage(
                content=json.dumps(result) if isinstance(result, dict) else str(result),
                tool_call_id=tc["id"], name=name,
            ))

        elif name in _backend_tool_map:
            # Standalone backend tool (MCP queries, DB lookups, etc.)
            fn = _backend_tool_map[name]
            result = fn.func(**tc["args"])
            logger.info(f"[TOOLS] backend '{name}' → result={str(result)[:100]}")
            messages.append(ToolMessage(
                content=json.dumps(result) if isinstance(result, dict) else str(result),
                tool_call_id=tc["id"], name=name,
            ))

        else:
            # Should never reach here — route_orchestrator only sends _server_tool_names to tools_node
            logger.warning(f"[TOOLS] unexpected tool '{name}' in tools_node — not in any tool map")
            messages.append(ToolMessage(
                content=json.dumps({"error": f"Unknown tool: {name}"}),
                tool_call_id=tc["id"], name=name,
            ))

    return {**state_updates, "messages": messages}


# ---------------------------------------------------------------------------
# Entry and post-tools routing — generic
# ---------------------------------------------------------------------------

def route_entry(state: OrchestratorState):
    focused = state.get("focused_agent")
    if focused and focused in _registry:
        logger.info(f"[ENTRY] resuming subagent '{focused}'")
        return focused
    return "orchestrator"


def route_after_tools(state: OrchestratorState):
    # Detect if we just ran a spawn tool
    messages = state["messages"]
    for msg in reversed(messages):
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            if any(tc.get("name") in _spawn_tool_map for tc in msg.tool_calls):
                focused = state.get("focused_agent")
                if state.get("pending_agent_message") and focused and focused in _registry:
                    logger.info(f"[TOOLS] spawn + intro → subagent '{focused}' for greeting")
                    return focused
                logger.info("[TOOLS] spawn complete → END (subagent activates next turn)")
                return END
            break

    focused = state.get("focused_agent")
    if focused and focused in _registry:
        logger.info(f"[TOOLS] → subagent '{focused}'")
        return focused
    logger.info("[TOOLS] → orchestrator")
    return "orchestrator"


# ---------------------------------------------------------------------------
# Graph assembly — dynamic, driven by registry
# ---------------------------------------------------------------------------

def create_graph():
    workflow = StateGraph(OrchestratorState)

    workflow.add_node("orchestrator", orchestrator_node)
    workflow.add_node("tools", tools_node)

    subagent_ids = list(_registry.keys())

    # Add one node per registered subagent
    for subagent_id, cfg in _registry.items():
        workflow.add_node(subagent_id, make_subagent_node(cfg))
        workflow.add_conditional_edges(subagent_id, route_subagent, {
            "tools": "tools",
            END: END,
        })

    # Entry: resume active subagent or go to orchestrator
    entry_targets = {"orchestrator": "orchestrator", **{sid: sid for sid in subagent_ids}}
    workflow.add_conditional_edges(START, route_entry, entry_targets)

    # Orchestrator: backend call → tools, else → END
    workflow.add_conditional_edges("orchestrator", route_orchestrator, {
        "tools": "tools",
        END: END,
    })

    # After tools: route to active subagent, back to orchestrator, or END (after spawn)
    after_targets = {"orchestrator": "orchestrator", END: END, **{sid: sid for sid in subagent_ids}}
    workflow.add_conditional_edges("tools", route_after_tools, after_targets)

    return workflow.compile(
        checkpointer=MemorySaver(),
    ).with_config({"recursion_limit": 25})


graph = create_graph()

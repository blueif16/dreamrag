"""Widget platform orchestrator graph — skeleton only.

No example names, no widget names, no domain-specific logic.
All content is injected at startup via the subagent registry.
"""
import os
import json
import asyncio
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
from langgraph.types import Command
from langchain_core.messages import SystemMessage, ToolMessage, HumanMessage, AIMessage

from .state import OrchestratorState
from .tools import skeleton_tools, retriever_protocol_tools, clear_canvas, handoff_to_orchestrator, dispatch_to_spawner
from .subagents import load_subagent_registry
from examples import load_all_backend_tools
from examples.dreams.widget_tools import WIDGETS as _DUMB_WIDGETS


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


def _strip_think_tags(response):
    """Remove <think>...</think> blocks from Qwen3 responses."""
    import re
    if isinstance(response.content, str) and "<think>" in response.content:
        response.content = re.sub(r"<think>[\s\S]*?</think>\s*", "", response.content)
    return response


async def _invoke_with_repair_and_retry(llm_with_tools, messages, config, label: str):
    """Invoke LLM, repair invalid tool calls, and retry once if tool_calls still empty."""
    response = await llm_with_tools.ainvoke(messages, config=config)
    if hasattr(response, "additional_kwargs"):
        response.additional_kwargs.pop("reasoning_content", None)
    response = _strip_think_tags(response)
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
        response = _strip_think_tags(response)
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

# Dumb-widget spawn tools — backend-registered; state updates handled in tools_node.
_dumb_widget_tool_map = {cfg.spawn_tool.name: cfg for cfg in _DUMB_WIDGETS}

# Standalone backend tools (MCP queries, DB lookups — no widget spawn or state mutation)
_backend_tools = load_all_backend_tools()
_backend_tool_map = {t.name: t for t in _backend_tools}

# Partition backend tools by phase:
#   retrieval tools go to retriever_node; the rest (MCP-style lookups a spawner might
#   still need) go to the spawner.
_RETRIEVAL_TOOL_NAMES = {"search_dreams", "record_dream", "get_symbol_graph", "get_user_profile"}
_retrieval_backend_tools = [t for t in _backend_tools if t.name in _RETRIEVAL_TOOL_NAMES]
_spawner_backend_tools = [t for t in _backend_tools if t.name not in _RETRIEVAL_TOOL_NAMES]

# Union of all tool names routed to tools_node (everything else goes to AG-UI / frontend)
_server_tool_names = (
    {t.name for t in skeleton_tools}
    | {t.name for t in retriever_protocol_tools}
    | set(_spawn_tool_map.keys())
    | set(_domain_tool_map.keys())
    | set(_backend_tool_map.keys())
    | set(_dumb_widget_tool_map.keys())
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
            model=os.getenv("NEBIUS_MODEL", "Qwen/Qwen3.5-397B-A17B-fast"),
            base_url="https://api.tokenfactory.us-central1.nebius.com/v1/",
            api_key=os.getenv("NEBIUS_API_KEY"),
            temperature=0.7,
            model_kwargs={"parallel_tool_calls": False},
            extra_body={"enable_thinking": False},
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

RETRIEVER_PROMPT = """You are DreamRAG's retriever. Classify the user's intent and fetch the data the spawner will need.
You do NOT spawn dashboard widgets — call dispatch_to_spawner when you're done gathering, and the spawner will render from state.knowledge.

━━━ STEP 1: CLASSIFY THE USER'S INTENT ━━━

Decide which flow to use:
  A) NEW DREAM — user submits a dream narrative to analyze
  B) SYMBOL QUERY — user asks about a symbol ("what does water mean?")
  C) TEMPORAL/PATTERN — user asks about their history ("show my patterns", "how am I doing?")

━━━ STEP 2: RETRIEVE (before any widget spawns) ━━━

Flow A — NEW DREAM:
  1. search_dreams(dream_text, "dream_knowledge", 5)
  2. search_dreams(dream_text, "community_dreams", 5)
  3. search_dreams(dream_text, "user_default_dreams", 3)  ← may return 0 results for new users
  4. record_dream(dream_text, user_id)  ← MUST be LAST in this flow
     record_dream reads state.knowledge (populated by the searches above) and
     calls an LLM to extract emotions / symbols / characters / interaction /
     lucidity / vividness / HVdC counts. Running it before the searches means
     the tagger has no context and every column stays empty. Order matters.

Flow B — SYMBOL QUERY:
  1. search_dreams(symbol, "dream_knowledge", 5)
  2. search_dreams(symbol, "community_dreams", 5)
  3. get_symbol_graph(symbol)

Flow C — TEMPORAL/PATTERN:
  No retrieval needed — widgets are self-contained.
  BUT: only use this flow if the user_default_dreams search from a prior turn returned results,
  or if the user explicitly asks for patterns. Never spawn analytics for a brand-new user.

Each search_dreams result contains chunks with an "id" field (integer). The spawner will read them from state.knowledge.

━━━ CONVERSATIONAL FOLLOW-UPS ━━━

If the user's message is a short clarifying question, a conversational aside, or asks something
the structural widgets don't cover (and the answer is a 1–4 sentence prose reply), call
show_text_response(message, source_chunk_ids?) instead of spawning dashboard widgets.
This is how you deliver text — NEVER emit free assistant text, it won't render.
Prefer structural widgets whenever the answer has structure (symbols, similar dreams,
interpretations, patterns).

━━━ HANDOFF ━━━

When the searches you need are complete and widgets should be rendered, call dispatch_to_spawner(note?).
Optional `note` is one short line of guidance for the spawner (e.g. "user sounds anxious").
If you've already answered with show_text_response, do NOT also dispatch — the turn ends.
"""


SPAWNER_PROMPT = """You are DreamRAG's spawner. The retriever already gathered data — it is in state.knowledge and summarised in the human message below.
You do NOT search. You spawn glassmorphic dashboard widgets by calling tools. Every widget on screen was created by a tool call — there is no other way to show UI.

━━━ STEP 1: CLASSIFY THE USER'S INTENT ━━━

Decide which flow to use:
  A) NEW DREAM — user submits a dream narrative to analyze
  B) SYMBOL QUERY — user asks about a symbol ("what does water mean?")
  C) TEMPORAL/PATTERN — user asks about their history ("show my patterns", "how am I doing?")

━━━ STEP 3: SPAWN WIDGETS (synthesize from retrieved chunks — never invent) ━━━

Flow A widgets (spawn in this order):
  show_current_dream (replace_all) — meaning synthesized from dream_knowledge chunks. subconscious_emotion and life_echo 1-2 sentences each.
  show_dream_atmosphere (add)      — center_symbol + satellites extracted from chunk text
  show_textbook_card (add)         — excerpt = direct quote/paraphrase from a dream_knowledge chunk
  show_community_mirror (add)      — snippets = actual community_dreams results with similarity scores
  show_followup_chat (add)         — prompts the USER might tap to ask next (user's first-person voice, NOT questions you ask them)
  IF user_default_dreams returned results:
    show_echoes_card (add)         — echoes from user's past dreams (use actual content)
    show_emotional_climate (add)   — no args, self-contained
    show_recurrence_card (add)     — no args, self-contained
    show_stat_card (add)           — personal vs baseline from corpus_stats metadata

Flow B widgets (spawn in this order):
  show_interpretation_synthesis (replace_all) — each paragraph from a different namespace, tag source
  show_textbook_card (add)
  show_symbol_cooccurrence_network (add)      — symbol connections with weight percentages from get_symbol_graph
  show_community_mirror (add)
  show_emotion_split (add)
  show_followup_chat (add)         — prompts the USER might tap to ask next (user's first-person voice, NOT questions you ask them)

Flow C widgets (spawn in this order):
  show_emotional_climate (replace_all)
  show_heatmap_calendar (add)
  show_dream_streak (add)
  show_top_symbol (add)
  show_recurrence_card (add)
  show_stat_card (add)

━━━ RULES ━━━

- First widget of the response: operation='replace_all'. Every widget after: operation='add' (never 'replace_all' — it wipes your own dashboard).
- Keep spawning — one widget per turn — until the flow's list is done. Don't stop after 1–2.
- Check `Already-spawned widgets` in the human message. Pick the NEXT widget in the flow; never respawn one that's already there.
- When the flow is complete, call show_text_response(message="Dashboard ready.") to finish.
- Every agent-populated widget MUST include source_chunk_ids — paste the integer ids of whichever chunks from "Available chunk IDs" / "Retrieved knowledge" actually backed this widget's content (e.g. [52432, 11234]). Never pass empty [] when chunks exist. Self-contained widgets take no args.
- Write each widget's prose fields (meaning, subconscious_emotion, life_echo, excerpt, etc.) with 2–4 full sentences of concrete detail drawn directly from the chunk text — quote fragments, name symbols, use specifics. Don't hand-wave.
- Never emit free text — widgets are the response.
"""

SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT", SPAWNER_PROMPT)


# ---------------------------------------------------------------------------
# Helpers: extract user message + format knowledge blob for spawner
# ---------------------------------------------------------------------------

def _extract_last_user_text(messages) -> str:
    """Walk messages in reverse to find the most recent HumanMessage content."""
    for m in reversed(messages or []):
        if isinstance(m, HumanMessage):
            content = m.content
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                return " ".join(str(c) for c in content)
    return ""


def _format_knowledge(knowledge: dict) -> str:
    """Compact text view of state.knowledge for injection into the spawner's context."""
    if not knowledge:
        return "(no retrieval results)"
    lines = []
    for ns, chunks in knowledge.items():
        if not chunks:
            lines.append(f"[{ns}] 0 chunks")
            continue
        lines.append(f"[{ns}] {len(chunks)} chunks:")
        for c in chunks:
            if not isinstance(c, dict):
                lines.append(f"  - {str(c)[:200]}")
                continue
            cid = c.get("id", "?")
            excerpt = (c.get("content") or c.get("text") or c.get("excerpt") or "")
            if isinstance(excerpt, str):
                excerpt = excerpt[:240].replace("\n", " ")
            sim = c.get("similarity") or c.get("score")
            extras = c.get("metadata") or {}
            sim_str = f" sim={sim:.2f}" if isinstance(sim, (int, float)) else ""
            extra_str = f" meta={extras}" if extras else ""
            lines.append(f"  - id={cid}{sim_str} {excerpt}{extra_str}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Retriever node — classify intent, fetch data, dispatch to spawner
# ---------------------------------------------------------------------------

async def retriever_node(state: OrchestratorState, config):
    copilotkit_state = state.get("copilotkit", {})
    frontend_actions = copilotkit_state.get("actions", [])

    # Retriever only gets the conversational off-ramp (show_text_response), plus retrieval
    # backend tools and the dispatch protocol tool. No spawn tools.
    # text_tools = [a for a in frontend_actions if getattr(a, "name", "") == "show_text_response"]
    # show_text_response is now backend-registered (see _dumb_widget_tool_map).
    _text_response_tool = _dumb_widget_tool_map["show_text_response"].spawn_tool

    _kn = state.get("knowledge") or {}
    logger.info(
        f"[RETRIEVER] messages={len(state.get('messages', []))} "
        f"frontend={len(frontend_actions)} text_tool=backend "
        f"retrieval_tools={len(_retrieval_backend_tools)} "
        f"knowledge_ns={list(_kn.keys())} "
        f"knowledge_chunk_counts={ {ns: len(v or []) for ns, v in _kn.items()} }"
    )

    try:
        from copilotkit.langgraph import copilotkit_customize_config
        config = copilotkit_customize_config(
            config,
            emit_tool_calls=False,
            emit_intermediate_state=[
                {"state_key": "knowledge", "tool": "*", "tool_argument": "*"},
            ],
        )
    except ImportError:
        pass

    all_tools = [_text_response_tool, *retriever_protocol_tools, *_retrieval_backend_tools]
    llm_with_tools = llm.bind_tools(all_tools)

    messages = [SystemMessage(content=RETRIEVER_PROMPT)] + state["messages"]
    response = await _invoke_with_repair_and_retry(llm_with_tools, messages, config, "RETRIEVER")

    # ─── Code-level guardrail ────────────────────────────────────────────
    # Qwen periodically skips the RETRIEVE step — it goes straight to
    # record_dream or dispatch_to_spawner before any search_dreams runs.
    # The prompt's "Flow A: search × 3 then record" directive is insufficient.
    # If state.knowledge is empty AND no prior search_dreams ran in this
    # thread AND the LLM is trying to record/dispatch, nudge it and retry.
    _current_knowledge = state.get("knowledge") or {}
    _prior_search_ran = any(
        isinstance(m, ToolMessage) and getattr(m, "name", "") == "search_dreams"
        for m in (state.get("messages") or [])
    )
    for _attempt in range(2):
        tool_calls = getattr(response, "tool_calls", None) or []
        bad_names = {tc.get("name") for tc in tool_calls} & {"record_dream", "dispatch_to_spawner"}
        if not bad_names or _current_knowledge or _prior_search_ran:
            break
        logger.warning(
            f"[RETRIEVER] BLOCKING premature {bad_names} — state.knowledge is empty and "
            f"no search_dreams in history (attempt {_attempt+1}/2). Re-invoking with nudge."
        )
        nudge = HumanMessage(content=(
            "STOP. You attempted to call " + ", ".join(sorted(bad_names)) + " before any "
            "search_dreams has run. state.knowledge is empty — there is nothing to "
            "record or dispatch. You MUST call search_dreams FIRST. For a new dream, "
            "do: search_dreams(<dream text>, 'dream_knowledge', 5). Try again now — "
            "emit a search_dreams tool call."
        ))
        retry_messages = messages + [nudge]
        response = await _invoke_with_repair_and_retry(
            llm_with_tools, retry_messages, config, f"RETRIEVER-retry{_attempt+1}"
        )

    tool_calls = getattr(response, "tool_calls", None) or []
    invalid_tool_calls = getattr(response, "invalid_tool_calls", None) or []
    content_preview = (response.content or "")[:200] if isinstance(response.content, str) else str(response.content)[:200]
    logger.info(
        f"[RETRIEVER] LLM response: tool_calls={len(tool_calls)} "
        f"invalid_tool_calls={len(invalid_tool_calls)} "
        f"content={content_preview!r}"
    )
    if tool_calls:
        for tc in tool_calls:
            logger.info(f"  tool_call: {tc.get('name')}")
    if invalid_tool_calls:
        for itc in invalid_tool_calls:
            logger.warning(f"  invalid_tool_call: {itc}")

    state_patch: dict = {"messages": [response]}
    # Dumb widgets now update active_widgets directly in tools_node — no post-hoc sync.
    # _sync_dumb_widgets(state, state_patch)
    return state_patch


# ---------------------------------------------------------------------------
# Spawner node — render dashboard from retrieved knowledge
# ---------------------------------------------------------------------------

async def spawner_node(state: OrchestratorState, config):
    copilotkit_state = state.get("copilotkit", {})
    frontend_actions = copilotkit_state.get("actions", [])

    _spawner_kn = state.get("knowledge") or {}
    logger.info(
        f"[SPAWNER] frontend={len(frontend_actions)} spawn_tools={len(_spawn_tools)} "
        f"knowledge_ns={list(_spawner_kn.keys())} "
        f"knowledge_chunk_counts={ {ns: len(v or []) for ns, v in _spawner_kn.items()} } "
        f"note={(state.get('note') or '')[:80]!r} "
        f"focused={state.get('focused_agent')} "
        f"active_widgets={[w.get('id') for w in (state.get('active_widgets') or [])]}"
    )

    try:
        from copilotkit.langgraph import copilotkit_customize_config
        config = copilotkit_customize_config(
            config,
            emit_tool_calls=False,
            emit_intermediate_state=[
                {"state_key": "active_widgets", "tool": "*", "tool_argument": "*"},
                {"state_key": "widget_state", "tool": "*", "tool_argument": "*"},
            ],
        )
    except ImportError:
        pass

    # Dumb widget spawn tools are now backend-registered — frontend_actions are superseded.
    # all_tools = [*frontend_actions, *skeleton_tools, *_spawn_tools_with_op, *_spawner_backend_tools]
    _dumb_spawn_tools = [cfg.spawn_tool for cfg in _DUMB_WIDGETS]
    all_tools = [*_dumb_spawn_tools, *skeleton_tools, *_spawn_tools_with_op, *_spawner_backend_tools]
    # Force tool emission every turn — otherwise Qwen tends to generate a
    # multi-line "plan" as prose, burns the token budget, and returns 0 tool
    # calls which ends the turn prematurely. show_text_response (goto=END) is
    # in the toolset, so the model still has a valid termination move.
    llm_with_tools = llm.bind_tools(all_tools, tool_choice="required")

    # Fresh minimal context — do NOT replay retriever's tool-call history.
    user_msg = _extract_last_user_text(state.get("messages") or [])
    knowledge = state.get("knowledge") or {}
    knowledge_blob = _format_knowledge(knowledge)
    note = state.get("note") or "-"
    active_ids = [w.get("id") for w in (state.get("active_widgets") or [])]
    # Explicit per-namespace id list so the model has the exact integers it
    # must pass through source_chunk_ids. Without this it defaults to [].
    _avail_ids: dict[str, list] = {}
    for ns, chunks in knowledge.items():
        ids = [c.get("id") for c in (chunks or []) if isinstance(c, dict) and c.get("id") is not None]
        if ids:
            _avail_ids[ns] = ids
    avail_ids_line = (
        ", ".join(f"{ns}={ids}" for ns, ids in _avail_ids.items()) or "(none)"
    )

    human_content = (
        f"User: {user_msg}\n\n"
        f"Available chunk IDs (copy these integers into source_chunk_ids on every "
        f"agent-populated widget you spawn): {avail_ids_line}\n\n"
        f"Retrieved knowledge:\n{knowledge_blob}\n\n"
        f"Retriever note: {note}\n\n"
        f"Already-spawned widgets (do NOT respawn — pick the NEXT one in the flow, "
        f"or call show_text_response to finish if the flow is complete): {active_ids}"
    )
    logger.info(
        f"[SPAWNER] human_content bytes={len(human_content)} "
        f"knowledge_blob_bytes={len(knowledge_blob)} "
        f"knowledge_blob_head={knowledge_blob[:300]!r}"
    )

    messages = [SystemMessage(content=SPAWNER_PROMPT), HumanMessage(content=human_content)]
    pending = state.get("pending_agent_message")
    if pending:
        messages.append(HumanMessage(content=pending))
        logger.info(f"[SPAWNER] injecting pending message: {pending[:60]}")

    response = await _invoke_with_repair_and_retry(llm_with_tools, messages, config, "SPAWNER")

    tool_calls = getattr(response, "tool_calls", None) or []
    invalid_tool_calls = getattr(response, "invalid_tool_calls", None) or []
    content_preview = (response.content or "")[:200] if isinstance(response.content, str) else str(response.content)[:200]
    logger.info(
        f"[SPAWNER] LLM response: tool_calls={len(tool_calls)} "
        f"invalid_tool_calls={len(invalid_tool_calls)} "
        f"content={content_preview!r}"
    )
    if tool_calls:
        for tc in tool_calls:
            is_backend = tc.get("name", "") in _server_tool_names
            logger.info(f"  tool_call: {tc.get('name')} → {'backend' if is_backend else 'AG-UI'}")
    if invalid_tool_calls:
        for itc in invalid_tool_calls:
            logger.warning(f"  invalid_tool_call: {itc}")

    state_patch: dict = {"pending_agent_message": None, "messages": [response]}
    # Dumb widgets now update active_widgets directly in tools_node — no post-hoc sync.
    # _sync_dumb_widgets(state, state_patch)
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
    seen_replace_all = False

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
            # Guard: if the LLM sends multiple replace_all in one turn,
            # only the first actually clears; the rest become "add".
            if operation == "replace_all":
                if seen_replace_all:
                    operation = "add"
                else:
                    seen_replace_all = True
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

from .state import merge_knowledge as _merge_knowledge


def _apply_command_update(update: dict, state: OrchestratorState, state_updates: dict, messages: list) -> None:
    """Merge a Command.update payload into our running state_updates + messages."""
    update = dict(update or {})
    cmd_messages = update.pop("messages", []) or []
    for m in cmd_messages:
        messages.append(m)
    for k, v in update.items():
        if k == "knowledge":
            # Merge with running updates first, then with current state (handled by reducer on return)
            running = state_updates.get("knowledge")
            if running is None:
                running = dict(state.get("knowledge") or {})
            state_updates["knowledge"] = _merge_knowledge(running, v)
        else:
            state_updates[k] = v


async def tools_node(state: OrchestratorState):
    """Unified tool executor. Handles all backend tool calls from any node.

    Retrieval tools (search_dreams et al.) may return a `Command` that writes into
    state.knowledge; `dispatch_to_spawner` routes to the spawner node. Other tools
    return a plain dict which is wrapped into a ToolMessage.
    """
    last = state["messages"][-1]
    tool_names = [tc["name"] for tc in getattr(last, "tool_calls", [])]
    logger.info(f"[TOOLS] entering tools_node — calls: {tool_names} focused={state.get('focused_agent')}")
    messages = []
    state_updates: dict = {}
    pending_goto: str | None = None

    # Pre-fetch all async backend tools concurrently (I/O-bound: search, record, etc.)
    # Using fn.ainvoke(tc) so InjectedToolCallId / Command pattern work correctly.
    async_results: dict[str, object] = {}
    async_coros = []
    async_tc_ids = []
    async_tc_names = []
    # Tools that use InjectedState need `state` passed through their args.
    # Our custom tools_node bypasses prebuilt ToolNode's auto-injection, so do it here.
    _STATE_INJECTED_TOOLS = {"record_dream"}
    for tc in last.tool_calls:
        name = tc["name"]
        if name in _backend_tool_map:
            fn = _backend_tool_map[name]
            if fn.coroutine:
                if name in _STATE_INJECTED_TOOLS:
                    patched_tc = {**tc, "args": {**(tc.get("args") or {}), "state": state}}
                    async_coros.append(fn.ainvoke(patched_tc))
                else:
                    async_coros.append(fn.ainvoke(tc))
                async_tc_ids.append(tc["id"])
                async_tc_names.append(name)
    if async_coros:
        logger.info(f"[TOOLS] running {len(async_coros)} async backend tools in parallel")
        results = await asyncio.gather(*async_coros, return_exceptions=True)
        for tc_id, result in zip(async_tc_ids, results):
            async_results[tc_id] = result

    for tc in last.tool_calls:
        name = tc["name"]

        # Async backend tool — use pre-fetched result
        if tc["id"] in async_results:
            result = async_results[tc["id"]]
            if isinstance(result, BaseException):
                logger.error(f"[TOOLS] async backend '{name}' failed: {result}")
                messages.append(ToolMessage(
                    content=json.dumps({"error": str(result)}),
                    tool_call_id=tc["id"], name=name,
                ))
            elif isinstance(result, Command):
                upd = result.update or {}
                # Expand knowledge payload so we can SEE what search_dreams
                # actually handed back before the reducer merges it.
                kn_in_update = upd.get("knowledge") or {}
                kn_summary = {ns: len(v or []) for ns, v in kn_in_update.items()} if kn_in_update else {}
                logger.info(
                    f"[TOOLS] backend '{name}' → Command update_keys={list(upd.keys())} "
                    f"knowledge_in_update={kn_summary} goto={result.goto}"
                )
                _apply_command_update(upd, state, state_updates, messages)
                # After merge, show the running state_updates knowledge so we
                # can confirm the reducer absorbed this batch.
                running_kn = state_updates.get("knowledge") or state.get("knowledge") or {}
                logger.info(
                    f"[TOOLS] backend '{name}' → post-merge state.knowledge={ {ns: len(v or []) for ns, v in running_kn.items()} }"
                )
                if result.goto:
                    pending_goto = result.goto
            elif isinstance(result, ToolMessage):
                logger.info(f"[TOOLS] backend '{name}' → ToolMessage content={str(result.content)[:100]}")
                messages.append(result)
            else:
                logger.info(f"[TOOLS] backend '{name}' → result={str(result)[:100]}")
                messages.append(ToolMessage(
                    content=json.dumps(result) if isinstance(result, dict) else str(result),
                    tool_call_id=tc["id"], name=name,
                ))
            continue

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

        elif name in _dumb_widget_tool_map:
            cfg = _dumb_widget_tool_map[name]
            args = dict(tc["args"])
            operation = args.pop("operation", "add")
            # Auto-fill source_chunk_ids from state.knowledge when the LLM
            # forgot / hallucinated. Qwen repeatedly passes [] here despite
            # explicit prompt + schema instructions. Normalise dict/str shapes
            # too so the frontend's parseChunkIds() gets pure ints.
            if "source_chunk_ids" in args:
                raw = args.get("source_chunk_ids")
                normalised: list[int] = []
                if isinstance(raw, list):
                    for item in raw:
                        if isinstance(item, int):
                            normalised.append(item)
                        elif isinstance(item, dict) and isinstance(item.get("id"), int):
                            normalised.append(item["id"])
                        elif isinstance(item, str) and item.isdigit():
                            normalised.append(int(item))
                if not normalised:
                    # LLM forgot — paste every chunk id currently in state.knowledge.
                    kn = state.get("knowledge") or {}
                    fallback: list[int] = []
                    for _ns, _chunks in kn.items():
                        for c in (_chunks or []):
                            if isinstance(c, dict) and isinstance(c.get("id"), int):
                                fallback.append(c["id"])
                    if fallback:
                        logger.warning(
                            f"[TOOLS] dumb widget '{name}' passed empty source_chunk_ids — "
                            f"auto-filling all {len(fallback)} from state.knowledge"
                        )
                        normalised = fallback
                args["source_chunk_ids"] = normalised
            new_widget = {"id": cfg.id, "type": "dumb", "props": args}
            current_active = list(state_updates.get("active_widgets", state.get("active_widgets") or []))
            # Safeguard: mid-dashboard replace_all would wipe every card the
            # spawner just rendered. If there are already widgets on the canvas
            # at the start of this tool call, downgrade replace_all → add.
            if operation == "replace_all" and current_active:
                logger.warning(
                    f"[TOOLS] dumb widget '{name}' requested replace_all but canvas "
                    f"already has {[w['id'] for w in current_active]} — downgrading to 'add' "
                    f"to prevent mid-spawn wipe."
                )
                operation = "add"
            if operation == "replace_all":
                state_updates["active_widgets"] = [new_widget]
            elif operation == "replace_one":
                state_updates["active_widgets"] = [w for w in current_active if w["id"] != cfg.id] + [new_widget]
            else:  # add
                if not any(w["id"] == cfg.id for w in current_active):
                    current_active.append(new_widget)
                state_updates["active_widgets"] = current_active
            _sci = args.get("source_chunk_ids")
            logger.info(
                f"[TOOLS] dumb widget '{name}' → id={cfg.id} operation={operation} "
                f"goto={cfg.goto} source_chunk_ids={_sci} arg_keys={list(args.keys())}"
            )
            messages.append(ToolMessage(
                content=json.dumps({"spawned": True, "widgetId": cfg.id, "operation": operation}),
                tool_call_id=tc["id"], name=name,
            ))
            if cfg.goto:
                pending_goto = cfg.goto

        elif name == "handoff_to_orchestrator":
            prev_agent = state.get("focused_agent")
            summary = tc["args"].get("summary", "")
            state_updates["focused_agent"] = None
            if summary:
                state_updates["pending_agent_message"] = f"[Handoff from {prev_agent}]: {summary}"
            logger.info(f"[TOOLS] handoff_to_orchestrator: {prev_agent} → retriever summary={bool(summary)}")
            messages.append(ToolMessage(
                content=json.dumps({"status": "handing_off"}),
                tool_call_id=tc["id"], name=name,
            ))

        elif name == "dispatch_to_spawner":
            note = tc["args"].get("note", "") or ""
            state_updates["note"] = note
            pending_goto = "spawner"
            logger.info(f"[TOOLS] dispatch_to_spawner note={note[:80]!r} → routing to spawner")
            messages.append(ToolMessage(
                content=json.dumps({"status": "dispatching", "note": note}),
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
            # Sync-only backend tool (async ones handled by pre-fetch above)
            fn = _backend_tool_map[name]
            result = fn.func(**tc["args"])
            logger.info(f"[TOOLS] backend '{name}' → result={str(result)[:100]}")
            messages.append(ToolMessage(
                content=json.dumps(result) if isinstance(result, dict) else str(result),
                tool_call_id=tc["id"], name=name,
            ))

        else:
            logger.warning(f"[TOOLS] unexpected tool '{name}' in tools_node — skipping (frontend tool?)")
            messages.append(ToolMessage(
                content=json.dumps({"error": f"Unknown tool: {name}"}),
                tool_call_id=tc["id"], name=name,
            ))

    # Always route via Command. Previously the graph also registered
    # conditional_edges on "tools" which caused LangGraph to fan the tools
    # node out into two parallel branches (spawner from Command.goto AND
    # retriever from the edge), producing double AIMessages and eventually
    # HTTP 400 from the chat API. Compute routing here and never return a
    # plain dict.
    if pending_goto is None:
        # Determine fallback: smart-spawn → END/subagent; focused subagent → subagent;
        # otherwise retriever (search/record/etc.).
        call_names = [tc.get("name") for tc in last.tool_calls]
        focused = state_updates.get("focused_agent", state.get("focused_agent"))
        if any(n in _spawn_tool_map for n in call_names):
            if state_updates.get("pending_agent_message") and focused and focused in _registry:
                pending_goto = focused
            else:
                pending_goto = END
        elif focused and focused in _registry:
            pending_goto = focused
        else:
            pending_goto = "retriever"
    logger.info(f"[TOOLS] exiting → {pending_goto}")
    return Command(update={**state_updates, "messages": messages}, goto=pending_goto)


# ---------------------------------------------------------------------------
# Entry and post-tools routing — generic
# ---------------------------------------------------------------------------

def route_entry(state: OrchestratorState):
    focused = state.get("focused_agent")
    if focused and focused in _registry:
        logger.info(f"[ENTRY] resuming subagent '{focused}'")
        return focused
    return "retriever"


def route_after_tools(state: OrchestratorState):
    """Fallback router invoked only when tools_node returned a plain dict (no Command.goto).

    Dispatch-to-spawner paths are handled by the Command returned from tools_node directly
    and never hit this function.
    """
    messages = state["messages"]

    # Find the most recent AI tool-call batch
    last_tool_calls = None
    for msg in reversed(messages):
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            last_tool_calls = msg.tool_calls
            break

    if last_tool_calls:
        names = [tc.get("name") for tc in last_tool_calls]
        # Spawn tool just fired → end the turn (subagent activates next turn if intro pending)
        if any(n in _spawn_tool_map for n in names):
            focused = state.get("focused_agent")
            if state.get("pending_agent_message") and focused and focused in _registry:
                logger.info(f"[TOOLS] spawn + intro → subagent '{focused}' for greeting")
                return focused
            logger.info("[TOOLS] spawn complete → END (subagent activates next turn)")
            return END

    focused = state.get("focused_agent")
    if focused and focused in _registry:
        logger.info(f"[TOOLS] → subagent '{focused}'")
        return focused
    logger.info("[TOOLS] → retriever (default fallback)")
    return "retriever"


# ---------------------------------------------------------------------------
# Graph assembly — dynamic, driven by registry
# ---------------------------------------------------------------------------

def create_graph():
    workflow = StateGraph(OrchestratorState)

    workflow.add_node("retriever", retriever_node)
    workflow.add_node("spawner", spawner_node)
    workflow.add_node("tools", tools_node)

    subagent_ids = list(_registry.keys())

    # Add one node per registered subagent
    for subagent_id, cfg in _registry.items():
        workflow.add_node(subagent_id, make_subagent_node(cfg))
        workflow.add_conditional_edges(subagent_id, route_subagent, {
            "tools": "tools",
            END: END,
        })

    # Entry: resume active subagent or go to retriever (new default)
    entry_targets = {"retriever": "retriever", **{sid: sid for sid in subagent_ids}}
    workflow.add_conditional_edges(START, route_entry, entry_targets)

    # Retriever + Spawner: tool call → tools, else → END
    workflow.add_conditional_edges("retriever", route_orchestrator, {
        "tools": "tools",
        END: END,
    })
    workflow.add_conditional_edges("spawner", route_orchestrator, {
        "tools": "tools",
        END: END,
    })

    # tools_node now always returns Command(goto=...) — routing is fully
    # self-contained. Adding conditional_edges on "tools" would fan the node
    # out into two concurrent branches (Command.goto + edge target),
    # producing double AIMessages the chat API rejects with HTTP 400.

    return workflow.compile(
        checkpointer=MemorySaver(),
    ).with_config({"recursion_limit": 500})


graph = create_graph()

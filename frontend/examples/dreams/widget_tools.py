"""All DreamRAG widget spawn tools as backend LangGraph tools.

Each widget is a StructuredTool bound to the spawner LLM. The tool body is a
no-op — state mutation (active_widgets upsert) happens in graph.py tools_node,
mirroring the smart-widget _spawn_tool_map pattern.

goto controls post-execution routing:
  - "spawner"  → return to spawner node to continue rendering more widgets
  - END        → terminate the turn (used by show_text_response)
"""
from dataclasses import dataclass
from typing import Any

from langchain_core.tools import StructuredTool
from langgraph.graph import END
from pydantic import Field as PydanticField
from pydantic import create_model


_TYPE_MAP: dict[str, Any] = {
    "string": str,
    "number": float,
    "boolean": bool,
    "array": list,
    "object": dict,
}

_OPERATION_DESC = (
    "Canvas placement: 'add' (DEFAULT) adds alongside existing widgets — "
    "use this for every widget except the FIRST one in a fresh dashboard. "
    "'replace_all' clears all widgets first — ONLY use on the very first "
    "widget of a new user question. 'replace_one' removes only this widget's "
    "id then adds it."
)

# Consistent strong description reused on every widget that is grounded in
# retrieved chunks. Qwen kept passing [] here; this description is deliberately
# blunt about what to copy and where from.
_SOURCE_CHUNK_IDS_DESC = (
    "REQUIRED integer array — copy the `id=` values shown in the "
    "`Available chunk IDs` / `Retrieved knowledge` block of the user message. "
    "Every widget grounded in retrieval (i.e. whose content came from search "
    "results) MUST list the ids of the chunks that backed it. Never pass an "
    "empty [] when the user message shows chunk ids. Example: [52432, 11234, 89012]."
)


@dataclass
class DumbWidgetConfig:
    id: str
    spawn_tool: StructuredTool
    goto: str  # "spawner" or END ("__end__")


def _noop(**kwargs) -> dict:
    """Tool body placeholder — real state update lives in tools_node."""
    return {"spawned": True}


def _make(
    widget_id: str,
    tool_name: str,
    description: str,
    params: dict[str, tuple[str, str]],
    goto: str = "spawner",
) -> DumbWidgetConfig:
    fields: dict[str, tuple[type, Any]] = {}
    for pname, (ptype, pdesc) in params.items():
        fields[pname] = (_TYPE_MAP[ptype], PydanticField(description=pdesc))
    fields["operation"] = (
        str,
        PydanticField(default="add", description=_OPERATION_DESC),
    )
    ArgsModel = create_model(f"{tool_name}_Args", **fields)
    return DumbWidgetConfig(
        id=widget_id,
        spawn_tool=StructuredTool(
            name=tool_name,
            description=description,
            func=_noop,
            args_schema=ArgsModel,
        ),
        goto=goto,
    )


WIDGETS: list[DumbWidgetConfig] = [
    _make(
        widget_id="current_dream",
        tool_name="show_current_dream",
        description=(
            "Show the dream reading — a clear interpretation grounded in retrieved knowledge. "
            "Synthesize all content FROM retrieved chunks. meaning should be the main "
            "interpretation paragraph. subconscious_emotion and life_echo should each be 1-2 "
            "sentences max. [Layout: half width, tall height]"
        ),
        params={
            "title": ("string", "Short dream title, e.g. 'Water under the old house'"),
            "quote": ("string", "The dream narrative text as recalled by the user"),
            "meaning": (
                "string",
                "Synthesized from dream_knowledge chunks — symbolic/psychological meaning",
            ),
            "subconscious_emotion": (
                "string",
                "Synthesized from dream_knowledge emotional theory chunks, 1-2 sentences",
            ),
            "life_echo": (
                "string",
                "Synthesized from community_dreams chunks — how this pattern shows up in "
                "others' dreams, 1-2 sentences",
            ),
            "source_chunk_ids": ("array", _SOURCE_CHUNK_IDS_DESC),
        },
    ),
    _make(
        widget_id="community_mirror",
        tool_name="show_community_mirror",
        description=(
            "Show anonymized community dream snippets that match the user's symbol. snippets "
            "must come directly from community_dreams search results — use the actual returned "
            "content and scores. [Layout: third width, medium height]"
        ),
        params={
            "symbol": ("string", "The symbol being mirrored, e.g. 'water'"),
            "snippets": (
                "array",
                "Array of {text: string, emotions: string[], similarity: number} — taken from "
                "community_dreams search results, similarity = score from result",
            ),
            "source_chunk_ids": ("array", _SOURCE_CHUNK_IDS_DESC),
        },
    ),
    _make(
        widget_id="dream_atmosphere",
        tool_name="show_dream_atmosphere",
        description=(
            "Show a symbol map listing the key symbols found in this dream. Extract "
            "center_symbol and satellites from dream_knowledge chunk content. "
            "[Layout: third width, medium height]"
        ),
        params={
            "center_symbol": (
                "string",
                "The dominant dream symbol extracted from the dream text and confirmed in "
                "retrieved chunks",
            ),
            "satellites": (
                "array",
                "Related symbol strings extracted from dream_knowledge chunk content, "
                "e.g. ['Falling','House','Night']",
            ),
            "source_chunk_ids": ("array", _SOURCE_CHUNK_IDS_DESC),
        },
    ),
    _make(
        widget_id="dream_streak",
        tool_name="show_dream_streak",
        description=(
            "Show a journal rhythm card with streak count and 7-day recording indicator. "
            "[Layout: third width, compact height]"
        ),
        params={
            "streak": ("number", "Current consecutive day streak, e.g. 27"),
            "last7": (
                "array",
                "Array of 7 booleans (most recent last), true=recorded, false=missed",
            ),
        },
    ),
    _make(
        widget_id="echoes_card",
        tool_name="show_echoes_card",
        description=(
            "Show past dream echoes as a timeline thread. Populate from search_dreams results "
            "against user_{id}_dreams namespace — use the actual returned content as echoes, "
            "not invented text. [Layout: third width, compact height]"
        ),
        params={
            "echoes": (
                "array",
                "Array of {date: string, title: string, text: string} — use content from user "
                "past dream search results, up to 3",
            ),
            "source_chunk_ids": ("array", _SOURCE_CHUNK_IDS_DESC),
        },
    ),
    _make(
        widget_id="emotion_split",
        tool_name="show_emotion_split",
        description=(
            "Show horizontal bar charts comparing emotion distribution for a specific dream "
            "symbol vs overall emotion distribution. Instant visual comparison. "
            "[Layout: third width, medium height]"
        ),
        params={
            "symbol": ("string", "The symbol being compared, e.g. 'Water'"),
            "symbol_emotions": (
                "array",
                "Array of {label: string, value: number} emotions for this symbol",
            ),
            "overall_emotions": (
                "array",
                "Array of {label: string, value: number} emotions across all dreams",
            ),
        },
    ),
    _make(
        widget_id="emotional_climate",
        tool_name="show_emotional_climate",
        description=(
            "Show the emotional landscape across the user's dream history as elegant "
            "horizontal bars. Self-contained — widget fetches user profile data directly from "
            "/api/user-profile. Call with NO parameters. [Layout: half width, medium height]"
        ),
        params={},
    ),
    _make(
        widget_id="followup_chat",
        tool_name="show_followup_chat",
        description=(
            "Show suggested follow-up questions the USER might want to ask next about their "
            "dream. These are written from the user's perspective — things they could tap to "
            "continue exploring — NOT questions the assistant is asking the user. Each prompt "
            "should reference a specific concept from the retrieved dream_knowledge and "
            "community_dreams chunks. [Layout: third width, tall height]"
        ),
        params={
            "dream_title": ("string", "The dream title being discussed"),
            "prompts": (
                "array",
                "2-4 follow-up questions phrased from the user's first-person perspective "
                "(e.g. 'What does the falling symbol mean in Jung's work?', 'Why do I keep "
                "dreaming about teeth?'). NEVER phrase as the assistant asking the user "
                "(e.g. 'What in your waking life feels...' is WRONG). These are tappable "
                "suggestions for what the user might ask next.",
            ),
            "source_chunk_ids": ("array", _SOURCE_CHUNK_IDS_DESC),
        },
    ),
    _make(
        widget_id="heatmap_calendar",
        tool_name="show_heatmap_calendar",
        description=(
            "Show a heatmap calendar of dream recording frequency over the past month. "
            "[Layout: half width, compact height]"
        ),
        params={
            "month": ("string", "Month label, e.g. 'March'"),
            "data": (
                "array",
                "7-row x N-col 2D array of activity levels 0-4 (rows=days Mon-Sun, cols=weeks)",
            ),
        },
    ),
    _make(
        widget_id="interpretation_synthesis",
        tool_name="show_interpretation_synthesis",
        description=(
            "Show a symbol deep dive with grounded, multi-source interpretation. Each "
            "paragraph must be synthesized from retrieved chunks — tag source as 'personal' "
            "(user_dreams), 'textbook' (dream_knowledge), or 'community' (community_dreams). "
            "Paragraphs are displayed with colored left borders by source type. "
            "[Layout: half width, tall height]"
        ),
        params={
            "symbol": ("string", "The dream symbol or theme, e.g. 'Water'"),
            "subtitle": ("string", "A poetic subtitle synthesized from retrieved content"),
            "paragraphs": (
                "array",
                "Array of {text: string, source: 'personal'|'textbook'|'community'} — each "
                "paragraph from a different namespace's chunks",
            ),
            "source_chunk_ids": ("array", _SOURCE_CHUNK_IDS_DESC),
        },
    ),
    _make(
        widget_id="recurrence_card",
        tool_name="show_recurrence_card",
        description=(
            "Show recurring dream symbols with frequency indicators. Self-contained — widget "
            "fetches user profile data directly from /api/user-profile. Call with NO "
            "parameters. [Layout: half width, medium height]"
        ),
        params={},
    ),
    _make(
        widget_id="stat_card",
        tool_name="show_stat_card",
        description=(
            "Show a comparison metric card with personal vs population average bars. "
            "[Layout: third width, compact height]"
        ),
        params={
            "label": ("string", "Metric label, e.g. 'Water Frequency'"),
            "personal": ("number", "User's percentage value, e.g. 31"),
            "baseline": ("number", "Population baseline percentage, e.g. 12"),
            "description": ("string", "One-line context, e.g. 'of your dreams feature water'"),
        },
    ),
    _make(
        widget_id="symbol_cooccurrence_network",
        tool_name="show_symbol_cooccurrence_network",
        description=(
            "Show a ranked list of symbols that co-occur with a central symbol. Each row "
            "renders as a weighted bar with a percentage. [Layout: half width, medium height]"
        ),
        params={
            "center_symbol": ("string", "The central symbol, e.g. 'Water'"),
            "nodes": (
                "array",
                "Array of {label: string, weight: number (0-1)} co-occurring symbols sorted "
                "by weight descending",
            ),
        },
    ),
    _make(
        widget_id="text_response",
        tool_name="show_text_response",
        description=(
            "Deliver a conversational text answer when visualization widgets aren't the right "
            "fit — e.g. the user asks a clarifying question, wants a short discussion, or "
            "requests an answer the dashboard widgets don't cover. Prefer spawning structural "
            "widgets (current_dream, community_mirror, etc.) whenever the answer has "
            "structure. Use this for 1–4 sentence conversational replies grounded in retrieved "
            "chunks. Plain prose, no markdown. [Layout: full width, compact height]"
        ),
        params={
            "message": (
                "string",
                "The natural-language answer as plain prose. 1–4 sentences.",
            ),
            "source_chunk_ids": ("array", _SOURCE_CHUNK_IDS_DESC),
        },
        goto=END,
    ),
    _make(
        widget_id="textbook_card",
        tool_name="show_textbook_card",
        description=(
            "Show an authoritative textbook excerpt styled as a literary blockquote. excerpt "
            "must be a direct quote or close paraphrase from a dream_knowledge chunk — not "
            "invented. [Layout: third width, medium height]"
        ),
        params={
            "symbol": ("string", "The dream symbol name, e.g. 'Water'"),
            "excerpt": (
                "string",
                "Direct quote or close paraphrase from a retrieved dream_knowledge chunk",
            ),
            "author": ("string", "Author name, e.g. 'C.G. Jung'"),
            "source": ("string", "Book/source title"),
            "source_chunk_ids": ("array", _SOURCE_CHUNK_IDS_DESC),
        },
    ),
    _make(
        widget_id="top_symbol",
        tool_name="show_top_symbol",
        description=(
            "Show the most frequently occurring dream symbol with co-occurrence pills. "
            "[Layout: third width, compact height]"
        ),
        params={
            "symbol": ("string", "The top symbol name, e.g. 'Water'"),
            "count": ("number", "How many times it appeared, e.g. 9"),
            "window": ("string", "Time window, e.g. 'last 30 dreams'"),
            "cooccurrences": (
                "array",
                "Array of {label: string, count: number} co-occurring symbols",
            ),
        },
    ),
]

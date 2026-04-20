"""Tests for user profile → dashboard card pipeline.

Layer 1: Data correctness (deterministic, no LLM)
Layer 2: Tool output (deterministic, no LLM)
Layer 3: LLM integration (semi-deterministic, marked slow)

Run fast tests:  pytest tests/test_user_profile_cards.py -m "not slow" -v
Run all:          pytest tests/test_user_profile_cards.py -v
"""
import os
import sys
import calendar
import uuid

import pytest
from dotenv import load_dotenv

# Path setup — same as server.py:8
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_frontend_dir = os.path.dirname(_backend_dir)
sys.path.insert(0, _backend_dir)
sys.path.insert(0, _frontend_dir)
load_dotenv(os.path.join(_backend_dir, ".env"), override=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 1 — Data Correctness (deterministic, no LLM)
# ═══════════════════════════════════════════════════════════════════════════════

from app.core.user_profile import recompute_profile


class TestLayer1DataCorrectness:
    """Verify recompute_profile returns correctly shaped data for seeded dreams."""

    def test_recompute_returns_dict(self):
        profile = recompute_profile("demo_dreamer")
        assert isinstance(profile, dict)
        assert profile["user_id"] == "demo_dreamer"

    def test_emotion_distribution_shape(self):
        profile = recompute_profile("demo_dreamer")
        ed = profile["emotion_distribution"]
        assert isinstance(ed, list)
        assert len(ed) > 0, "Seeded dreams should produce at least 1 emotion"
        for item in ed:
            assert isinstance(item["label"], str)
            assert isinstance(item["pct"], int)
            assert 0 <= item["pct"] <= 100

    def test_recurrence_shape(self):
        profile = recompute_profile("demo_dreamer")
        rec = profile["recurrence"]
        assert isinstance(rec, list)
        assert len(rec) > 0, "Seeded dreams should produce at least 1 recurring symbol"
        for item in rec:
            assert isinstance(item["label"], str)
            assert isinstance(item["value"], str)
            assert item["value"].endswith("\u00d7"), f"Expected '×' suffix, got {item['value']!r}"
            assert isinstance(item["note"], str)

    def test_streak_shape(self):
        profile = recompute_profile("demo_dreamer")
        assert isinstance(profile["current_streak"], int)
        assert profile["current_streak"] >= 0

    def test_last7_shape(self):
        profile = recompute_profile("demo_dreamer")
        last7 = profile["last7"]
        assert isinstance(last7, list)
        assert len(last7) == 7
        assert all(isinstance(b, bool) for b in last7)

    def test_heatmap_data_shape(self):
        profile = recompute_profile("demo_dreamer")
        grid = profile["heatmap_data"]
        assert isinstance(grid, list)
        assert len(grid) == 7, "Heatmap should have 7 rows (Mon–Sun)"
        for row in grid:
            assert isinstance(row, list)
            assert all(isinstance(v, int) and 0 <= v <= 4 for v in row)

    def test_heatmap_month_valid(self):
        profile = recompute_profile("demo_dreamer")
        assert profile["heatmap_month"] in list(calendar.month_name)[1:]

    def test_total_dreams_positive(self):
        profile = recompute_profile("demo_dreamer")
        assert profile["total_dreams"] >= 13


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 2 — Tool Output (deterministic, no LLM)
# ═══════════════════════════════════════════════════════════════════════════════

from examples.dreams.tools import get_user_profile


class TestLayer2ToolOutput:
    """Verify the @tool wrapper returns correct shapes from Supabase."""

    async def test_get_user_profile_returns_profile(self):
        result = await get_user_profile.ainvoke({"user_id": "demo_dreamer"})
        assert isinstance(result, dict)
        assert result.get("user_id") == "demo_dreamer"
        assert isinstance(result["emotion_distribution"], list)
        assert isinstance(result["recurrence"], list)
        assert isinstance(result["current_streak"], int)
        last7 = result["last7"]
        assert isinstance(last7, list)
        assert len(last7) == 7

    async def test_nonexistent_user_returns_empty_defaults(self):
        fake_id = f"nonexistent_{uuid.uuid4().hex[:8]}"
        result = await get_user_profile.ainvoke({"user_id": fake_id})
        assert isinstance(result, dict)
        assert "error" not in result or result.get("status") != "error"
        assert result["emotion_distribution"] == []
        assert result["recurrence"] == []
        assert result["current_streak"] == 0
        assert result["last7"] == [False] * 7
        assert result["total_dreams"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# Layer 3 — LLM Integration (requires LLM API, marked slow)
# ═══════════════════════════════════════════════════════════════════════════════

from langchain_core.messages import HumanMessage
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import List


class DreamStreakArgs(BaseModel):
    streak: int = Field(description="Current consecutive day streak")
    last7: List[bool] = Field(description="Array of 7 booleans")
    operation: str = Field(default="add")


class HeatmapCalendarArgs(BaseModel):
    month: str = Field(description="Month label")
    data: List[List[int]] = Field(description="7-row x N-col 2D array of 0-4")
    operation: str = Field(default="add")


class EmotionalClimateArgs(BaseModel):
    operation: str = Field(default="add")


class RecurrenceCardArgs(BaseModel):
    operation: str = Field(default="add")


def _make_dumb_tool(name: str, description: str, schema) -> StructuredTool:
    """Create a StructuredTool mimicking a frontend dumb-widget spawn tool."""
    def handler(**kwargs):
        return {"spawned": True, "widgetId": name.replace("show_", ""), "props": kwargs}
    return StructuredTool(name=name, description=description, func=handler, args_schema=schema)


DUMB_WIDGET_TOOLS = [
    _make_dumb_tool(
        "show_dream_streak",
        "Show a streak card with consecutive-days count and 7-day activity dots.",
        DreamStreakArgs,
    ),
    _make_dumb_tool(
        "show_heatmap_calendar",
        "Show a GitHub-style heatmap calendar of dream recording frequency.",
        HeatmapCalendarArgs,
    ),
    _make_dumb_tool(
        "show_emotional_climate",
        "Show emotional distribution across dream history. Self-fetching, no params needed.",
        EmotionalClimateArgs,
    ),
    _make_dumb_tool(
        "show_recurrence_card",
        "Show recurring symbol statistics. Self-fetching, no params needed.",
        RecurrenceCardArgs,
    ),
]

EXPECTED_SPAWN_NAMES = {
    "show_dream_streak", "show_heatmap_calendar",
    "show_emotional_climate", "show_recurrence_card",
}


def _collect_tool_calls(messages) -> list[dict]:
    """Extract all tool_calls from AI messages in a conversation."""
    calls = []
    for msg in messages:
        for tc in getattr(msg, "tool_calls", []):
            calls.append(tc)
    return calls


def _make_test_graph():
    """Compile the graph without a checkpointer to avoid StructuredTool serialization issues."""
    from agent.graph import create_graph
    from langgraph.graph import StateGraph
    from agent.state import OrchestratorState
    # create_graph compiles with MemorySaver — we reuse the workflow but compile without it
    # Instead, import the builder and compile fresh
    import agent.graph as g
    workflow = StateGraph(OrchestratorState)
    workflow.add_node("orchestrator", g.orchestrator_node)
    workflow.add_node("tools", g.tools_node)
    from langgraph.graph import START, END
    for sid, cfg in g._registry.items():
        workflow.add_node(sid, g.make_subagent_node(cfg))
        workflow.add_conditional_edges(sid, g.route_subagent, {"tools": "tools", END: END})
    entry_targets = {"orchestrator": "orchestrator", **{sid: sid for sid in g._registry}}
    workflow.add_conditional_edges(START, g.route_entry, entry_targets)
    workflow.add_conditional_edges("orchestrator", g.route_orchestrator, {"tools": "tools", END: END})
    after_targets = {"orchestrator": "orchestrator", END: END, **{sid: sid for sid in g._registry}}
    workflow.add_conditional_edges("tools", g.route_after_tools, after_targets)
    return workflow.compile().with_config({"recursion_limit": 25})


@pytest.mark.slow
class TestLayer3LLMIntegration:
    """Invoke the full LangGraph orchestrator and verify it spawns dashboard cards."""

    async def test_dashboard_spawns_cards(self):
        test_graph = _make_test_graph()

        result = await test_graph.ainvoke(
            {
                "messages": [HumanMessage(
                    content="Show me my full dream dashboard: streak, heatmap, emotional climate, and recurrences."
                )],
                "copilotkit": {"actions": DUMB_WIDGET_TOOLS},
            },
        )

        all_calls = _collect_tool_calls(result["messages"])
        assert len(all_calls) > 0, "LLM should have made at least one tool call"

        called_names = {tc["name"] for tc in all_calls}
        spawned = called_names & EXPECTED_SPAWN_NAMES
        assert len(spawned) >= 2, (
            f"Expected at least 2 of {EXPECTED_SPAWN_NAMES}, got {spawned}. "
            f"All calls: {[tc['name'] for tc in all_calls]}"
        )

    async def test_streak_and_heatmap_arg_shapes(self):
        test_graph = _make_test_graph()

        result = await test_graph.ainvoke(
            {
                "messages": [HumanMessage(
                    content="Show my dream streak card and heatmap calendar with real data from my profile."
                )],
                "copilotkit": {"actions": DUMB_WIDGET_TOOLS},
            },
        )

        all_calls = _collect_tool_calls(result["messages"])
        streak_calls = [tc for tc in all_calls if tc["name"] == "show_dream_streak"]
        heatmap_calls = [tc for tc in all_calls if tc["name"] == "show_heatmap_calendar"]

        if streak_calls:
            args = streak_calls[0]["args"]
            assert isinstance(args.get("streak"), (int, float))
            last7 = args.get("last7")
            assert isinstance(last7, list) and len(last7) == 7
            assert all(isinstance(b, bool) for b in last7)

        if heatmap_calls:
            args = heatmap_calls[0]["args"]
            assert isinstance(args.get("month"), str)
            data = args.get("data")
            assert isinstance(data, list) and len(data) == 7
            for row in data:
                assert isinstance(row, list)
                assert all(isinstance(v, int) and 0 <= v <= 4 for v in row)

        assert streak_calls or heatmap_calls, (
            f"Expected at least one of streak/heatmap. All calls: {[tc['name'] for tc in all_calls]}"
        )

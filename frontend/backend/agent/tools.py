"""Skeleton protocol tools.

Only tools that are part of the scaffold contract live here.
Content-specific tools (widget spawn tools, domain tools) live in examples/.
"""
from typing import List, Optional
from langchain_core.tools import tool, BaseTool


@tool
def clear_canvas(widget_ids: Optional[List[str]] = None) -> str:
    """Remove widgets from the canvas.

    Args:
        widget_ids: IDs of specific widgets to remove (e.g. ["user_card", "topic_progress"]).
                    Omit or pass None/[] to clear ALL widgets.
    """
    # State mutation handled by tools_node in graph.py.
    return ""


@tool
def handoff_to_orchestrator(summary: str = "") -> dict:
    """Return control to the main orchestrator.
    Call this when the user is done with this widget or asks for something outside your domain.

    Args:
        summary: Brief summary of what happened in this session, passed to the orchestrator.
    """
    # State mutation (clear focused_agent, store summary) handled by tools_node in graph.py.
    return {"status": "handing_off"}


@tool
def dispatch_to_spawner(note: str = "") -> dict:
    """Hand off to the spawner node to render the dashboard using the knowledge you've gathered.
    Call this after you've issued the search_dreams / record_dream / get_symbol_graph calls
    you need. The spawner reads state.knowledge and spawns widgets — you do not spawn widgets.

    Args:
        note: Optional one-line hint for the spawner (e.g. "user sounds anxious, prioritize emotion widgets").
              Leave empty if there's nothing useful to add.
    """
    # State mutation + routing handled by tools_node in graph.py (returns Command(goto="spawner")).
    return {"status": "dispatching", "note": note}


# Protocol tools always present in the skeleton (bound on spawner + subagents via handoff).
skeleton_tools: list[BaseTool] = [clear_canvas]

# Retriever-only protocol tools (bound on retriever node; spawner never sees these).
retriever_protocol_tools: list[BaseTool] = [dispatch_to_spawner]

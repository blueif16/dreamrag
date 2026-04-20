"""Orchestrator state schema for LangGraph."""
from typing import Any, Dict, List, Optional
from typing_extensions import Annotated
from copilotkit import CopilotKitState

# Each active_widget entry is a dict with keys:
#   id:    str  — Widget ID matching WidgetConfig.id (e.g. "firework", "user_card")
#   type:  str  — "smart" | "dumb"
#   props: dict — The arguments the LLM passed to the spawn tool
ActiveWidget = Dict[str, Any]


def merge_knowledge(old: Dict[str, List[dict]] | None, new: Dict[str, List[dict]] | None) -> Dict[str, List[dict]]:
    """Reducer for the `knowledge` state field.

    Merges per-namespace chunk lists from multiple search calls.
    Dedupes by chunk `id` when present; otherwise appends.
    """
    old = dict(old or {})
    if not new:
        return old
    for ns, chunks in new.items():
        if not isinstance(chunks, list):
            continue
        existing = list(old.get(ns) or [])
        seen_ids = {c.get("id") for c in existing if isinstance(c, dict) and c.get("id") is not None}
        for c in chunks:
            if isinstance(c, dict) and c.get("id") is not None:
                if c["id"] in seen_ids:
                    continue
                seen_ids.add(c["id"])
            existing.append(c)
        old[ns] = existing
    return old


class OrchestratorState(CopilotKitState):
    """
    Widget platform orchestrator state.

    Extends CopilotKitState (which provides `messages` + `copilotkit` for
    frontend tool discovery via AG-UI protocol).

    Attributes:
        messages:        Conversation messages (from CopilotKitState)
        copilotkit:      Frontend tool registrations (from CopilotKitState)
        active_widgets:  All widgets currently on canvas — both smart and dumb.
                         Each entry: {id, type, props}. Single source of truth.
        focused_agent:   Sub-agent that owns chat right now. None = orchestrator.
        widget_state:    State of the focused smart widget. Empty when no focus.
        widget_summaries: Past focus sessions — summary strings keyed by widget ID.
        pending_agent_message: Intro message to send on subagent first turn.
        knowledge:       Retrieval buckets populated by the retriever via search tools.
                         {namespace: [chunk, ...]}. Consumed by the spawner.
        note:            Optional one-liner hint from retriever → spawner.
    """
    active_widgets: List[ActiveWidget] = []
    focused_agent: Optional[str] = None
    widget_state: Dict[str, Any] = {}
    widget_summaries: Dict[str, str] = {}
    pending_agent_message: Optional[str] = None
    knowledge: Annotated[Dict[str, List[dict]], merge_knowledge] = {}
    note: Optional[str] = None

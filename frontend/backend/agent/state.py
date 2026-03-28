"""Orchestrator state schema for LangGraph."""
from typing import Any, Dict, List, Optional
from copilotkit import CopilotKitState

# Each active_widget entry is a dict with keys:
#   id:    str  — Widget ID matching WidgetConfig.id (e.g. "firework", "user_card")
#   type:  str  — "smart" | "dumb"
#   props: dict — The arguments the LLM passed to the spawn tool
ActiveWidget = Dict[str, Any]


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
    """
    active_widgets: List[ActiveWidget] = []
    focused_agent: Optional[str] = None
    widget_state: Dict[str, Any] = {}
    widget_summaries: Dict[str, str] = {}
    pending_agent_message: Optional[str] = None

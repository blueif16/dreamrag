"""Handoff logic for smart widget → orchestrator transitions.

When a smart widget's sub-agent detects the user wants to do something
outside its domain, it calls handoff_to_orchestrator which:
1. Stores a summary of the session
2. Clears focused_agent
3. Trims message history
4. Routes back to orchestrator

Not implemented yet — placeholder for future smart widget support.
"""


def handoff_node(state, config):
    """Handle transition from sub-agent back to orchestrator.

    Called when a sub-agent's handoff_to_orchestrator tool fires.
    """
    raise NotImplementedError(
        "Handoff node not yet implemented. "
        "This will be built when smart widgets are added."
    )

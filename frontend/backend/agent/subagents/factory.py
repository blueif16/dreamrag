"""Factory for building smart widget subgraphs.

Each smart widget gets its own LangGraph subgraph with:
- A domain-expert system prompt (from prompt.md)
- Domain-specific tools (from tools.py)
- A handoff_to_orchestrator tool for returning control

Not implemented yet — placeholder for future smart widget support.
"""


def build_widget_subgraph(agent_id: str, prompt: str, tools: list):
    """Build a LangGraph subgraph for a smart widget agent.

    Args:
        agent_id: Unique identifier for this sub-agent
        prompt: System prompt text (loaded from prompt.md)
        tools: List of langchain tools for this domain

    Returns:
        Compiled LangGraph subgraph
    """
    raise NotImplementedError(
        f"Smart widget subgraph '{agent_id}' not yet implemented. "
        "This will be built when smart widgets are added."
    )

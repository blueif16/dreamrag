"""Tests for LangGraph agent."""
import pytest
from agent.graph import graph
from agent.state import AgentState


def test_graph_execution_with_task():
    """Test graph execution with a task."""
    initial_state: AgentState = {
        "messages": [],
        "current_task": "test task",
        "result": ""
    }

    result = graph.invoke(initial_state)

    assert "result" in result
    assert "test task" in result["result"]
    assert result["result"] == "Processed task: test task"


def test_graph_execution_with_messages():
    """Test graph execution with messages."""
    initial_state: AgentState = {
        "messages": ["msg1", "msg2", "msg3"],
        "current_task": "",
        "result": ""
    }

    result = graph.invoke(initial_state)

    assert "result" in result
    assert "3 messages" in result["result"]


def test_graph_execution_empty_state():
    """Test graph execution with empty state."""
    initial_state: AgentState = {
        "messages": [],
        "current_task": "",
        "result": ""
    }

    result = graph.invoke(initial_state)

    assert "result" in result
    assert result["result"] == "No task to process"

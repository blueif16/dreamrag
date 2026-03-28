# Examples package — aggregates tools and subagent configs from ALL example apps automatically.

import importlib
import logging
import os
from typing import List, TYPE_CHECKING
from langchain_core.tools import BaseTool

if TYPE_CHECKING:
    from backend.agent.subagents.registry import SubagentConfig

logger = logging.getLogger(__name__)


def _iter_examples():
    examples_dir = os.path.dirname(os.path.abspath(__file__))
    for entry in sorted(os.listdir(examples_dir)):
        path = os.path.join(examples_dir, entry)
        if not os.path.isdir(path):
            continue
        if entry.startswith("_") or entry.startswith(".") or entry == "__pycache__":
            continue
        yield entry


def load_all_backend_tools() -> List[BaseTool]:
    """Auto-discover standalone backend tools from all example apps.

    Each example that has backend tools (MCP queries, DB lookups, etc.) must
    export `all_tools` in its `tools.py`. Spawn tools should NOT be included
    here — they are registered via SUBAGENTS in each example's __init__.py.
    """
    all_tools: List[BaseTool] = []
    for entry in _iter_examples():
        try:
            module = importlib.import_module(f"examples.{entry}.tools")
            tools = getattr(module, "all_tools", [])
            logger.info(f"[examples] loaded {len(tools)} backend tools from {entry}")
            all_tools.extend(tools)
        except ImportError:
            pass
        except Exception as e:
            logger.warning(f"[examples] error loading tools from {entry}: {e}")
    logger.info(f"[examples] total backend tools: {len(all_tools)}")
    return all_tools


def load_all_subagents() -> list:
    """Auto-discover SubagentConfig objects from all example apps.

    Each example with smart widgets must export `SUBAGENTS: list[SubagentConfig]`
    in its top-level `__init__.py`.
    """
    all_subagents = []
    for entry in _iter_examples():
        try:
            module = importlib.import_module(f"examples.{entry}")
            subagents = getattr(module, "SUBAGENTS", [])
            if subagents:
                logger.info(f"[examples] loaded {len(subagents)} subagent(s) from {entry}")
            all_subagents.extend(subagents)
        except ImportError:
            pass
        except Exception as e:
            logger.warning(f"[examples] error loading subagents from {entry}: {e}")
    logger.info(f"[examples] total subagents: {len(all_subagents)}")
    return all_subagents


__all__ = ["load_all_backend_tools", "load_all_subagents"]

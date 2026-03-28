"""Subagent registry — skeleton only.

Loads SubagentConfig objects from examples at startup.
The graph uses this registry to dynamically create nodes and route — it never
references any example name directly.
"""
import importlib
import logging
import os
from dataclasses import dataclass, field
from typing import Dict
from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)


@dataclass
class TrackedStateField:
    """Declares a widget_state key that the skeleton should track and expose to the subagent.

    Attributes:
        key:         The widget_state dict key (e.g. "current_state").
        description: Human-readable description shown in the auto-generated prompt
                     (e.g. "Matter phase: solid, liquid, or gas").
    """
    key: str
    description: str


@dataclass
class SubagentConfig:
    """Everything the skeleton needs to run a smart widget subagent.

    Provided entirely by the example — the skeleton never imports from examples directly.

    Attributes:
        id:           Unique subagent/widget id (e.g. "particle_sim").
                      Must match widget.config.ts `agent` field and active_widgets entries.
        spawn_tool:   The orchestrator-level tool the LLM calls to launch this subagent.
                      Its return value becomes the initial widget_state.
        domain_tools: Tools bound exclusively to this subagent's LLM.
                      Do NOT include handoff_to_orchestrator — skeleton injects it.
        prompt:       System prompt text for this subagent's LLM.
        tracked_state: Declarative state schema. The skeleton auto-generates a state
                      protocol preamble so the subagent knows about bidirectional state.
    """
    id: str
    spawn_tool: BaseTool
    domain_tools: list[BaseTool]
    prompt: str
    intro_message: str = ""
    tracked_state: list[TrackedStateField] = field(default_factory=list)


def load_subagent_registry() -> Dict[str, SubagentConfig]:
    """Auto-discover SubagentConfig objects from all examples.

    Each example that has smart widgets must export a `SUBAGENTS` list of SubagentConfig.
    """
    registry: Dict[str, SubagentConfig] = {}
    examples_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "examples"
    )
    examples_dir = os.path.normpath(examples_dir)

    for entry in sorted(os.listdir(examples_dir)):
        if not os.path.isdir(os.path.join(examples_dir, entry)):
            continue
        if entry.startswith("_") or entry.startswith(".") or entry == "__pycache__":
            continue

        try:
            mod = importlib.import_module(f"examples.{entry}")
            subagents = getattr(mod, "SUBAGENTS", [])
            for cfg in subagents:
                if not (hasattr(cfg, "id") and hasattr(cfg, "spawn_tool") and hasattr(cfg, "domain_tools") and hasattr(cfg, "prompt")):
                    logger.warning(f"[registry] {entry}.SUBAGENTS entry missing required fields, skipping")
                    continue
                registry[cfg.id] = cfg
                logger.info(f"[registry] registered subagent '{cfg.id}' from {entry}")
        except ImportError:
            pass  # example has no Python __init__ — fine
        except Exception as e:
            logger.warning(f"[registry] error loading subagents from {entry}: {e}")

    logger.info(f"[registry] total subagents: {list(registry.keys())}")
    return registry

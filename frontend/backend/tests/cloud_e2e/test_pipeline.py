"""End-to-end pipeline test against the cloud-hosted Qwen3.6-35B-A3B VM.

Single test that drives the real graph with a real dream narrative, records
every LLM invocation to a JSONL file, and asserts the retriever → spawner
contract holds:

  1. Retriever issues >=1 search_dreams call and dispatches to spawner.
  2. Spawner receives a FRESH context (System + Human only) — no ToolMessage
     from the retriever era.
  3. Spawner emits >=1 spawn tool call.
  4. Final state has `knowledge` populated and `active_widgets` non-empty.

Run:
    export LLM_PROVIDER=openai
    export OPENAI_BASE_URL=http://35.231.190.210:8081/v1
    export OPENAI_API_KEY=not-needed
    export OPENAI_MODEL=qwen3.6-35b-a3b
    cd frontend/backend
    pytest tests/cloud_e2e/test_pipeline.py -v -s -m cloud_e2e

Outputs are written to tests/cloud_e2e/runs/<timestamp>.jsonl.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import pytest
from dotenv import load_dotenv
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, ConfigDict, Field

# ── sys.path + env ────────────────────────────────────────────────────────
_HERE = Path(__file__).resolve()
_BACKEND_DIR = _HERE.parents[2]
_FRONTEND_DIR = _BACKEND_DIR.parent
sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_FRONTEND_DIR))
load_dotenv(_BACKEND_DIR / ".env", override=True)

# ── logging ───────────────────────────────────────────────────────────────
RUNS_DIR = _HERE.parent / "runs"
RUNS_DIR.mkdir(exist_ok=True)
RUN_TS = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
RUN_UUID = uuid.uuid4().hex[:8]
RUN_JSONL = RUNS_DIR / f"{RUN_TS}_{RUN_UUID}.jsonl"
RUN_LOG = RUNS_DIR / f"{RUN_TS}_{RUN_UUID}.log"
TEST_MARKER = f"[E2E_TEST_MARKER_{RUN_UUID}]"

# Unbuffered file handler — writes every record immediately so `tail -f` works.
_fmt = logging.Formatter("%(asctime)s [%(name)s] %(message)s", "%H:%M:%S")
_fh = logging.FileHandler(RUN_LOG)
_fh.setFormatter(_fmt)
_fh.setLevel(logging.INFO)

_sh = logging.StreamHandler(sys.stdout)
_sh.setFormatter(_fmt)
_sh.setLevel(logging.INFO)

log = logging.getLogger("e2e")
log.setLevel(logging.INFO)
if not log.handlers:
    log.addHandler(_fh)
    log.addHandler(_sh)
log.propagate = False

# Pipe agent.graph logs (the shipped node logging) into the same file so
# you see retriever/spawner/tools logs interleaved with our own timing.
for _name in ("agent.graph", "examples.dreams.tools"):
    _l = logging.getLogger(_name)
    _l.setLevel(logging.INFO)
    _l.addHandler(_fh)
    _l.addHandler(_sh)
    _l.propagate = False


def _jsonl(kind: str, **payload: Any) -> None:
    rec = {"ts": time.time(), "kind": kind, **payload}
    with RUN_JSONL.open("a") as f:
        f.write(json.dumps(rec, default=str) + "\n")


class _Timer:
    """Context manager that logs the wall time of a step and dumps a jsonl record."""

    def __init__(self, name: str, **extra: Any) -> None:
        self.name = name
        self.extra = extra

    def __enter__(self) -> "_Timer":
        self.t0 = time.perf_counter()
        log.info(f"▶ {self.name} — start")
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        ms = int((time.perf_counter() - self.t0) * 1000)
        status = "ok" if exc is None else f"FAIL ({exc_type.__name__})"
        log.info(f"■ {self.name} — {status} in {ms} ms")
        _jsonl("step", name=self.name, wall_ms=ms, status=status, **self.extra)


# ══════════════════════════════════════════════════════════════════════════
# Pre-flight: cloud LLM + Supabase must be reachable. No stubbing.
# ══════════════════════════════════════════════════════════════════════════

def _preflight() -> None:
    base = os.getenv("OPENAI_BASE_URL", "").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "")
    if not base or not model:
        pytest.fail("OPENAI_BASE_URL / OPENAI_MODEL must point to the cloud VM")

    log.info(f"pre-flight: GET {base}/models")
    try:
        r = httpx.get(f"{base}/models", timeout=10.0)
        r.raise_for_status()
    except Exception as e:
        pytest.fail(f"cloud LLM endpoint unreachable: {e}")
    body = r.json()
    ids = [m.get("id") for m in body.get("data", [])]
    if model not in ids:
        pytest.fail(f"model {model!r} not served (got {ids})")
    log.info(f"pre-flight: LLM ok — serving {ids}")

    try:
        from supabase import create_client

        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")
        if not (url and key):
            pytest.fail("SUPABASE_URL / SUPABASE_SECRET_KEY not set")
        client = create_client(url, key)
        client.table("documents").select("id").limit(1).execute()
        log.info("pre-flight: Supabase ok")
    except Exception as e:
        pytest.fail(f"Supabase unreachable: {e}")


# ══════════════════════════════════════════════════════════════════════════
# New graph topology (April 2026): dumb widgets are backend-registered via
# examples.dreams.widget_tools.WIDGETS — the spawner LLM binds them directly
# in graph.py and tools_node updates active_widgets in-place. The old
# `copilotkit.actions` plumbing is no longer consulted for tool binding, so
# we no longer need to fabricate fake frontend tools. We still pass an empty
# `copilotkit.actions` for schema-compat with CopilotKitState.
# ══════════════════════════════════════════════════════════════════════════

from examples.dreams.widget_tools import WIDGETS as _BACKEND_DUMB_WIDGETS

ALL_SPAWN_TOOL_NAMES = [cfg.spawn_tool.name for cfg in _BACKEND_DUMB_WIDGETS]
SPAWN_TOOL_NAMES = ALL_SPAWN_TOOL_NAMES  # full backend surface now

FAKE_FRONTEND_ACTIONS: list = []  # new graph doesn't bind frontend actions


# ── Legacy arg schemas (kept for reference only — not used after graph
#    changes; backend-registered widget tools define their own schemas). ──

class _TextArgs(BaseModel):
    model_config = ConfigDict(extra="allow")
    message: str = Field(description="The prose message to display")
    source_chunk_ids: list[int] = Field(default_factory=list)
    operation: str = Field(default="replace_all")


# ── Concrete arg schemas mirroring widget.config.ts ───────────────────────
# A loose `extra=allow` schema with only `operation` as a concrete field
# caused Qwen3.6 to enter a degenerate loop emitting `"operation":"replace_all"`
# 11,388 chars long. Real schemas with several required string fields give
# the grammar-constrained decoder something to work with.

class _CurrentDreamArgs(BaseModel):
    title: str = Field(description="Short dream title, e.g. 'Water under the old house'")
    quote: str = Field(description="The dream narrative text as recalled by the user")
    meaning: str = Field(description="Symbolic/psychological meaning synthesized from dream_knowledge chunks")
    subconscious_emotion: str = Field(description="1-2 sentences on the emotional theme")
    life_echo: str = Field(description="1-2 sentences on how this pattern shows up in community_dreams")
    source_chunk_ids: list[int] = Field(default_factory=list, description="IDs of retrieved chunks")
    operation: str = Field(default="replace_all")


class _DreamAtmosphereArgs(BaseModel):
    center_symbol: str = Field(description="The dominant symbol at the center of the atmosphere")
    satellites: list[str] = Field(default_factory=list, description="Co-occurring symbols (3-6)")
    source_chunk_ids: list[int] = Field(default_factory=list)
    operation: str = Field(default="add")


class _TextbookCardArgs(BaseModel):
    excerpt: str = Field(description="Direct quote or close paraphrase from a dream_knowledge chunk")
    source_chunk_ids: list[int] = Field(default_factory=list)
    operation: str = Field(default="add")


class _CommunityMirrorSnippet(BaseModel):
    text: str = Field(description="A short snippet from a community_dreams chunk")
    similarity: float = Field(default=0.0)


class _CommunityMirrorArgs(BaseModel):
    snippets: list[_CommunityMirrorSnippet] = Field(default_factory=list)
    source_chunk_ids: list[int] = Field(default_factory=list)
    operation: str = Field(default="add")


_SPAWN_SCHEMAS: dict[str, type[BaseModel]] = {
    "show_current_dream": _CurrentDreamArgs,
    "show_dream_atmosphere": _DreamAtmosphereArgs,
    "show_textbook_card": _TextbookCardArgs,
    "show_community_mirror": _CommunityMirrorArgs,
}

_SPAWN_DESCRIPTIONS: dict[str, str] = {
    "show_current_dream": (
        "Show the dream reading — a clear interpretation grounded in retrieved knowledge. "
        "Synthesize content FROM retrieved chunks. meaning is the main interpretation paragraph. "
        "subconscious_emotion and life_echo are each 1-2 sentences max."
    ),
    "show_dream_atmosphere": (
        "Show the dream atmosphere — a central symbol with satellite co-occurring symbols "
        "extracted from retrieved chunks and the symbol graph."
    ),
    "show_textbook_card": (
        "Show a textbook-style card with a direct quote or paraphrase from a dream_knowledge chunk."
    ),
    "show_community_mirror": (
        "Show a community mirror listing short snippets from community_dreams results "
        "with their similarity scores."
    ),
}


def _make_fake_spawn(name: str) -> StructuredTool:
    widget_id = name.replace("show_", "")
    schema = _SPAWN_SCHEMAS.get(name)
    if schema is None:
        raise KeyError(f"no schema defined for {name}")

    def handler(**kwargs: Any) -> dict:
        op = kwargs.pop("operation", "add")
        return {
            "spawned": True,
            "widgetId": widget_id,
            "operation": op,
            "props": kwargs,
        }

    return StructuredTool(
        name=name,
        description=_SPAWN_DESCRIPTIONS.get(name, f"Spawn the {widget_id} widget."),
        func=handler,
        args_schema=schema,
    )


def _make_fake_text_response() -> StructuredTool:
    def handler(**kwargs: Any) -> dict:
        op = kwargs.pop("operation", "replace_all")
        return {
            "spawned": True,
            "widgetId": "text_response",
            "operation": op,
            "props": kwargs,
        }

    return StructuredTool(
        name="show_text_response",
        description=(
            "Display a short prose reply (1-4 sentences) in a text-response widget. "
            "Use this for conversational follow-ups when structural widgets don't fit."
        ),
        func=handler,
        args_schema=_TextArgs,
    )


# ══════════════════════════════════════════════════════════════════════════
# Sidecar instrumentation — wrap `_invoke_with_repair_and_retry` so every
# LLM call is logged (label, input messages, output tool_calls, latency).
# ══════════════════════════════════════════════════════════════════════════

def _summarise_msg(m: Any) -> dict:
    role = type(m).__name__
    content = getattr(m, "content", "")
    if isinstance(content, list):
        content = " ".join(str(x) for x in content)
    out: dict = {"role": role, "content_preview": (content or "")[:240]}
    tcs = getattr(m, "tool_calls", None)
    if tcs:
        out["tool_calls"] = [{"name": tc.get("name"), "args": tc.get("args")} for tc in tcs]
    tci = getattr(m, "tool_call_id", None)
    if tci:
        out["tool_call_id"] = tci
        out["name"] = getattr(m, "name", None)
    return out


def _install_sidecar() -> tuple[list[dict], Any]:
    """Monkey-patch agent.graph._invoke_with_repair_and_retry, tools_node, and
    the backend tools (search_dreams, record_dream, …) so every step is timed.

    Also replaces the module-level `llm` with one that disables Qwen3 "thinking"
    mode (`enable_thinking=False`) and caps `max_tokens` / `timeout`. The
    shipped `get_llm()` only sets `enable_thinking` on the nebius provider
    branch — against the local llama.cpp server on the openai provider branch
    it's missing, and the model generates thousands of <think> tokens per turn.
    That behaviour is intentionally logged as a finding; this patch is isolated
    to the test run.

    Returns (events_list, restore_fn). `events_list` contains one entry per
    LLM invocation. Per-tool and per-tools_node times also go to the JSONL
    file + the shared log.
    """
    import agent.graph as g
    from examples.dreams import tools as dream_tools
    from langchain_openai import ChatOpenAI

    originals: dict[str, Any] = {}
    events: list[dict] = []

    # 0. Replace the module-level LLM with a bounded-output version.
    originals["llm"] = g.llm
    # Cap max_tokens — without it, observed spawner generations of 13k+ tokens
    # stuck in a grammar-constrained JSON runaway loop. 3072 is enough for 1-2
    # well-formed spawn tool calls; truncation past that is treated as model
    # failure rather than waiting indefinitely.
    # With the April 2026 graph changes, dumb widgets are backend-registered
    # and each returns Command(goto="spawner") on success, so the spawner is
    # re-invoked until the model stops emitting tool calls. Forcing
    # tool_choice="required" here would create an infinite spawn loop — the
    # model would be compelled to emit a widget tool call every turn forever.
    # Let the model decide when to stop naturally.
    patched_llm = ChatOpenAI(
        model=os.getenv("OPENAI_MODEL", "qwen3.6-35b-a3b"),
        base_url=os.getenv("OPENAI_BASE_URL"),
        api_key=os.getenv("OPENAI_API_KEY", "not-needed"),
        temperature=0.5,
        max_tokens=6144,
        timeout=240.0,
        model_kwargs={"parallel_tool_calls": False},
        extra_body={"enable_thinking": False, "chat_template_kwargs": {"enable_thinking": False}},
    )
    g.llm = patched_llm
    log.info(
        f"sidecar: patched g.llm — model={patched_llm.model_name} "
        f"max_tokens=6144 timeout=240s enable_thinking=False "
        f"parallel_tool_calls=False tool_choice=auto (spawner-loop-safe)"
    )

    # Prefix SPAWNER_PROMPT with /no_think to aggressively suppress any
    # remaining reasoning output. Keep retriever prompt untouched.
    originals["SPAWNER_PROMPT"] = g.SPAWNER_PROMPT
    g.SPAWNER_PROMPT = "/no_think\n\n" + g.SPAWNER_PROMPT
    originals["RETRIEVER_PROMPT"] = g.RETRIEVER_PROMPT
    g.RETRIEVER_PROMPT = "/no_think\n\n" + g.RETRIEVER_PROMPT

    # 0.5 Log raw invalid_tool_calls BEFORE repair tries to fix them and
    # BEFORE the retry wraps everything in an empty response.
    originals["_repair_response"] = g._repair_response

    def _logging_repair(response):
        itcs = getattr(response, "invalid_tool_calls", None) or []
        for i, itc in enumerate(itcs):
            raw = itc.get("args", "")
            if not isinstance(raw, str):
                raw = str(raw)
            log.warning(
                f"[RAW_INVALID] #{i} name={itc.get('name')} "
                f"args_len={len(raw)} err={str(itc.get('error') or '')[:200]}"
            )
            log.warning(f"  HEAD: {raw[:500]!r}")
            log.warning(f"  TAIL: {raw[-500:]!r}")
            _jsonl("raw_invalid_tool_call",
                   name=itc.get("name"),
                   args_len=len(raw),
                   args_head=raw[:2000],
                   args_tail=raw[-2000:],
                   error=str(itc.get("error") or "")[:400])
        return originals["_repair_response"](response)

    g._repair_response = _logging_repair

    # 1. LLM invocations ----------------------------------------------------
    originals["_invoke"] = g._invoke_with_repair_and_retry

    async def wrapped_invoke(llm_with_tools, messages, config, label: str):
        turn_idx = len(events) + 1
        log.info(f"▶ LLM[{label}] turn={turn_idx} in_msgs={len(messages)} — sending")
        t0 = time.perf_counter()
        try:
            resp = await originals["_invoke"](llm_with_tools, messages, config, label)
        except Exception as e:
            wall_ms = int((time.perf_counter() - t0) * 1000)
            # The shipped `_invoke_with_repair_and_retry` sends the broken
            # AIMessage back to the server on retry, and llama.cpp rejects it
            # with HTTP 500 because it can't parse the truncated tool_calls.
            # Degrade gracefully: return an empty AIMessage so the graph
            # routes to END instead of crashing the whole test.
            err_s = str(e)
            if "500" in err_s or "Failed to parse tool call" in err_s:
                log.warning(
                    f"■ LLM[{label}] turn={turn_idx} server-500 on retry after "
                    f"{wall_ms} ms (truncated tool call on prior turn); "
                    f"degrading to empty AIMessage"
                )
                from langchain_core.messages import AIMessage as _AI
                resp = _AI(content="")
                _jsonl(
                    "llm_call_degraded",
                    label=label, turn=turn_idx, wall_ms=wall_ms, error=err_s[:400],
                )
            else:
                log.error(f"■ LLM[{label}] turn={turn_idx} FAILED in {wall_ms} ms: {e}")
                _jsonl("llm_call_error", label=label, turn=turn_idx, wall_ms=wall_ms, error=str(e))
                raise
        wall_ms = int((time.perf_counter() - t0) * 1000)
        tcs = getattr(resp, "tool_calls", None) or []
        itcs = getattr(resp, "invalid_tool_calls", None) or []
        content = getattr(resp, "content", "")
        if not isinstance(content, str):
            content = str(content)
        # Dump invalid_tool_calls with full args so we can diagnose
        # truncated / malformed tool-call JSON.
        invalid_preview = []
        for itc in itcs:
            raw = itc.get("args", "")
            if isinstance(raw, str):
                invalid_preview.append({
                    "name": itc.get("name"),
                    "arg_len": len(raw),
                    "arg_head": raw[:400],
                    "arg_tail": raw[-400:],
                    "error": itc.get("error"),
                })
            else:
                invalid_preview.append({"name": itc.get("name"), "raw": str(raw)[:400]})
        ev = {
            "label": label,
            "turn": turn_idx,
            "wall_ms": wall_ms,
            "input_messages": [_summarise_msg(m) for m in messages],
            "input_message_roles": [type(m).__name__ for m in messages],
            "output_tool_calls": [{"name": tc.get("name"), "args": tc.get("args")} for tc in tcs],
            "output_invalid_tool_calls": invalid_preview,
            "output_content_preview": content[:240],
        }
        events.append(ev)
        _jsonl("llm_call", **ev)
        log.info(
            f"■ LLM[{label}] turn={turn_idx} wall_ms={wall_ms} "
            f"roles=[{','.join(ev['input_message_roles'])}] "
            f"out={[tc['name'] for tc in ev['output_tool_calls']]} "
            f"invalid={[(i.get('name'), i.get('arg_len')) for i in invalid_preview]}"
        )
        if invalid_preview:
            for i, ip in enumerate(invalid_preview):
                log.warning(
                    f"  invalid#{i} name={ip.get('name')} len={ip.get('arg_len')} "
                    f"err={(ip.get('error') or '')[:200]}"
                )
                log.warning(f"  head: {ip.get('arg_head', '')[:240]!r}")
                log.warning(f"  tail: {ip.get('arg_tail', '')[:240]!r}")
        return resp

    g._invoke_with_repair_and_retry = wrapped_invoke

    # 2. tools_node — time each execution + list the tool names -------------
    originals["tools_node"] = g.tools_node

    async def wrapped_tools_node(state):
        last = state["messages"][-1] if state.get("messages") else None
        names = [tc.get("name") for tc in getattr(last, "tool_calls", [])] if last else []
        in_active = [w.get("id") for w in (state.get("active_widgets") or [])]
        log.info(f"▶ tools_node — calls={names} in_active={in_active}")
        t0 = time.perf_counter()
        try:
            out = await originals["tools_node"](state)
        finally:
            ms = int((time.perf_counter() - t0) * 1000)

        # Inspect what tools_node produced: new ToolMessages and state updates.
        try:
            from langgraph.types import Command as _Cmd
            if isinstance(out, _Cmd):
                update = out.update or {}
                goto = out.goto
            else:
                update = out or {}
                goto = None
            new_msgs = update.get("messages") or []
            new_active = update.get("active_widgets")
            new_note = update.get("note")
            # Log each outgoing ToolMessage — gives us the record_dream rich
            # payload (emotion_tags, symbol_tags, character_tags, interaction,
            # lucidity, vividness, hvdc_codes) as it's emitted.
            for tm in new_msgs:
                if not hasattr(tm, "tool_call_id"):
                    continue
                tname = getattr(tm, "name", "?")
                raw = getattr(tm, "content", "")
                try:
                    parsed = json.loads(raw) if isinstance(raw, str) else raw
                except Exception:
                    parsed = raw
                if tname == "record_dream" and isinstance(parsed, dict):
                    log.info(
                        f"  [RECORD_DREAM] dream_id={parsed.get('dream_id')} "
                        f"emotions={parsed.get('emotion_tags')} "
                        f"symbols={parsed.get('symbol_tags')} "
                        f"characters={parsed.get('character_tags')} "
                        f"interaction={parsed.get('interaction_type')} "
                        f"lucidity={parsed.get('lucidity')} "
                        f"vividness={parsed.get('vividness')} "
                        f"hvdc={parsed.get('hvdc_codes')}"
                    )
                    _jsonl("record_dream_rich", **{k: parsed.get(k) for k in (
                        "dream_id", "emotion_tags", "symbol_tags",
                        "character_tags", "interaction_type", "lucidity",
                        "vividness", "hvdc_codes",
                    )})
                else:
                    preview = (raw[:160] if isinstance(raw, str) else str(raw)[:160])
                    log.info(f"  [TM] name={tname} content={preview}")
            if new_active is not None:
                log.info(
                    f"  [ACTIVE→] {[w.get('id') for w in new_active]} "
                    f"(was {in_active})"
                )
            if new_note is not None:
                log.info(f"  [NOTE→] {new_note!r}")
            if goto:
                log.info(f"  [GOTO] → {goto}")
        except Exception as e:
            log.warning(f"  tools_node post-inspect failed: {e}")

        log.info(f"■ tools_node — {ms} ms calls={names}")
        _jsonl("tools_node", wall_ms=ms, tool_names=names)
        return out

    g.tools_node = wrapped_tools_node

    # 3. Per-backend-tool timing via _backend_tool_map wrapping.
    #    StructuredTool is a pydantic model and rejects attribute assignment,
    #    so we swap its entry in g._backend_tool_map with a thin delegate that
    #    exposes the same duck-typed surface tools_node relies on
    #    (`.coroutine`, `.ainvoke(tc)`, `.name`, `.description`).
    class _TimedToolDelegate:
        def __init__(self, inner, name):
            self._inner = inner
            self._name = name
            self.coroutine = inner.coroutine  # truthy for async backend tools
            self.name = inner.name
            self.description = inner.description

        @property
        def func(self):
            return self._inner.func

        async def ainvoke(self, tc, *args, **kwargs):
            t0 = time.perf_counter()
            try:
                res = await self._inner.ainvoke(tc, *args, **kwargs)
            except Exception as e:
                ms = int((time.perf_counter() - t0) * 1000)
                log.error(f"■ tool[{self._name}] FAILED in {ms} ms: {e}")
                _jsonl("tool_call_error", name=self._name, wall_ms=ms, error=str(e))
                raise
            ms = int((time.perf_counter() - t0) * 1000)
            log.info(f"■ tool[{self._name}] {ms} ms")
            _jsonl("tool_call", name=self._name, wall_ms=ms)
            return res

    wrapped_tool_names = ["search_dreams", "record_dream", "get_symbol_graph", "get_user_profile"]
    originals["backend_map"] = dict(g._backend_tool_map)
    new_map = dict(g._backend_tool_map)
    for tname in wrapped_tool_names:
        t = g._backend_tool_map.get(tname)
        if t is None:
            continue
        new_map[tname] = _TimedToolDelegate(t, tname)
    g._backend_tool_map = new_map

    def restore() -> None:
        g.llm = originals["llm"]
        g.SPAWNER_PROMPT = originals.get("SPAWNER_PROMPT", g.SPAWNER_PROMPT)
        g.RETRIEVER_PROMPT = originals.get("RETRIEVER_PROMPT", g.RETRIEVER_PROMPT)
        g._repair_response = originals["_repair_response"]
        g._invoke_with_repair_and_retry = originals["_invoke"]
        g.tools_node = originals["tools_node"]
        g._backend_tool_map = originals["backend_map"]

    return events, restore


# ══════════════════════════════════════════════════════════════════════════
# Build a fresh graph matching the shipped topology, without checkpointer
# (MemorySaver can't serialise StructuredTools with closures). Mirrors
# create_graph() in agent/graph.py:915.
# ══════════════════════════════════════════════════════════════════════════

def _build_test_graph():
    import agent.graph as g
    from agent.state import OrchestratorState
    from langgraph.graph import END, START, StateGraph

    wf = StateGraph(OrchestratorState)
    wf.add_node("retriever", g.retriever_node)
    wf.add_node("spawner", g.spawner_node)
    wf.add_node("tools", g.tools_node)

    sids = list(g._registry.keys())
    for sid, cfg in g._registry.items():
        wf.add_node(sid, g.make_subagent_node(cfg))
        wf.add_conditional_edges(sid, g.route_subagent, {"tools": "tools", END: END})

    entry_targets = {"retriever": "retriever", **{s: s for s in sids}}
    wf.add_conditional_edges(START, g.route_entry, entry_targets)
    wf.add_conditional_edges("retriever", g.route_orchestrator, {"tools": "tools", END: END})
    wf.add_conditional_edges("spawner", g.route_orchestrator, {"tools": "tools", END: END})

    # tools_node now always returns Command(goto=...) — no conditional_edges
    # needed on "tools". See comment in graph.py:create_graph.
    return wf.compile().with_config({"recursion_limit": 60})


# ══════════════════════════════════════════════════════════════════════════
# Cleanup: remove test-marked rows from user_dreams on teardown.
# ══════════════════════════════════════════════════════════════════════════

def _cleanup_supabase() -> None:
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")
        if not (url and key):
            return
        client = create_client(url, key)
        res = client.table("user_dreams").delete().like("raw_text", f"{TEST_MARKER}%").execute()
        n = len(res.data) if getattr(res, "data", None) else 0
        log.info(f"cleanup: removed {n} test rows from user_dreams")
        _jsonl("cleanup", rows_deleted=n)
    except Exception as e:
        log.warning(f"cleanup failed: {e}")


# ══════════════════════════════════════════════════════════════════════════
# The single end-to-end test.
# ══════════════════════════════════════════════════════════════════════════

DREAM_NARRATIVE = (
    f"{TEST_MARKER} "
    "I was swimming in a dark ocean at night. The water felt warm but somehow "
    "frightening, and I kept seeing flashes of light beneath the surface. My "
    "grandmother was standing on a distant shore, waving — but when I tried to "
    "swim toward her, the current pulled me the other way. I woke up crying, "
    "feeling both sad and strangely comforted, like she had come to say goodbye."
)


@pytest.mark.cloud_e2e
@pytest.mark.slow
async def test_new_dream_pipeline() -> None:
    """Real dream narrative → retriever searches → dispatches → spawner renders."""
    log.info("═" * 72)
    log.info(f"RUN_TS={RUN_TS} RUN_UUID={RUN_UUID} marker={TEST_MARKER}")
    log.info(f"jsonl: {RUN_JSONL}")
    log.info("═" * 72)
    log.info(f"log file: {RUN_LOG}")
    log.info(f"jsonl   : {RUN_JSONL}")
    _jsonl(
        "run_start",
        run_uuid=RUN_UUID,
        marker=TEST_MARKER,
        llm_base=os.getenv("OPENAI_BASE_URL"),
        llm_model=os.getenv("OPENAI_MODEL"),
    )

    with _Timer("pre-flight"):
        _preflight()

    events, restore = _install_sidecar()
    try:
        with _Timer("graph build"):
            graph = _build_test_graph()

        log.info(f"user message: {DREAM_NARRATIVE[:120]}…")

        with _Timer("graph invoke") as gt:
            try:
                result = await graph.ainvoke(
                    {
                        "messages": [HumanMessage(content=DREAM_NARRATIVE)],
                        "copilotkit": {"actions": FAKE_FRONTEND_ACTIONS},
                    }
                )
            except Exception as e:
                # Recursion-limit and similar "graph ran out of steps" errors
                # are informative — we still want to see what widgets did get
                # spawned before termination. Re-raise the rest.
                if "recursion" in str(e).lower() or "GraphRecursionError" in type(e).__name__:
                    log.warning(f"graph hit recursion limit: {e!r}")
                    result = {}
                else:
                    raise
        total_ms = int((time.perf_counter() - gt.t0) * 1000)
        log.info(f"graph returned in {total_ms} ms across {len(events)} LLM turns")
        _jsonl("run_complete", total_ms=total_ms, turns=len(events))

        # ── log final state ─────────────────────────────────────────────
        knowledge = result.get("knowledge") or {}
        active = result.get("active_widgets") or []
        note = result.get("note")
        msgs = result.get("messages") or []

        log.info("─── final state ───")
        log.info(f"  knowledge namespaces: {list(knowledge.keys())}")
        for ns, chunks in knowledge.items():
            log.info(f"    [{ns}] {len(chunks)} chunks")
        log.info(f"  note: {note!r}")
        log.info(f"  active_widgets: {[w.get('id') for w in active]}")
        log.info(f"  total messages: {len(msgs)}")
        _jsonl(
            "final_state",
            knowledge_ns={ns: len(c) for ns, c in knowledge.items()},
            active_widget_ids=[w.get("id") for w in active],
            note=note,
            message_count=len(msgs),
        )

        # ── split events by node ────────────────────────────────────────
        retriever_turns = [e for e in events if e["label"] == "RETRIEVER"]
        spawner_turns = [e for e in events if e["label"] == "SPAWNER"]
        log.info(f"  retriever turns: {len(retriever_turns)}")
        log.info(f"  spawner turns: {len(spawner_turns)}")

        for i, e in enumerate(retriever_turns, 1):
            names = [tc["name"] for tc in e["output_tool_calls"]]
            log.info(f"    retriever#{i} ({e['wall_ms']}ms): {names}")
        for i, e in enumerate(spawner_turns, 1):
            names = [tc["name"] for tc in e["output_tool_calls"]]
            log.info(f"    spawner#{i} ({e['wall_ms']}ms): {names}")

        # ═══════════════════════════════════════════════════════════════
        # ASSERTIONS
        # ═══════════════════════════════════════════════════════════════

        # 1. Retriever ran at least once.
        assert retriever_turns, "retriever never ran"

        # 2. Retriever issued >=1 search_dreams call across its turns.
        retriever_tool_names = [
            tc["name"]
            for e in retriever_turns
            for tc in e["output_tool_calls"]
        ]
        assert any(
            n == "search_dreams" for n in retriever_tool_names
        ), f"retriever never called search_dreams; saw {retriever_tool_names}"

        # 3. Retriever eventually dispatched to spawner.
        assert "dispatch_to_spawner" in retriever_tool_names, (
            f"retriever never dispatched; saw {retriever_tool_names}"
        )

        # 4. Spawner ran.
        assert spawner_turns, (
            "spawner never ran — dispatch did not route correctly"
        )

        # 5. Context isolation: spawner's input contained ONLY
        #    SystemMessage + HumanMessage(s). No ToolMessage from retriever era.
        first_spawner = spawner_turns[0]
        roles = first_spawner["input_message_roles"]
        log.info(f"  spawner input roles: {roles}")
        assert roles[0] == "SystemMessage", f"spawner first msg not system: {roles}"
        assert all(r != "ToolMessage" for r in roles), (
            f"spawner input leaked ToolMessage — context isolation broken: {roles}"
        )
        assert all(r != "AIMessage" for r in roles), (
            f"spawner input leaked AIMessage from retriever era: {roles}"
        )

        # 6. Spawner emitted >=1 spawn tool call.
        spawner_tool_names = [
            tc["name"]
            for e in spawner_turns
            for tc in e["output_tool_calls"]
        ]
        assert spawner_tool_names, "spawner emitted no tool calls"
        spawn_hits = [n for n in spawner_tool_names if n in SPAWN_TOOL_NAMES]
        assert spawn_hits, (
            f"spawner called no spawn tools; saw {spawner_tool_names}"
        )

        # 7. Knowledge populated across retrieval namespaces.
        assert knowledge, "state.knowledge is empty after run"
        # Flow A expects at minimum dream_knowledge and community_dreams.
        expected_ns = {"dream_knowledge", "community_dreams"}
        hit_ns = expected_ns & set(knowledge.keys())
        assert hit_ns, (
            f"expected at least one of {expected_ns} in knowledge, got {list(knowledge.keys())}"
        )

        # 8. New graph (April 2026): dumb widgets are backend tools, so
        #    active_widgets must be populated in-place by tools_node. No
        #    1-turn delay, no client round-trip simulation needed.
        spawner_spawn_calls = [
            tc for e in spawner_turns
            for tc in e["output_tool_calls"]
            if tc["name"] in SPAWN_TOOL_NAMES
        ]
        log.info(
            f"  spawner spawn calls: "
            f"{[c['name'] for c in spawner_spawn_calls]}"
        )
        active_ids = [w.get("id") for w in active]
        log.info(f"  final active_widgets ids: {active_ids}")
        for w in active:
            props = w.get("props") or {}
            prop_keys = list(props.keys())
            log.info(
                f"    - id={w.get('id')} type={w.get('type')} "
                f"prop_keys={prop_keys}"
            )
        assert active, (
            "active_widgets is empty after run — tools_node did not populate "
            "dumb widget state. Expected backend-registered dumb widget tools "
            "to update active_widgets in-place."
        )

        log.info("─── all assertions passed ───")

    finally:
        restore()
        with _Timer("supabase cleanup"):
            _cleanup_supabase()
        log.info(f"done — run log: {RUN_LOG}")

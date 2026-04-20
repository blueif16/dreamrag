"""
DreamRAG backend tools — auto-discovered by examples/__init__.py via load_all_backend_tools().

Tools here are standalone backend tools (DB operations, retrieval).
Spawn tools live in examples/dreams/widgets/*/widget.config.ts (dumb) or SUBAGENTS (smart).
"""
import json
import os
import re
import logging
from typing import Annotated
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.messages import ToolMessage
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

logger = logging.getLogger(__name__)

# ── Simple keyword-based tag extraction (no model dependency) ─────────────

_EMOTION_WORDS = {
    "anxiety": ["anxiety", "anxious", "worried", "nervous", "panic", "fear", "dread", "uneasy"],
    "joy": ["joy", "happy", "happiness", "delight", "elated", "euphoria", "bliss", "cheerful"],
    "sadness": ["sad", "sadness", "grief", "sorrow", "crying", "tears", "melancholy", "depressed"],
    "anger": ["anger", "angry", "rage", "furious", "frustrated", "irritated", "hostile"],
    "fear": ["fear", "scared", "terrified", "frightened", "horror", "afraid", "phobia"],
    "confusion": ["confused", "confusion", "lost", "disoriented", "bewildered", "puzzled"],
    "peace": ["peace", "peaceful", "calm", "serene", "tranquil", "relaxed", "content"],
    "excitement": ["excited", "excitement", "thrill", "exhilarated", "adrenaline"],
    "love": ["love", "loving", "affection", "tender", "embrace", "romantic", "intimacy"],
    "loneliness": ["lonely", "loneliness", "alone", "isolated", "abandoned", "solitude"],
    "guilt": ["guilt", "guilty", "shame", "ashamed", "regret", "remorse"],
    "wonder": ["wonder", "awe", "amazed", "astonished", "magical", "miraculous"],
}

_SYMBOL_WORDS = [
    "water", "ocean", "sea", "river", "lake", "rain", "flood", "wave",
    "fire", "flame", "burning", "smoke",
    "flying", "flight", "falling", "floating",
    "house", "room", "door", "window", "stairs", "hallway", "building",
    "car", "driving", "road", "path", "bridge",
    "teeth", "tooth", "hair", "hands", "eyes", "body",
    "snake", "spider", "dog", "cat", "bird", "fish", "animal",
    "tree", "forest", "mountain", "garden", "flower",
    "death", "dying", "dead", "funeral", "grave",
    "baby", "child", "mother", "father", "family",
    "school", "exam", "test", "classroom",
    "chase", "chasing", "running", "escape", "hiding",
    "mirror", "shadow", "darkness", "light", "sun", "moon", "stars",
    "phone", "key", "clock", "money", "book",
    "naked", "clothes", "wedding", "ring",
]


def _extract_tags(text: str) -> tuple[list[str], list[str]]:
    """Regex fallback — only used when the LLM tagger fails.
    Returns (emotion_tags, symbol_tags); everything else is empty."""
    lower = text.lower()
    words = set(re.findall(r"[a-z]+", lower))

    emotions = []
    for label, keywords in _EMOTION_WORDS.items():
        if any(kw in words for kw in keywords):
            emotions.append(label)

    symbols = [s for s in _SYMBOL_WORDS if s in words]
    symbols = list(dict.fromkeys(symbols))

    return emotions[:5], symbols[:8]


# ── LLM tagger — runs once per recorded dream ────────────────────────────

_TAGGER_PROMPT = """You are a dream-coding assistant. Given a dream narrative (and optional reference chunks from the dream corpus and textbook), extract structured codes.

Return STRICT JSON — no prose, no code fences, no trailing commas. Exactly this shape:
{{
  "emotion_tags":     [2-5 lowercased emotion words, e.g. "sadness","longing"],
  "symbol_tags":      [3-8 concrete dream symbols, lowercased singular nouns: "ocean","grandmother"→ NO (that's a character), "tooth", etc.],
  "character_tags":   [0-5 dream characters: "mother","stranger","child_self","friend","unseen_other"],
  "interaction_type": ONE short phrase — "solitary search" | "pursuit" | "aftermath" | "farewell" | "confrontation" | "observing" | "playful" | "transformation",
  "lucidity_score":   float in [0,1] — 0 = no awareness of dreaming, 1 = fully lucid & controlling,
  "vividness_score":  float in [0,1] — 0 = vague verbal summary, 1 = sharp sensory detail,
  "hvdc_codes":       Hall/Van de Castle counts as integers — {{"aggression":N,"friendliness":N,"sexuality":N,"misfortune":N,"good_fortune":N,"success":N,"failure":N}}
}}

Base every number on THIS dream alone. The reference chunks only help you recognise familiar symbols — do NOT borrow their counts.

Dream:
\"\"\"{dream_text}\"\"\"

Reference chunks (may be empty):
{context}
"""


def _build_context_blob(knowledge: dict | None) -> str:
    """Flatten state.knowledge into a short plaintext blob for the tagger."""
    if not knowledge:
        return "(none)"
    lines: list[str] = []
    for ns, chunks in knowledge.items():
        for c in (chunks or [])[:3]:
            if not isinstance(c, dict):
                continue
            content = c.get("content") or c.get("text") or ""
            if content:
                lines.append(f"[{ns}] {content[:220]}")
    return "\n".join(lines) or "(none)"


def _clean_tags(raw: dict, dream_text: str) -> dict:
    """Coerce LLM output into the DB column shapes. Clamps ranges, fills blanks."""
    def _str_list(v, cap):
        if not isinstance(v, list):
            return []
        return [str(x).strip().lower() for x in v if str(x).strip()][:cap]

    def _clamp01(x, fallback):
        try:
            return max(0.0, min(1.0, float(x)))
        except Exception:
            return fallback

    hvdc_raw = raw.get("hvdc_codes") if isinstance(raw.get("hvdc_codes"), dict) else {}
    hvdc_keys = ["aggression", "friendliness", "sexuality", "misfortune", "good_fortune", "success", "failure"]
    hvdc: dict[str, int] = {}
    for k in hvdc_keys:
        try:
            hvdc[k] = max(0, int(hvdc_raw.get(k, 0)))
        except Exception:
            hvdc[k] = 0

    # Fallback emotions/symbols if LLM returned none
    emo = _str_list(raw.get("emotion_tags"), 5)
    sym = _str_list(raw.get("symbol_tags"), 8)
    if not emo or not sym:
        fb_emo, fb_sym = _extract_tags(dream_text)
        emo = emo or fb_emo
        sym = sym or fb_sym

    return {
        "emotion_tags":     emo,
        "symbol_tags":      sym,
        "character_tags":   _str_list(raw.get("character_tags"), 5),
        "interaction_type": str(raw.get("interaction_type") or "").strip()[:40] or None,
        "lucidity_score":   _clamp01(raw.get("lucidity_score"), 0.3),
        "vividness_score":  _clamp01(raw.get("vividness_score"), 0.6),
        "hvdc_codes":       hvdc,
    }


async def _llm_tag_dream(dream_text: str, knowledge: dict | None) -> dict:
    """Call the orchestrator's LLM once to extract all structured dream fields."""
    # Lazy import avoids circular: graph.py → examples/__init__.py → tools.py
    from agent.graph import get_llm
    llm = get_llm()
    prompt = _TAGGER_PROMPT.format(dream_text=dream_text, context=_build_context_blob(knowledge))
    resp = await llm.ainvoke([{"role": "user", "content": prompt}])
    raw = resp.content if hasattr(resp, "content") else str(resp)
    # Strip thinking tags + extract first JSON object
    raw = re.sub(r"<think>[\s\S]*?</think>", "", raw, flags=re.IGNORECASE)
    m = re.search(r"\{[\s\S]*\}", raw)
    data = json.loads(m.group(0)) if m else {}
    return _clean_tags(data, dream_text)


@tool
async def record_dream(
    dream_text: str,
    state: Annotated[dict, InjectedState],
    user_id: str = "demo_dreamer",
) -> dict:
    """Record a new dream entry into the user's personal dream database.

    ORDER MATTERS — call this LAST in the NEW DREAM flow, AFTER search_dreams
    has populated state.knowledge. This tool reads state.knowledge and passes
    the retrieved chunks into an LLM tagger that produces the full structured
    row (emotions, symbols, characters, interaction_type, lucidity_score,
    vividness_score, hvdc_codes). If you call it first, the tagger has no
    context and most columns stay empty.

    Args:
        dream_text: The raw dream narrative the user submitted.
        user_id:    Session or user identifier (default: "demo_dreamer").
    """
    try:
        from app.core.qwen_embeddings import QwenEmbeddings
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")

        if not supabase_url or not supabase_key:
            logger.warning("[record_dream] Supabase env vars not set — skipping DB write")
            return {"status": "skipped", "reason": "supabase_not_configured", "dream_text": dream_text[:100]}

        client = create_client(supabase_url, supabase_key)
        embeddings = QwenEmbeddings()

        # Embed the dream text
        embedding = embeddings.embed_documents([dream_text])[0]

        # LLM tagger — reads retrieved chunks from state.knowledge so the tagger
        # has corpus/textbook context. Falls back to regex keyword matching if
        # the model call fails so the row still gets recorded with minimal tags.
        knowledge = (state or {}).get("knowledge", {}) if isinstance(state, dict) else {}
        try:
            tags = await _llm_tag_dream(dream_text, knowledge)
        except Exception as e:
            logger.warning(f"[record_dream] LLM tagger failed ({e}) — falling back to regex")
            fb_emo, fb_sym = _extract_tags(dream_text)
            tags = {
                "emotion_tags": fb_emo,
                "symbol_tags": fb_sym,
                "character_tags": [],
                "interaction_type": None,
                "lucidity_score": 0.3,
                "vividness_score": 0.6,
                "hvdc_codes": {},
            }

        row = {
            "user_id": user_id,
            "raw_text": dream_text,
            "embedding": embedding,
            "emotion_tags":     tags["emotion_tags"],
            "symbol_tags":      tags["symbol_tags"],
            "character_tags":   tags["character_tags"],
            "interaction_type": tags["interaction_type"],
            "lucidity_score":   tags["lucidity_score"],
            "vividness_score":  tags["vividness_score"],
            "hvdc_codes":       tags["hvdc_codes"],
        }

        result = client.table("user_dreams").insert(row).execute()
        dream_id = result.data[0]["id"] if result.data else None
        logger.info(
            f"[record_dream] saved dream_id={dream_id} user={user_id} "
            f"emo={tags['emotion_tags']} sym={tags['symbol_tags']} "
            f"chars={tags['character_tags']} inter={tags['interaction_type']} "
            f"lucid={tags['lucidity_score']} vivid={tags['vividness_score']}"
        )

        # Recompute cached profile
        from app.core.user_profile import recompute_profile
        try:
            recompute_profile(user_id)
        except Exception as e:
            logger.error(f"[record_dream] recompute_profile failed: {e}")

        return {
            "status": "recorded",
            "dream_id": dream_id,
            "user_id": user_id,
            "preview": dream_text[:120],
            **tags,
        }

    except Exception as e:
        logger.error(f"[record_dream] error: {e}")
        return {"status": "error", "error": str(e)}


@tool
async def search_dreams(
    query: str,
    tool_call_id: Annotated[str, InjectedToolCallId],
    namespace: str = "community_dreams",
    top_k: int = 5,
) -> Command:
    """Search the dream knowledge base using hybrid RRF + graph retrieval.
    Use this to retrieve relevant community dreams, textbook interpretations,
    or the user's own past dreams before synthesising widget content.

    Results are stored in state.knowledge[namespace] — they are NOT appended to
    the conversation messages. You receive only a terse ack. The spawner node
    reads state.knowledge directly.

    Args:
        query:     Natural language search query.
        namespace: One of: community_dreams, dream_knowledge, user_{uid}_dreams.
        top_k:     Number of results to return (default 5).
    """
    try:
        from app.core.rag_store import RAGStore

        rag = RAGStore(namespace=namespace)
        results = rag.search(query, top_k=top_k)
        logger.info(f"[search_dreams] namespace={namespace} query={query[:60]} → {len(results)} results")

        if not results:
            ack = {
                "namespace": namespace,
                "count": 0,
                "note": f"No matches in '{namespace}' for this query. Do NOT retry the same query — try a different namespace or dispatch to spawner.",
            }
            return Command(update={
                "messages": [ToolMessage(content=json.dumps(ack), tool_call_id=tool_call_id, name="search_dreams")],
            })

        ack = {"namespace": namespace, "count": len(results), "stored": True}
        return Command(update={
            "knowledge": {namespace: results},
            "messages": [ToolMessage(content=json.dumps(ack), tool_call_id=tool_call_id, name="search_dreams")],
        })

    except Exception as e:
        logger.error(f"[search_dreams] error: {e}")
        return Command(update={
            "messages": [ToolMessage(
                content=json.dumps({"error": str(e), "namespace": namespace, "count": 0}),
                tool_call_id=tool_call_id,
                name="search_dreams",
            )],
        })


# Exported tool list — picked up by examples/__init__.py:load_all_backend_tools()


@tool
async def get_symbol_graph(symbol: str, user_id: str = "demo_dreamer", top_k: int = 6) -> dict:
    """Get symbols that co-occur with a given symbol from the dream corpus and user's graph.
    Use this to populate DreamAtmosphere satellite symbols with real co-occurrence data.
    Falls back gracefully to empty if no graph edges exist yet.

    Args:
        symbol:  The central symbol to find co-occurrences for, e.g. "water".
        user_id: User identifier for personal dream graph (default: "demo_dreamer").
        top_k:   Number of co-occurring symbols to return (default 6).
    """
    try:
        from supabase import create_client
        import os

        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")
        if not supabase_url or not supabase_key:
            return {"satellites": [], "source": "no_db"}

        client = create_client(supabase_url, supabase_key)

        # Find documents whose content mentions this symbol
        symbol_docs = (
            client.table("documents")
            .select("id")
            .ilike("content", f"%{symbol}%")
            .limit(20)
            .execute()
        )
        if not symbol_docs.data:
            return {"satellites": [], "source": "no_docs_for_symbol"}

        source_ids = [d["id"] for d in symbol_docs.data]

        # Find co_occurs edges from these docs
        edges = (
            client.table("doc_relations")
            .select("target_id, properties")
            .in_("source_id", source_ids)
            .eq("type", "co_occurs")
            .order("properties->weight", desc=True)
            .limit(top_k * 3)
            .execute()
        )
        if not edges.data:
            return {"satellites": [], "source": "no_edges_yet"}

        # Get target document content to extract symbol names
        target_ids = list({e["target_id"] for e in edges.data})[:top_k * 2]
        targets = (
            client.table("documents")
            .select("id, content")
            .in_("id", target_ids)
            .execute()
        )
        # Extract first word/phrase as symbol label (content is usually short for symbol nodes)
        satellites = []
        seen = set()
        for t in (targets.data or []):
            label = t["content"].split()[0].capitalize() if t["content"] else "Symbol"
            if label.lower() != symbol.lower() and label not in seen:
                satellites.append(label)
                seen.add(label)
            if len(satellites) >= top_k:
                break

        logger.info(f"[get_symbol_graph] symbol={symbol} → {len(satellites)} satellites")
        return {"symbol": symbol, "satellites": satellites, "source": "doc_relations"}

    except Exception as e:
        logger.error(f"[get_symbol_graph] error: {e}")
        return {"satellites": [], "error": str(e)}


@tool
async def get_user_profile(user_id: str = "demo_dreamer") -> dict:
    """Fetch the user's aggregated dream profile (streak, heatmap, emotions, recurrence).
    Use this to populate history-dependent cards like dream_streak and heatmap_calendar.

    Args:
        user_id: Session or user identifier (default: "demo_dreamer").
    """
    try:
        from supabase import create_client

        supabase_url = os.getenv("SUPABASE_URL", "")
        supabase_key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")
        if not supabase_url or not supabase_key:
            return {"status": "error", "reason": "supabase_not_configured"}

        client = create_client(supabase_url, supabase_key)
        result = client.table("user_profiles").select("*").eq("user_id", user_id).execute()

        if result.data:
            return result.data[0]

        # No profile yet — return empty defaults
        return {
            "user_id": user_id,
            "emotion_distribution": [],
            "recurrence": [],
            "current_streak": 0,
            "last7": [False] * 7,
            "heatmap_data": [],
            "heatmap_month": "",
            "total_dreams": 0,
        }

    except Exception as e:
        logger.error(f"[get_user_profile] error: {e}")
        return {"status": "error", "error": str(e)}


# Updated tool list
all_tools = [record_dream, search_dreams, get_symbol_graph, get_user_profile]

"""
DreamRAG backend tools — auto-discovered by examples/__init__.py via load_all_backend_tools().

Tools here are standalone backend tools (DB operations, retrieval).
Spawn tools live in examples/dreams/widgets/*/widget.config.ts (dumb) or SUBAGENTS (smart).
"""
import os
import re
import logging
from langchain_core.tools import tool

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
    """Extract emotion and symbol tags from dream text using keyword matching."""
    lower = text.lower()
    words = set(re.findall(r"[a-z]+", lower))

    emotions = []
    for label, keywords in _EMOTION_WORDS.items():
        if any(kw in words for kw in keywords):
            emotions.append(label)

    symbols = [s for s in _SYMBOL_WORDS if s in words]
    # Deduplicate while preserving order
    symbols = list(dict.fromkeys(symbols))

    return emotions[:5], symbols[:8]


@tool
async def record_dream(dream_text: str, user_id: str = "default") -> dict:
    """Record a new dream entry into the user's personal dream database.
    Call this whenever the user submits a new dream for analysis.
    Returns the new dream's ID, and any auto-extracted tags.

    Args:
        dream_text: The raw dream narrative the user submitted.
        user_id:    Session or user identifier (default: "default").
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

        # Extract tags via keyword matching
        emotion_tags, symbol_tags = _extract_tags(dream_text)

        # Insert into user_dreams
        result = client.table("user_dreams").insert({
            "user_id": user_id,
            "raw_text": dream_text,
            "embedding": embedding,
            "emotion_tags": emotion_tags,
            "symbol_tags": symbol_tags,
        }).execute()

        dream_id = result.data[0]["id"] if result.data else None
        logger.info(f"[record_dream] saved dream_id={dream_id} user={user_id} emotions={emotion_tags} symbols={symbol_tags}")

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
            "emotion_tags": emotion_tags,
            "symbol_tags": symbol_tags,
        }

    except Exception as e:
        logger.error(f"[record_dream] error: {e}")
        return {"status": "error", "error": str(e)}


@tool
async def search_dreams(query: str, namespace: str = "community_dreams", top_k: int = 5) -> dict:
    """Search the dream knowledge base using hybrid RRF + graph retrieval.
    Use this to retrieve relevant community dreams, textbook interpretations,
    or the user's own past dreams before synthesising widget content.

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
            return {
                "results": [],
                "namespace": namespace,
                "count": 0,
                "stop": True,
                "note": f"No matches in '{namespace}' for this query. Do NOT retry search_dreams — proceed without RAG context and answer from general knowledge.",
            }
        return {"results": results, "namespace": namespace, "count": len(results)}

    except Exception as e:
        logger.error(f"[search_dreams] error: {e}")
        return {"results": [], "error": str(e), "stop": True}


# Exported tool list — picked up by examples/__init__.py:load_all_backend_tools()


@tool
async def get_symbol_graph(symbol: str, user_id: str = "default", top_k: int = 6) -> dict:
    """Get symbols that co-occur with a given symbol from the dream corpus and user's graph.
    Use this to populate DreamAtmosphere satellite symbols with real co-occurrence data.
    Falls back gracefully to empty if no graph edges exist yet.

    Args:
        symbol:  The central symbol to find co-occurrences for, e.g. "water".
        user_id: User identifier for personal dream graph (default: "default").
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
async def get_user_profile(user_id: str = "default") -> dict:
    """Fetch the user's aggregated dream profile (streak, heatmap, emotions, recurrence).
    Use this to populate history-dependent cards like dream_streak and heatmap_calendar.

    Args:
        user_id: Session or user identifier (default: "default").
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

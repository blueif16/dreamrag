"""
DreamRAG backend tools — auto-discovered by examples/__init__.py via load_all_backend_tools().

Tools here are standalone backend tools (DB operations, retrieval).
Spawn tools live in examples/dreams/widgets/*/widget.config.ts (dumb) or SUBAGENTS (smart).
"""
import os
import logging
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


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

        # Insert into user_dreams
        result = client.table("user_dreams").insert({
            "user_id": user_id,
            "raw_text": dream_text,
            "embedding": embedding,
        }).execute()

        dream_id = result.data[0]["id"] if result.data else None
        logger.info(f"[record_dream] saved dream_id={dream_id} user={user_id}")

        return {
            "status": "recorded",
            "dream_id": dream_id,
            "user_id": user_id,
            "preview": dream_text[:120],
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
        return {"results": results, "namespace": namespace, "count": len(results)}

    except Exception as e:
        logger.error(f"[search_dreams] error: {e}")
        return {"results": [], "error": str(e)}


# Exported tool list — picked up by examples/__init__.py:load_all_backend_tools()
all_tools = [record_dream, search_dreams]

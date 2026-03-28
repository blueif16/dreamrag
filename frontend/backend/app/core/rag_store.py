"""
RAGStore — Supabase GraphRAG with local Qwen3-Embedding via llama.cpp.

Usage:
    rag = RAGStore(namespace="community_dreams")
    rag.ingest("Last night I dreamed I was flying over dark water...")
    results = rag.search("flying over water, peaceful feeling")

Namespaces used in DreamRAG:
    community_dreams  — DreamBank, SDDb, Reddit corpus
    dream_knowledge   — Jung, Freud, Domhoff, HVdC textbook chunks
    user_{uid}_dreams — Personal dream entries
"""
from __future__ import annotations
import os
import hashlib
from dataclasses import dataclass, field

from dotenv import load_dotenv, find_dotenv
from supabase import create_client, Client
from app.core.qwen_embeddings import QwenEmbeddings

load_dotenv(find_dotenv(usecwd=True))


@dataclass
class RAGConfig:
    supabase_url: str = field(default_factory=lambda: os.getenv("SUPABASE_URL", ""))
    supabase_key: str = field(default_factory=lambda: (
        os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")
    ))
    embedding_dim: int = int(os.getenv("EMBED_DIM", "1024"))

    # Search defaults
    match_count: int = 5
    rrf_k: int = 60
    graph_depth: int = 2


class RAGStore:
    """
    Minimal, powerful RAG store backed by Supabase pgvector + BM25 + graph.

    - Rich content (self-describing text gets embedded + FTS indexed)
    - Minimal metadata (source, type — just for reference)
    - SOTA search: RRF (BM25 + Vector) + recursive graph traversal
    """

    def __init__(
        self,
        namespace: str = "default",
        supabase_url: str | None = None,
        supabase_key: str | None = None,
        **kwargs,
    ):
        self.namespace = namespace
        self.config = RAGConfig(
            supabase_url=supabase_url or os.getenv("SUPABASE_URL", ""),
            supabase_key=supabase_key or os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", ""),
            **{k: v for k, v in kwargs.items() if hasattr(RAGConfig, k)},
        )
        self.client: Client = create_client(self.config.supabase_url, self.config.supabase_key)
        self._embeddings = QwenEmbeddings(output_dimensionality=self.config.embedding_dim)

    # =========================================================================
    # INGEST
    # =========================================================================

    def _hash(self, content: str) -> str:
        return hashlib.sha256(content.encode()).hexdigest()[:32]

    def ingest(
        self,
        content: str,
        source: str | None = None,
        type: str | None = None,
        skip_duplicates: bool = True,
    ) -> dict:
        """
        Ingest a piece of knowledge.

        Args:
            content: Rich, self-describing text
            source:  Where it came from (e.g. "dreambank", "jung_symbols")
            type:    Category (e.g. "dream_narrative", "academic_chunk")
        """
        content = content.strip()
        content_hash = self._hash(content)

        if skip_duplicates:
            existing = (
                self.client.table("documents")
                .select("id")
                .eq("content_hash", content_hash)
                .eq("namespace", self.namespace)
                .execute()
            )
            if existing.data:
                return {"id": existing.data[0]["id"], "status": "skipped"}

        embedding = self._embeddings.embed_documents([content])[0]

        metadata: dict = {}
        if source:
            metadata["source"] = source
        if type:
            metadata["type"] = type

        result = (
            self.client.table("documents")
            .insert({
                "content": content,
                "content_hash": content_hash,
                "embedding": embedding,
                "metadata": metadata,
                "namespace": self.namespace,
            })
            .execute()
        )
        return {"id": result.data[0]["id"], "status": "created"}

    def ingest_batch(
        self,
        items: list[str | dict],
        source: str | None = None,
        type: str | None = None,
        batch_size: int = 50,
    ) -> dict:
        """
        Batch ingest. Items can be strings or dicts with any metadata keys.
        - New rows: embed + insert with full metadata.
        - Existing rows: patch any metadata keys that are missing (no re-embed).
        """
        created, skipped, patched, ids = 0, 0, 0, []

        for i in range(0, len(items), batch_size):
            batch = items[i : i + batch_size]

            normalized = []
            for item in batch:
                if isinstance(item, str):
                    normalized.append({"content": item.strip(), "source": source, "type": type})
                else:
                    d = {k: v for k, v in item.items()}
                    d["content"] = d.get("content", "").strip()
                    d.setdefault("source", source)
                    d.setdefault("type", type)
                    normalized.append(d)

            hashes = [self._hash(n["content"]) for n in normalized]

            # Fetch existing rows + their current metadata so we can patch gaps
            existing_rows = (
                self.client.table("documents")
                .select("content_hash, metadata")
                .in_("content_hash", hashes)
                .eq("namespace", self.namespace)
                .execute()
            )
            existing_map: dict[str, dict] = {
                r["content_hash"]: (r.get("metadata") or {})
                for r in existing_rows.data
            }

            new_items, new_hashes = [], []
            for n, h in zip(normalized, hashes):
                if not n["content"]:
                    continue
                if h in existing_map:
                    # Patch any metadata keys missing from the stored row
                    extra = {
                        k: v for k, v in n.items()
                        if k != "content" and v is not None and k not in existing_map[h]
                    }
                    if extra:
                        self.client.table("documents").update(
                            {"metadata": {**existing_map[h], **extra}}
                        ).eq("content_hash", h).eq("namespace", self.namespace).execute()
                        patched += 1
                    else:
                        skipped += 1
                else:
                    new_items.append(n)
                    new_hashes.append(h)

            if not new_items:
                continue

            embeddings = self._embeddings.embed_documents([n["content"] for n in new_items])

            records = []
            for n, emb, h in zip(new_items, embeddings, new_hashes):
                metadata = {k: v for k, v in n.items() if k != "content" and v is not None}
                records.append({
                    "content": n["content"],
                    "content_hash": h,
                    "embedding": emb,
                    "metadata": metadata,
                    "namespace": self.namespace,
                })

            result = self.client.table("documents").insert(records).execute()
            created += len(result.data)
            ids.extend([r["id"] for r in result.data])

        return {"created": created, "skipped": skipped, "patched": patched, "ids": ids}

    # =========================================================================
    # SEARCH
    # =========================================================================

    def search(
        self,
        query: str,
        top_k: int | None = None,
        graph_depth: int | None = None,
    ) -> list[dict]:
        """
        Hybrid RRF (BM25 + Vector) + recursive graph traversal.
        Falls back to vector-only if the SQL function is unavailable.
        """
        k = top_k or self.config.match_count
        depth = graph_depth or self.config.graph_depth
        embedding = self._embeddings.embed_query(query)

        try:
            result = self.client.rpc(
                "search_context_mesh",
                {
                    "query_text": query,
                    "query_embedding": embedding,
                    "match_count": k,
                    "rrf_k": self.config.rrf_k,
                    "graph_depth": depth,
                    "filter_namespace": self.namespace,
                },
            ).execute()
            return result.data
        except Exception:
            return self.search_vector(query, top_k=k)

    def search_vector(self, query: str, top_k: int | None = None) -> list[dict]:
        """Fast vector-only search (skip graph traversal)."""
        k = top_k or self.config.match_count
        embedding = self._embeddings.embed_query(query)
        try:
            result = self.client.rpc(
                "search_vector",
                {
                    "query_embedding": embedding,
                    "match_count": k,
                    "filter_namespace": self.namespace,
                },
            ).execute()
            return result.data
        except Exception:
            result = (
                self.client.table("documents")
                .select("id, content, metadata")
                .eq("namespace", self.namespace)
                .limit(k)
                .execute()
            )
            return result.data

    # Alias
    search_context_mesh = search

    # =========================================================================
    # GRAPH
    # =========================================================================

    def add_relation(
        self,
        source_id: int,
        target_id: int,
        relation_type: str = "relates_to",
        properties: dict | None = None,
    ) -> dict:
        """Add a graph edge between two documents."""
        result = (
            self.client.table("doc_relations")
            .upsert({
                "source_id": source_id,
                "target_id": target_id,
                "type": relation_type,
                "properties": properties or {},
                "namespace": self.namespace,
            })
            .execute()
        )
        return result.data[0] if result.data else {}

    # =========================================================================
    # UTILS
    # =========================================================================

    def stats(self) -> dict:
        docs = (
            self.client.table("documents")
            .select("id", count="exact")
            .eq("namespace", self.namespace)
            .execute()
        )
        rels = (
            self.client.table("doc_relations")
            .select("id", count="exact")
            .eq("namespace", self.namespace)
            .execute()
        )
        return {
            "namespace": self.namespace,
            "documents": docs.count,
            "relations": rels.count,
        }

    def get(self, id: int) -> dict | None:
        result = (
            self.client.table("documents").select("*").eq("id", id).execute()
        )
        return result.data[0] if result.data else None

    def delete_all(self) -> dict:
        self.client.table("doc_relations").delete().eq("namespace", self.namespace).execute()
        result = (
            self.client.table("documents").delete().eq("namespace", self.namespace).execute()
        )
        return {"deleted": len(result.data) if result.data else 0}

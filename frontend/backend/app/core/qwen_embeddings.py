"""
Local Qwen3-Embedding wrapper via llama.cpp OpenAI-compat API.

Connects to llama-server at EMBED_BASE_URL (default: http://localhost:8082/v1).
Drop-in replacement for GeminiEmbeddings — same embed_query / embed_documents interface.

Instruction-aware prefix improves retrieval by 1-5%:
  Instruct: <task>
  Query: <text>
"""
from __future__ import annotations
import os
import numpy as np
from typing import List
from openai import OpenAI


EMBED_BASE_URL = os.getenv("EMBED_BASE_URL", "http://localhost:8082/v1")
EMBED_MODEL = os.getenv("EMBED_MODEL", "qwen3-embedding-0.6b")
EMBED_DIM = int(os.getenv("EMBED_DIM", "1024"))

def _api_key() -> str:
    """Use NEBIUS_API_KEY for Nebius endpoints, otherwise 'not-needed' for local llama.cpp."""
    if "nebius" in EMBED_BASE_URL.lower():
        key = os.getenv("NEBIUS_API_KEY", "")
        if not key:
            raise ValueError("NEBIUS_API_KEY required when EMBED_BASE_URL points to Nebius")
        return key
    return "not-needed"

_QUERY_INSTRUCTION = "Instruct: Given a dream journal entry, retrieve similar dream narratives\nQuery: "
_DOC_INSTRUCTION = ""  # Documents are ingested as-is; instruction only needed at query time


class QwenEmbeddings:
    """
    Qwen3-Embedding-0.6b via llama.cpp OpenAI-compat endpoint.

    Uses last-token (EOS) pooling — set via --pooling last in llama-server.
    L2 normalisation is applied by the server (--embd-normalize 2).
    MRL support: native max dim 1024, can be reduced at query time.
    """

    def __init__(
        self,
        base_url: str = EMBED_BASE_URL,
        model: str = EMBED_MODEL,
        output_dimensionality: int = EMBED_DIM,
    ):
        self.model = model
        self.output_dimensionality = output_dimensionality
        self._client = OpenAI(base_url=base_url, api_key=_api_key())

    def _embed(self, texts: List[str]) -> List[List[float]]:
        kwargs: dict = {"model": self.model, "input": texts}
        if "nebius" in self._client.base_url.host.lower():
            kwargs["dimensions"] = self.output_dimensionality
        elif self.output_dimensionality < 1024:
            kwargs["extra_body"] = {"dimensions": self.output_dimensionality}
        response = self._client.embeddings.create(**kwargs)
        vecs = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
        # Normalise just in case server didn't (--embd-normalize 2 should handle this)
        return [_l2_norm(v) for v in vecs]

    def embed_query(self, text: str) -> List[float]:
        """Embed a query with instruction prefix for better retrieval."""
        prefixed = _QUERY_INSTRUCTION + text
        return self._embed([prefixed])[0]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Embed documents for ingestion (no instruction prefix needed)."""
        return self._embed(texts)


def _l2_norm(vec: List[float]) -> List[float]:
    arr = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm == 0:
        return vec
    return (arr / norm).tolist()

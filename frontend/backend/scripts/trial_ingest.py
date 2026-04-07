"""
Trial ingestion — small batch from each source to verify metadata + embeddings.
Run from frontend/backend/ with venv active.
"""
from __future__ import annotations
import sys, os, re, json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.core.rag_store import RAGStore
from app.core.qwen_embeddings import QwenEmbeddings
from app.core.adapters import DataAdapter

DATA = Path(__file__).parent.parent / "data"

# Import parsers from ingest
from scripts.ingest import _parse_hvdc_emotions, _parse_hvdc_characters


def trial():
    print("\n=== Trial Ingest ===\n")

    # 1. Test embedding
    print("[1] Testing Nebius embedding...")
    emb = QwenEmbeddings()
    vec = emb.embed_documents(["I dreamed I was flying over dark water"])
    print(f"    dim={len(vec[0])}, first 3 vals={vec[0][:3]}")
    assert len(vec[0]) == 1024, f"Expected 1024, got {len(vec[0])}"
    print("    ✓ Embedding OK\n")

    # 2. Test HVdC parsing
    print("[2] Testing HVdC parsers...")
    assert _parse_hvdc_emotions("CO D, AN 1MKA") == ["confusion", "anger"]
    assert _parse_hvdc_emotions("AP D, HA 1MKA") == ["apprehension", "happiness"]
    assert _parse_hvdc_emotions("") == []
    chars = _parse_hvdc_characters("1MSA, 1FKA, 2JSA, 1ANI")
    assert "male_stranger" in chars
    assert "female_known" in chars
    assert "animal" in chars
    print(f"    emotions: {_parse_hvdc_emotions('CO D, AN 1MKA, SD D')}")
    print(f"    characters: {chars}")
    print("    ✓ Parsers OK\n")

    # 3. DreamBank Annotated — 5 rows
    print("[3] DreamBank Annotated (5 rows)...")
    import pandas as pd
    df = pd.read_csv(DATA / "dreambank_annotated.csv", nrows=50, low_memory=False)
    items = []
    for _, row in df.iterrows():
        text = str(row.get("report", "")).strip()
        if len(text) < 20:
            continue
        meta = {"source": "dreambank_annotated_trial", "type": "dream_narrative"}
        raw_emotion = row.get("emotion", "")
        if isinstance(raw_emotion, str) and raw_emotion.strip():
            tags = _parse_hvdc_emotions(raw_emotion)
            if tags:
                meta["emotion_tags"] = tags
        raw_char = row.get("character", "")
        if isinstance(raw_char, str) and raw_char.strip():
            tags = _parse_hvdc_characters(raw_char)
            if tags:
                meta["character_tags"] = tags
        for src_col, meta_key in [("gender", "gender"), ("age", "age_group")]:
            val = row.get(src_col)
            if val is not None and str(val) not in ("nan", ""):
                meta[meta_key] = str(val).strip()
        items.append({"content": text, **meta})
        if len(items) >= 5:
            break

    rag = RAGStore(namespace="trial_test")
    r = rag.ingest_batch(items, source="dreambank_annotated_trial", type="dream_narrative")
    print(f"    created={r['created']}, skipped={r['skipped']}, patched={r['patched']}")
    for item in items[:2]:
        print(f"    → emotion_tags: {item.get('emotion_tags', 'NONE')}")
        print(f"      character_tags: {item.get('character_tags', 'NONE')}")
        print(f"      text: {item['content'][:80]}...")

    # 4. Dryad — 5 rows
    print("\n[4] Dryad Annotated (5 rows)...")
    df2 = pd.read_csv(DATA / "dryad_dreams.tsv", sep="\t", nrows=20, low_memory=False)
    items2 = []
    NUMERIC_COLS = [
        "Male", "Animal", "Friends", "Family", "Dead&Imaginary",
        "Aggression/Friendliness", "A/CIndex", "F/CIndex", "S/CIndex", "NegativeEmotions",
    ]
    for _, row in df2.iterrows():
        text = str(row.get("text_dream", "")).strip()
        if len(text) < 20:
            continue
        meta = {"source": "dryad_annotated_trial", "type": "dream_narrative"}
        for ncol in NUMERIC_COLS:
            val = row.get(ncol)
            if val is not None and str(val) not in ("nan", ""):
                try:
                    meta[f"hvdc_{ncol}"] = float(val)
                except (ValueError, TypeError):
                    pass
        # Also parse emotion codes from Dryad
        raw_emo = row.get("emotions_code", "")
        if isinstance(raw_emo, str) and raw_emo.strip():
            tags = _parse_hvdc_emotions(raw_emo)
            if tags:
                meta["emotion_tags"] = tags
        items2.append({"content": text, **meta})
        if len(items2) >= 5:
            break

    r2 = rag.ingest_batch(items2, source="dryad_annotated_trial", type="dream_narrative")
    print(f"    created={r2['created']}, skipped={r2['skipped']}, patched={r2['patched']}")
    for item in items2[:2]:
        hvdc_keys = [k for k in item if k.startswith("hvdc_")]
        print(f"    → hvdc fields: {hvdc_keys}")
        print(f"      emotion_tags: {item.get('emotion_tags', 'NONE')}")
        print(f"      text: {item['content'][:80]}...")

    # 5. Dream knowledge — Freud chunk
    print("\n[5] Freud (3 chunks)...")
    raw = (DATA / "freud_dreams.txt").read_text(encoding="utf-8", errors="replace")
    for m in ["*** START OF THE PROJECT GUTENBERG", "***START OF THE PROJECT GUTENBERG"]:
        idx = raw.find(m)
        if idx != -1:
            raw = raw[idx:]
            raw = raw[raw.find("\n") + 1:]
            break
    for m in ["*** END OF THE PROJECT GUTENBERG", "***END OF THE PROJECT GUTENBERG"]:
        idx = raw.find(m)
        if idx != -1:
            raw = raw[:idx]
            break
    chunks = DataAdapter.from_text_chunks(raw, chunk_size=1500, overlap=200)
    chunks = [c for c in chunks if len(c) > 100][:3]
    r3 = rag.ingest_batch(chunks, source="freud_trial", type="academic_chunk")
    print(f"    created={r3['created']}, skipped={r3['skipped']}")
    print(f"    chunk[0]: {chunks[0][:100]}...")

    # 6. Verify via search
    print("\n[6] Testing search...")
    results = rag.search_vector("flying anxiety fear", top_k=3)
    print(f"    Found {len(results)} results")
    for r in results:
        meta = r.get("metadata", {})
        print(f"    → source={meta.get('source')}, emotion={meta.get('emotion_tags', '-')}")
        print(f"      text: {r.get('content', '')[:80]}...")

    # 7. Cleanup trial namespace
    print("\n[7] Cleaning up trial_test namespace...")
    rag.delete_all()
    print("    ✓ Cleaned up")

    print("\n=== Trial Complete ===\n")


if __name__ == "__main__":
    trial()

"""
build_corpus_stats.py — Compute corpus-level statistics from annotated dream datasets.

Run AFTER ingest.py. Reads metadata JSONB from the documents table (populated
by the metadata-aware ingest) and writes aggregated stats to corpus_stats.

Stats produced:
  emotion:<label>      — % of dreams containing this emotion tag
  symbol:<label>       — % of dreams mentioning this symbol
  hvdc:aggression_mean — mean HVdC aggression score (from Dryad)
  hvdc:friendliness_mean
  total_dreams         — total documents in community_dreams namespace

Usage:
    cd frontend/backend && source .venv/bin/activate
    python scripts/build_corpus_stats.py
"""
from __future__ import annotations
import sys
import os
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from supabase import create_client

NAMESPACE = "community_dreams"
BATCH = 1000


def main() -> None:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL / SUPABASE_KEY not set")
        sys.exit(1)

    client = create_client(url, key)

    # ── Fetch all documents with metadata ────────────────────────────────────
    print("Fetching documents…")
    all_docs = []
    offset = 0
    while True:
        batch = (
            client.table("documents")
            .select("id, metadata")
            .eq("namespace", NAMESPACE)
            .range(offset, offset + BATCH - 1)
            .execute()
        )
        if not batch.data:
            break
        all_docs.extend(batch.data)
        offset += BATCH
        print(f"  fetched {len(all_docs)} docs…", end="\r")

    total = len(all_docs)
    print(f"\nTotal documents: {total:,}")
    if total == 0:
        print("No documents found — run ingest.py first.")
        return

    # ── Aggregate metadata ────────────────────────────────────────────────────
    emotion_counts: dict[str, int] = defaultdict(int)
    symbol_counts: dict[str, int] = defaultdict(int)
    hvdc_agg: dict[str, list[float]] = defaultdict(list)

    for doc in all_docs:
        meta = doc.get("metadata") or {}
        # Emotions (from DreamBank Annotated)
        for tag in (meta.get("emotion_tags") or []):
            emotion_counts[tag.lower()] += 1
        # Symbols (from any annotated source)
        for tag in (meta.get("symbol_tags") or []):
            symbol_counts[tag.lower()] += 1
        # HVdC numeric scores (from Dryad)
        for k, v in meta.items():
            if k.startswith("hvdc_") and isinstance(v, (int, float)):
                hvdc_agg[k[5:]].append(float(v))

    # ── Build stat rows ───────────────────────────────────────────────────────
    rows = []

    rows.append({
        "stat_key": "total_dreams",
        "stat_value": float(total),
        "count": total,
        "source": "all",
    })

    for label, count in sorted(emotion_counts.items(), key=lambda x: -x[1])[:50]:
        rows.append({
            "stat_key": f"emotion:{label}",
            "stat_value": round(count / total * 100, 2),
            "count": count,
            "source": "all",
        })

    for label, count in sorted(symbol_counts.items(), key=lambda x: -x[1])[:100]:
        rows.append({
            "stat_key": f"symbol:{label}",
            "stat_value": round(count / total * 100, 2),
            "count": count,
            "source": "all",
        })

    for key, values in hvdc_agg.items():
        rows.append({
            "stat_key": f"hvdc:{key}_mean",
            "stat_value": round(sum(values) / len(values), 4),
            "count": len(values),
            "source": "dryad_annotated",
        })

    print(f"Writing {len(rows)} stat rows to corpus_stats…")

    # Upsert in batches of 100
    for i in range(0, len(rows), 100):
        client.table("corpus_stats").upsert(
            rows[i:i + 100],
            on_conflict="stat_key,source",
        ).execute()
        print(f"  upserted {min(i + 100, len(rows))} / {len(rows)}…", end="\r")

    print(f"\nDone. corpus_stats populated with {len(rows)} rows.")

    # Quick summary
    if emotion_counts:
        top_emotions = sorted(emotion_counts.items(), key=lambda x: -x[1])[:5]
        print("\nTop emotions:", ", ".join(f"{k}({v/total*100:.1f}%)" for k, v in top_emotions))
    if symbol_counts:
        top_symbols = sorted(symbol_counts.items(), key=lambda x: -x[1])[:5]
        print("Top symbols: ", ", ".join(f"{k}({v/total*100:.1f}%)" for k, v in top_symbols))


if __name__ == "__main__":
    main()

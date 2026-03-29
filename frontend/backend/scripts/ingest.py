"""
DreamRAG one-shot ingestion script.

Ingests all data sources into two Supabase namespaces:

  community_dreams  (~115K+ dream narratives)
    - DreamBank via DReAMy-lib       22,400  HuggingFace Parquet
    - DreamBank Annotated            28,000  HuggingFace CSV  (CC-BY-NC-4.0)  ← with emotion/character metadata
    - SDDb                           44,556  Zenodo CSV
    - Dryad Annotated                20,000+ Dryad TSV                         ← with HVdC metadata

  dream_knowledge  (academic / textbook layer)
    - Freud "Interpretation of Dreams"  Project Gutenberg plain text
    - Jung "Psychology of the Unconscious"  Project Gutenberg plain text
    - Hall/Van de Castle Coding Manual  dreams.ucsc.edu scraped HTML

Usage (from frontend/backend/ with venv active):
    python scripts/ingest.py [--namespace community_dreams|dream_knowledge|all]

Safe to re-run: new rows are embedded+inserted, existing rows get missing metadata patched (no re-embed).

Requires llama.cpp embedding server running on :8082:
    llama-server --model ~/models/Qwen3-Embedding-0.6B-Q8_0.gguf \\
        --port 8082 --pooling last --embd-normalize 2 --embedding -ngl 99

Files cache to /tmp/dreamrag_ingest/
After ingest, run: python scripts/build_corpus_stats.py
"""
from __future__ import annotations
import sys
import os
import argparse
import time
from pathlib import Path

import requests
from tqdm import tqdm

# Make app.core importable when run from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.core.rag_store import RAGStore
from app.core.adapters import DataAdapter

CACHE = Path(__file__).parent.parent / "data"
UA = {"User-Agent": "Mozilla/5.0"}  # Gutenberg blocks default requests UA


# ─── Download helper ─────────────────────────────────────────────────────────

def download(url: str, dest: Path, desc: str) -> Path:
    if dest.exists():
        print(f"  [cache] {dest.name}")
        return dest
    print(f"  Downloading {desc} ...")
    r = requests.get(url, stream=True, timeout=120, headers=UA, allow_redirects=True)
    r.raise_for_status()
    total = int(r.headers.get("content-length", 0))
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "wb") as f, tqdm(total=total, unit="B", unit_scale=True) as bar:
        for chunk in r.iter_content(65536):
            f.write(chunk)
            bar.update(len(chunk))
    return dest


def _detect_text_col(df, candidates: list[str]) -> str | None:
    for c in candidates:
        if c in df.columns:
            return c
    # fallback: find any column whose name contains a hint word
    for col in df.columns:
        if any(k in col.lower() for k in ("report", "dream", "text", "content", "description", "narrative")):
            return col
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# COMMUNITY DREAMS
# ═══════════════════════════════════════════════════════════════════════════════

def ingest_dreambank_dreamy(rag: RAGStore) -> None:
    """DReAMy-lib/DreamBank-dreams-en — 22,400 records, field: 'dreams'"""
    import pandas as pd
    url = (
        "https://huggingface.co/datasets/DReAMy-lib/DreamBank-dreams-en"
        "/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet"
    )
    path = download(url, CACHE / "dreambank_dreamy.parquet", "DreamBank/DReAMy-lib (~15 MB)")
    df = pd.read_parquet(path)
    col = _detect_text_col(df, ["dreams", "report", "text"])
    if not col:
        print(f"  WARN: could not detect text column. Columns: {list(df.columns)}")
        return
    texts = [t.strip() for t in df[col].dropna().astype(str) if len(t.strip()) > 20]
    print(f"  {len(texts):,} dreams")
    r = rag.ingest_batch(texts, source="dreambank_dreamy", type="dream_narrative")
    print(f"  → created={r['created']}, skipped={r['skipped']}, patched={r['patched']}")


def ingest_dreambank_annotated(rag: RAGStore) -> None:
    """gustavecortal/DreamBank-annotated — 28,000 records (CC-BY-NC-4.0).
    Columns: id, name, number, time, date, gender, age, report, character, emotion
    """
    import ast
    import pandas as pd
    url = "https://huggingface.co/datasets/gustavecortal/DreamBank-annotated/resolve/main/train.csv"
    path = download(url, CACHE / "dreambank_annotated.csv", "DreamBank Annotated (~27 MB)")
    df = pd.read_csv(path, low_memory=False)

    items = []
    for _, row in df.iterrows():
        text = str(row.get("report", "")).strip()
        if len(text) < 20:
            continue
        meta: dict = {"source": "dreambank_annotated", "type": "dream_narrative"}

        # Identity / demographic fields
        for src_col, meta_key in [
            ("id",     "dreamer_id"),
            ("name",   "dreamer_series"),
            ("number", "dream_number"),
            ("time",   "dream_period"),
            ("date",   "dreamer_birth_year"),
            ("gender", "gender"),
            ("age",    "age_group"),
        ]:
            val = row.get(src_col)
            if val is not None and str(val) not in ("nan", ""):
                meta[meta_key] = str(val).strip()

        # emotion column is a string repr of a list, e.g. "['anger', 'joy']"
        raw_emotion = row.get("emotion", "")
        if isinstance(raw_emotion, str) and raw_emotion.strip():
            try:
                tags = ast.literal_eval(raw_emotion)
                if isinstance(tags, list):
                    meta["emotion_tags"] = [str(t).lower().strip() for t in tags if t]
            except Exception:
                pass

        # character column same format
        raw_char = row.get("character", "")
        if isinstance(raw_char, str) and raw_char.strip():
            try:
                tags = ast.literal_eval(raw_char)
                if isinstance(tags, list):
                    meta["character_tags"] = [str(t).lower().strip() for t in tags if t]
            except Exception:
                pass

        items.append({"content": text, **meta})

    print(f"  {len(items):,} dreams")
    r = rag.ingest_batch(items, source="dreambank_annotated", type="dream_narrative")
    print(f"  → created={r['created']}, skipped={r['skipped']}, patched={r['patched']}")


def ingest_sddb(rag: RAGStore) -> None:
    """SDDb — 44,556 records from Zenodo"""
    import pandas as pd
    url = "https://zenodo.org/records/11662064/files/dream-export.csv?download=1"
    path = download(url, CACHE / "sddb.csv", "SDDb/Zenodo (~34 MB)")
    df = pd.read_csv(path, low_memory=False)
    col = _detect_text_col(df, ["report", "dream_text", "text", "content", "description"])
    if not col:
        print(f"  WARN: could not detect text column. Columns: {list(df.columns)}")
        return
    print(f"  Using column: '{col}'")
    texts = [t.strip() for t in df[col].dropna().astype(str) if len(t.strip()) > 20]
    print(f"  {len(texts):,} dreams")
    r = rag.ingest_batch(texts, source="sddb", type="dream_narrative")
    print(f"  → created={r['created']}, skipped={r['skipped']}, patched={r['patched']}")


def ingest_dryad(rag: RAGStore) -> None:
    """Dryad HVdC annotated dataset — 20K+ records, TSV.
    Columns: dream_id, dreamer, description, dream_date, dream_language, text_dream,
             characters_code, emotions_code, aggression_code, friendliness_code, sexuality_code,
             Male, Animal, Friends, Family, Dead&Imaginary,
             Aggression/Friendliness, A/CIndex, F/CIndex, S/CIndex, NegativeEmotions
    """
    import pandas as pd
    url = "https://datadryad.org/downloads/file_stream/401197"
    path = download(url, CACHE / "dryad_dreams.tsv", "Dryad Annotated (~26 MB)")
    df = pd.read_csv(path, sep="\t", low_memory=False)

    TEXT_COL = "text_dream"
    # Identity / descriptor string columns to store directly
    STR_COLS = {
        "dream_id":          "dream_id",
        "dreamer":           "dreamer_id",
        "description":       "dreamer_description",
        "dream_date":        "dream_date",
        "dream_language":    "language",
        "characters_code":   "hvdc_characters_code",
        "emotions_code":     "hvdc_emotions_code",
        "aggression_code":   "hvdc_aggression_code",
        "friendliness_code": "hvdc_friendliness_code",
        "sexuality_code":    "hvdc_sexuality_code",
    }
    # Numeric HVdC metric columns
    NUMERIC_COLS = [
        "Male", "Animal", "Friends", "Family", "Dead&Imaginary",
        "Aggression/Friendliness", "A/CIndex", "F/CIndex", "S/CIndex", "NegativeEmotions",
    ]

    items = []
    for _, row in df.iterrows():
        text = str(row.get(TEXT_COL, "")).strip()
        if len(text) < 20:
            continue
        meta: dict = {"source": "dryad_annotated", "type": "dream_narrative"}

        for src_col, meta_key in STR_COLS.items():
            val = row.get(src_col)
            if val is not None and str(val) not in ("nan", ""):
                meta[meta_key] = str(val).strip()

        for ncol in NUMERIC_COLS:
            val = row.get(ncol)
            if val is not None and str(val) not in ("nan", ""):
                try:
                    meta[f"hvdc_{ncol}"] = float(val)
                except (ValueError, TypeError):
                    pass

        items.append({"content": text, **meta})

    print(f"  {len(items):,} dreams")
    r = rag.ingest_batch(items, source="dryad_annotated", type="dream_narrative")
    print(f"  → created={r['created']}, skipped={r['skipped']}, patched={r['patched']}")


# ═══════════════════════════════════════════════════════════════════════════════
# DREAM KNOWLEDGE (textbook layer)
# ═══════════════════════════════════════════════════════════════════════════════

def ingest_gutenberg_text(rag: RAGStore, url: str, filename: str, source: str, title: str) -> None:
    """Download a Gutenberg plain-text file, strip header/footer, chunk, and ingest."""
    path = download(url, CACHE / filename, f"{title} (Gutenberg)")
    raw = path.read_text(encoding="utf-8", errors="replace")

    # Strip standard Gutenberg header and footer
    start_markers = ["*** START OF THE PROJECT GUTENBERG", "***START OF THE PROJECT GUTENBERG"]
    end_markers = ["*** END OF THE PROJECT GUTENBERG", "***END OF THE PROJECT GUTENBERG"]
    for m in start_markers:
        idx = raw.find(m)
        if idx != -1:
            raw = raw[idx:]
            raw = raw[raw.find("\n") + 1:]  # skip the marker line itself
            break
    for m in end_markers:
        idx = raw.find(m)
        if idx != -1:
            raw = raw[:idx]
            break

    chunks = DataAdapter.from_text_chunks(raw, chunk_size=1500, overlap=200)
    chunks = [c for c in chunks if len(c) > 100]
    print(f"  {len(chunks)} chunks from {title}")
    r = rag.ingest_batch(chunks, source=source, type="academic_chunk")
    print(f"  → created={r['created']}, skipped={r['skipped']}, patched={r['patched']}")


def ingest_hvdc_manual(rag: RAGStore) -> None:
    """Scrape Hall/Van de Castle coding manual from dreams.ucsc.edu/Coding/"""
    from bs4 import BeautifulSoup

    base = "https://dreams.ucsc.edu"
    index_url = f"{base}/Coding/"

    print(f"  Fetching HVdC index: {index_url}")
    resp = requests.get(index_url, timeout=30, headers=UA)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Collect all internal links from the coding index
    links = set()
    links.add(index_url)
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("/Coding/") or href.startswith("Coding/"):
            full = base + "/" + href.lstrip("/")
            links.add(full)
        elif href.startswith(base + "/Coding/"):
            links.add(href)

    print(f"  Found {len(links)} HVdC pages to scrape")
    all_chunks: list[str] = []

    for url in sorted(links):
        try:
            time.sleep(0.5)  # be polite
            r = requests.get(url, timeout=30, headers=UA)
            r.raise_for_status()
            page_soup = BeautifulSoup(r.text, "html.parser")
            # Remove nav/header/footer noise
            for tag in page_soup(["nav", "header", "footer", "script", "style"]):
                tag.decompose()
            text = page_soup.get_text(separator="\n", strip=True)
            if len(text) > 200:
                chunks = DataAdapter.from_text_chunks(text, chunk_size=1200, overlap=150)
                all_chunks.extend(c for c in chunks if len(c) > 100)
        except Exception as e:
            print(f"  WARN: failed {url}: {e}")

    print(f"  {len(all_chunks)} chunks from HVdC manual")
    r = rag.ingest_batch(all_chunks, source="hvdc_manual", type="academic_chunk")
    print(f"  → created={r['created']}, skipped={r['skipped']}, patched={r['patched']}")


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def check_embedding_server() -> bool:
    try:
        return requests.get("http://localhost:8082/health", timeout=3).status_code == 200
    except Exception:
        return False



def run_community_dreams() -> None:
    print("\n── community_dreams ────────────────────────────────────────")
    rag = RAGStore(namespace="community_dreams")

    # [disabled] dreambank_dreamy — bare text only, no annotations
    # print("\n[1/4] DreamBank (DReAMy-lib)")
    # ingest_dreambank_dreamy(rag)

    print("\n[1/2] DreamBank Annotated")
    ingest_dreambank_annotated(rag)

    # [disabled] sddb — bare text only, no annotations
    # print("\n[3/4] SDDb")
    # ingest_sddb(rag)

    print("\n[2/2] Dryad Annotated")
    ingest_dryad(rag)

    s = rag.stats()
    print(f"\n  community_dreams total: {s['documents']:,} documents")


def run_dream_knowledge() -> None:
    print("\n── dream_knowledge ─────────────────────────────────────────")
    rag = RAGStore(namespace="dream_knowledge")

    print("\n[1/3] Freud — Interpretation of Dreams")
    ingest_gutenberg_text(
        rag,
        url="https://www.gutenberg.org/files/66048/66048-0.txt",
        filename="freud_dreams.txt",
        source="freud_interpretation_of_dreams",
        title="Freud: Interpretation of Dreams",
    )

    print("\n[2/3] Jung — Psychology of the Unconscious")
    ingest_gutenberg_text(
        rag,
        url="https://www.gutenberg.org/files/65903/65903-0.txt",
        filename="jung_psychology_unconscious.txt",
        source="jung_psychology_of_the_unconscious",
        title="Jung: Psychology of the Unconscious",
    )

    print("\n[3/3] Hall/Van de Castle Coding Manual")
    ingest_hvdc_manual(rag)

    s = rag.stats()
    print(f"\n  dream_knowledge total: {s['documents']:,} documents")


def main() -> None:
    parser = argparse.ArgumentParser(description="DreamRAG ingest")
    parser.add_argument(
        "--namespace",
        choices=["community_dreams", "dream_knowledge", "all"],
        default="all",
        help="Which namespace to ingest (default: all)",
    )
    args = parser.parse_args()

    print("\n=== DreamRAG Ingest ===\n")

    if not (os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY"))):
        print("ERROR: SUPABASE_URL / SUPABASE_KEY not set in backend/.env")
        sys.exit(1)

    if not check_embedding_server():
        print("ERROR: llama.cpp embedding server not reachable at http://localhost:8082")
        print("\nStart it with:")
        print("  llama-server --model ~/models/Qwen3-Embedding-0.6B-Q8_0.gguf \\")
        print("    --port 8082 --pooling last --embd-normalize 2 --embedding -ngl 99")
        sys.exit(1)

    CACHE.mkdir(exist_ok=True)
    print(f"Cache: {CACHE}\n")

    if args.namespace in ("community_dreams", "all"):
        run_community_dreams()

    if args.namespace in ("dream_knowledge", "all"):
        run_dream_knowledge()

    print("\n=== Done ===")


if __name__ == "__main__":
    main()

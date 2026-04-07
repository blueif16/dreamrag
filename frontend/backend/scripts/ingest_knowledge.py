#!/usr/bin/env python3
"""Zero-dependency knowledge ingestion. Uses only stdlib + requests."""
import os, json, hashlib, time, sys, urllib.request, urllib.error

SUPA_URL = "https://jhputxzfrrpwogcnklap.supabase.co"
SUPA_KEY = "YOUR_SUPABASE_SECRET_KEY"
NEBIUS_KEY = "YOUR_NEBIUS_API_KEY"
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")


def _post(url, headers, body, timeout=60):
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def _get(url, headers, timeout=15):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read()), dict(resp.headers)


def embed(texts):
    r = _post(
        "https://api.tokenfactory.nebius.com/v1/embeddings",
        {"Authorization": f"Bearer {NEBIUS_KEY}", "Content-Type": "application/json"},
        {"model": "Qwen/Qwen3-Embedding-8B", "input": texts, "dimensions": 1024},
    )
    return [item["embedding"] for item in sorted(r["data"], key=lambda x: x["index"])]


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()[:32]


def chunk_text(text, size=1500, overlap=200):
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        chunk = text[start:end]
        if end < len(text):
            for sep in ["\n\n", ".\n", ". ", "\n"]:
                pos = chunk.rfind(sep)
                if pos > size * 0.5:
                    end = start + pos + len(sep)
                    chunk = text[start:end]
                    break
        chunks.append(chunk.strip())
        start = end if end == len(text) else end - overlap
    return [c for c in chunks if len(c) > 100]


def strip_gutenberg(text):
    for m in ["*** START OF THE PROJECT GUTENBERG", "***START OF THE PROJECT GUTENBERG"]:
        i = text.find(m)
        if i != -1:
            text = text[i + len(m):]
            text = text[text.find("\n") + 1:]
            break
    for m in ["*** END OF THE PROJECT GUTENBERG", "***END OF THE PROJECT GUTENBERG"]:
        i = text.find(m)
        if i != -1:
            text = text[:i]
            break
    return text


def supa_headers(prefer="return=representation"):
    h = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}", "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    return h


def ingest(chunks, source, batch_size=5):
    created, skipped = 0, 0
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        hashes = [sha(c) for c in batch]

        # check existing
        existing = set()
        try:
            hash_list = ",".join(hashes)
            url = f"{SUPA_URL}/rest/v1/documents?select=content_hash&namespace=eq.dream_knowledge&content_hash=in.({hash_list})"
            rows, _ = _get(url, supa_headers(""))
            existing = {r["content_hash"] for r in rows}
        except Exception:
            pass

        new = [(c, h) for c, h in zip(batch, hashes) if h not in existing]
        skipped += len(batch) - len(new)
        if not new:
            continue

        vecs = embed([c for c, _ in new])

        records = []
        for (content, h), vec in zip(new, vecs):
            records.append({
                "content": content,
                "content_hash": h,
                "embedding": vec,
                "metadata": {"source": source, "type": "academic_chunk"},
                "namespace": "dream_knowledge",
            })

        for attempt in range(3):
            try:
                _post(f"{SUPA_URL}/rest/v1/documents", supa_headers(), records)
                created += len(records)
                break
            except Exception as e:
                if attempt < 2:
                    print(f"    retry {attempt+1}: {e}", flush=True)
                    time.sleep(2)
                else:
                    raise

        print(f"  [{i+len(batch)}/{len(chunks)}] +{len(new)}", flush=True)

    return created, skipped


if __name__ == "__main__":
    for name, filename, source in [
        ("Freud — Interpretation of Dreams", "freud_dreams.txt", "freud_interpretation_of_dreams"),
        ("Jung — Psychology of the Unconscious", "jung_psychology_unconscious.txt", "jung_psychology_of_the_unconscious"),
    ]:
        path = os.path.join(DATA, filename)
        print(f"\n{name}", flush=True)
        with open(path, encoding="utf-8", errors="replace") as f:
            raw = strip_gutenberg(f.read())
        chunks = chunk_text(raw)
        print(f"  {len(chunks)} chunks", flush=True)
        c, s = ingest(chunks, source)
        print(f"  done: created={c}, skipped={s}", flush=True)

    print("\nDone!", flush=True)

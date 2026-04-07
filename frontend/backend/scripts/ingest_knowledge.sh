#!/bin/bash
# Ingest Freud + Jung into dream_knowledge via curl only. No Python.
set -e

SUPA_URL="https://jhputxzfrrpwogcnklap.supabase.co"
SUPA_KEY="YOUR_SUPABASE_SECRET_KEY"
NEBIUS_KEY="YOUR_NEBIUS_API_KEY"
DATA="$(cd "$(dirname "$0")/.." && pwd)/data"
CHUNKS_DIR="/tmp/dreamrag_chunks"
rm -rf "$CHUNKS_DIR" && mkdir -p "$CHUNKS_DIR"

# Step 1: Use Python ONLY for chunking (fast, no imports besides stdlib)
echo "=== Chunking texts ==="
/usr/bin/python3 -c "
import json, os, hashlib
DATA = '$DATA'
OUT = '$CHUNKS_DIR'

def sha(t): return hashlib.sha256(t.encode()).hexdigest()[:32]

def chunk(text, size=1500, overlap=200):
    chunks, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        c = text[start:end]
        if end < len(text):
            for sep in [chr(10)*2, '.'+chr(10), '. ', chr(10)]:
                pos = c.rfind(sep)
                if pos > size * 0.5:
                    end = start + pos + len(sep)
                    c = text[start:end]
                    break
        chunks.append(c.strip())
        start = end - overlap
    return [c for c in chunks if len(c) > 100]

def strip(text):
    for m in ['*** START OF THE PROJECT GUTENBERG', '***START OF THE PROJECT GUTENBERG']:
        i = text.find(m)
        if i != -1: text = text[i+len(m):]; text = text[text.find(chr(10))+1:]; break
    for m in ['*** END OF THE PROJECT GUTENBERG', '***END OF THE PROJECT GUTENBERG']:
        i = text.find(m)
        if i != -1: text = text[:i]; break
    return text

for name, fn, src in [('freud', 'freud_dreams.txt', 'freud_interpretation_of_dreams'), ('jung', 'jung_psychology_unconscious.txt', 'jung_psychology_of_the_unconscious')]:
    raw = strip(open(os.path.join(DATA, fn), encoding='utf-8', errors='replace').read())
    cs = chunk(raw)
    # Write each batch of 5 as a JSON file
    batch_num = 0
    for i in range(0, len(cs), 5):
        batch = cs[i:i+5]
        records = []
        for c in batch:
            records.append({'content': c, 'hash': sha(c), 'source': src})
        with open(os.path.join(OUT, f'{name}_{batch_num:04d}.json'), 'w') as f:
            json.dump(records, f)
        batch_num += 1
    print(f'{name}: {len(cs)} chunks -> {batch_num} batch files')
"

echo ""
echo "=== Embedding + inserting batches ==="
TOTAL=$(ls "$CHUNKS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
COUNT=0

for batch_file in "$CHUNKS_DIR"/*.json; do
    COUNT=$((COUNT + 1))

    # Read batch
    TEXTS=$(cat "$batch_file" | /usr/bin/python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps([r['content'] for r in d]))")

    # Embed via Nebius
    EMBED_RESP=$(curl -s -X POST "https://api.tokenfactory.nebius.com/v1/embeddings" \
        -H "Authorization: Bearer $NEBIUS_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"Qwen/Qwen3-Embedding-8B\",\"input\":$TEXTS,\"dimensions\":1024}")

    # Build insert payload
    RECORDS=$(/usr/bin/python3 -c "
import sys, json
batch = json.load(open('$batch_file'))
embed = json.loads('''$EMBED_RESP''')
vecs = [item['embedding'] for item in sorted(embed['data'], key=lambda x: x['index'])]
records = []
for rec, vec in zip(batch, vecs):
    records.append({
        'content': rec['content'],
        'content_hash': rec['hash'],
        'embedding': vec,
        'metadata': {'source': rec['source'], 'type': 'academic_chunk'},
        'namespace': 'dream_knowledge'
    })
print(json.dumps(records))
")

    # Insert into Supabase
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPA_URL/rest/v1/documents" \
        -H "apikey: $SUPA_KEY" \
        -H "Authorization: Bearer $SUPA_KEY" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "$RECORDS")

    echo "[$COUNT/$TOTAL] $HTTP_CODE $(basename "$batch_file")"

    if [ "$HTTP_CODE" != "201" ]; then
        echo "  WARN: got $HTTP_CODE, retrying in 2s..."
        sleep 2
        curl -s -o /dev/null -w "  retry: %{http_code}\n" -X POST "$SUPA_URL/rest/v1/documents" \
            -H "apikey: $SUPA_KEY" \
            -H "Authorization: Bearer $SUPA_KEY" \
            -H "Content-Type: application/json" \
            -H "Prefer: return=minimal" \
            -d "$RECORDS"
    fi
done

echo ""
echo "=== Done ==="
curl -s "$SUPA_URL/rest/v1/documents?select=id&namespace=eq.dream_knowledge&limit=0" \
    -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY" -H "Prefer: count=exact" \
    -D - -o /dev/null 2>&1 | grep content-range

rm -rf "$CHUNKS_DIR"

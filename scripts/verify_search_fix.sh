#!/usr/bin/env bash
# Verify the 005_fix_search_functions.sql migration landed correctly.
# Usage: bash scripts/verify_search_fix.sh
set -euo pipefail

# Load Supabase creds
if [ -f frontend/backend/.env ]; then
  set -a; source frontend/backend/.env; set +a
fi
KEY="${SUPABASE_KEY:-${SUPABASE_SECRET_KEY:-}}"
if [ -z "${SUPABASE_URL:-}" ] || [ -z "$KEY" ]; then
  echo "SUPABASE_URL / SUPABASE_KEY not set" >&2; exit 1
fi

# Build a realistic-ish 1024-d unit vector (doesn't need to match a real query
# semantically — we just need HNSW to return *some* neighbours per namespace).
PAYLOAD=$(python3 - <<'PY'
import json, math, random
random.seed(42)
v = [random.gauss(0, 1) for _ in range(1024)]
n = math.sqrt(sum(x*x for x in v))
v = [x / n for x in v]
print(json.dumps({"v": v}))
PY
)
VEC=$(python3 -c "import json,sys; print(json.dumps(json.loads(sys.argv[1])['v']))" "$PAYLOAD")

echo "=== search_vector dream_knowledge ==="
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/search_vector" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query_embedding\": $VEC, \"match_count\": 3, \"filter_namespace\": \"dream_knowledge\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('count:', len(d) if isinstance(d,list) else d); [print(' ', r['id'], round(r['similarity'],3)) for r in (d if isinstance(d,list) else [])]"

echo
echo "=== search_context_mesh dream_knowledge ==="
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/search_context_mesh" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query_text\": \"dream symbolism unconscious\", \"query_embedding\": $VEC, \"match_count\": 3, \"filter_namespace\": \"dream_knowledge\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('count:', len(d) if isinstance(d,list) else d); [print(' ', r['id'], r.get('source_type'), round(r['score'],4)) for r in (d if isinstance(d,list) else [])]"

echo
echo "=== search_context_mesh community_dreams (sanity) ==="
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/search_context_mesh" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query_text\": \"flying over water\", \"query_embedding\": $VEC, \"match_count\": 3, \"filter_namespace\": \"community_dreams\"}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('count:', len(d) if isinstance(d,list) else d); [print(' ', r['id'], r.get('source_type'), round(r['score'],4)) for r in (d if isinstance(d,list) else [])]"

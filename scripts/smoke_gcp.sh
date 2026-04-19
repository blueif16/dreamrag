#!/usr/bin/env bash
# End-to-end smoke test for the DreamRAG stack on GCP.
# Usage: scripts/smoke_gcp.sh <GCP_VM_IP>
# Exits non-zero on any failure. No human judgment required.
set -euo pipefail

VM="${1:?usage: smoke_gcp.sh <GCP_VM_IP>}"
CHAT="http://$VM:8081"
EMBED="http://$VM:8082"
BACKEND="http://$VM:8000"
FRONTEND="http://$VM:3000"

pass() { printf "  \033[32mOK\033[0m  %s\n" "$1"; }
fail() { printf "  \033[31mFAIL\033[0m  %s\n" "$1"; exit 1; }

echo "[1/7] chat-model /health"
curl -fsS "$CHAT/health" | grep -q '"status":"ok"' && pass "chat /health" || fail "chat /health"

echo "[2/7] embed-model /health"
curl -fsS "$EMBED/health" | grep -q '"status":"ok"' && pass "embed /health" || fail "embed /health"

echo "[3/7] chat completion — tool-arg fidelity"
RESP=$(curl -fsS "$CHAT/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3.6-35b-a3b","messages":[{"role":"user","content":"Reply with exactly this JSON and nothing else: {\"ok\":true}"}],"temperature":0,"max_tokens":32}')
echo "$RESP" | python3 -c 'import sys,json,re; r=json.load(sys.stdin); c=r["choices"][0]["message"]["content"]; m=re.search(r"\{\s*\"ok\"\s*:\s*true\s*\}",c); assert m, c' \
  && pass "chat tool-arg fidelity" || fail "chat tool-arg fidelity: $RESP"

echo "[4/7] embedding dim = 1024"
curl -fsS "$EMBED/v1/embeddings" \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3-embedding-0.6b","input":"a dream of flying over water"}' \
  | python3 -c 'import sys,json; v=json.load(sys.stdin)["data"][0]["embedding"]; assert len(v)==1024, len(v)' \
  && pass "embed dim=1024" || fail "embed dim"

echo "[5/7] backend /copilotkit reachable"
CODE=$(curl -fsS -o /dev/null -w '%{http_code}' -X POST "$BACKEND/copilotkit" -H 'Content-Type: application/json' -d '{}' || echo 000)
[[ "$CODE" =~ ^(200|400|405|422)$ ]] && pass "backend reachable ($CODE)" || fail "backend $CODE"

echo "[6/7] frontend serving"
curl -fsS -o /dev/null "$FRONTEND" && pass "frontend 200" || fail "frontend down"

echo "[7/7] cold-then-warm latency (TTFT)"
T0=$(python3 -c 'import time; print(time.time())')
curl -fsS -o /dev/null "$CHAT/v1/chat/completions" -H 'Content-Type: application/json' \
  -d '{"model":"qwen3.6-35b-a3b","messages":[{"role":"user","content":"hi"}],"max_tokens":1}'
T1=$(python3 -c 'import time; print(time.time())')
curl -fsS -o /dev/null "$CHAT/v1/chat/completions" -H 'Content-Type: application/json' \
  -d '{"model":"qwen3.6-35b-a3b","messages":[{"role":"user","content":"hi"}],"max_tokens":1}'
T2=$(python3 -c 'import time; print(time.time())')
COLD_MS=$(python3 -c "print(int(($T1-$T0)*1000))")
WARM_MS=$(python3 -c "print(int(($T2-$T1)*1000))")
echo "  cold=${COLD_MS}ms warm=${WARM_MS}ms"
(( WARM_MS < 2500 )) && pass "warm TTFT < 2.5s" || fail "warm TTFT ${WARM_MS}ms exceeds budget"

echo
echo "ALL GREEN — demo-day ready."

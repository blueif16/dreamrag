# GCP VM Smoke Test — Fully Automated Runbook

> **Audience: Claude Code (autonomous operator).**
> The human user will not run any test commands. Claude owns the entire verification loop: provision check → bring stack up → run probes → interpret failures → fix or escalate.
> Stop and ask the user only for: (a) the VM IP/SSH alias, (b) destructive actions (VM delete, `docker system prune`), (c) cost decisions (keep running vs `gcloud compute instances stop`).

---

## 0. Inputs Claude Needs Before Starting

Ask the user once, then cache for the whole session:

| Variable | Purpose | How to obtain |
|----------|---------|---------------|
| `VM_IP` | External IP of `dreamrag-vm` | `gcloud compute instances describe dreamrag-vm --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)'` |
| `SSH_USER` | Linux user on the VM | Usually the gcloud account local-part; confirm via `gcloud compute ssh dreamrag-vm --command=whoami` |
| `ZONE` | GCP zone | Default `us-central1-a` unless told otherwise |

Do not prompt for Supabase creds — they already live in `frontend/backend/.env` and are mounted via `env_file` in compose.

---

## 1. Pre-flight (Local Laptop, Before Touching the VM)

Run from `/Users/tk/Desktop/dreamrag`. All commands must exit 0.

```bash
docker compose config --quiet                          # 1.1 YAML syntax valid
docker compose config | grep -q 'enable_thinking'      # 1.2 JSON kwargs survived YAML parsing
test -f frontend/backend/.env && grep -q SUPABASE_URL frontend/backend/.env  # 1.3 secrets present
test -x scripts/smoke_gcp.sh                            # 1.4 smoke script executable
```

If 1.2 fails, the `--chat-template-kwargs` arg was mangled — re-check `docker-compose.yml` uses the list-form `command:` block, not the folded `>` scalar.

---

## 2. Provision Verification (VM Must Already Exist)

Do **not** create or delete VMs autonomously. Only verify the existing one:

```bash
gcloud compute instances describe dreamrag-vm --zone="$ZONE" \
  --format='value(status,machineType.basename(),guestAccelerators[0].acceleratorType.basename())'
# Expect: RUNNING  g2-standard-8  nvidia-l4
```

If status is `TERMINATED`, ask the user: *"VM is stopped. Start it? (yes/no)"*. Only start on explicit confirmation.

SSH reachability + GPU visible:

```bash
gcloud compute ssh dreamrag-vm --zone="$ZONE" --command='nvidia-smi -L'
# Expect: GPU 0: NVIDIA L4 (UUID: ...)
```

If `nvidia-smi` is missing, the NVIDIA driver install metadata never ran. Escalate to the user with the exact error — do not try to reinstall drivers autonomously (reboot required).

---

## 3. Deploy the Stack

From the laptop, using the SSH-over-Docker context:

```bash
docker context inspect gcp-dreamrag >/dev/null 2>&1 \
  || docker context create gcp-dreamrag --docker "host=ssh://${SSH_USER}@${VM_IP}"
docker --context gcp-dreamrag compose up -d --build
```

First boot downloads ~18 GB of GGUFs into the `hf-cache` volume. Expect 5–12 min depending on GCP egress. While waiting, tail the model logs:

```bash
docker --context gcp-dreamrag compose logs -f chat-model
# Wait for: "main: server is listening on http://0.0.0.0:8081 - starting the main loop"
```

**Polling rule for Claude:** do **not** sleep-loop on the shell. Instead, use the healthcheck — compose's `service_healthy` gate already blocks `backend` startup until chat+embed report healthy. Check state once with:

```bash
docker --context gcp-dreamrag compose ps --format 'table {{.Service}}\t{{.Status}}'
```

All four services must reach `Up (healthy)` before Step 4. If a service stays `Up (health: starting)` >15 min for chat-model, something is wrong (likely OOM on download or CUDA init failure) — go to §6 troubleshooting.

---

## 4. One-time Data Ingest

Run once per fresh Supabase project (idempotent otherwise — the script upserts):

```bash
docker --context gcp-dreamrag compose exec backend python scripts/ingest.py
```

Expected tail: `ingested N chunks into community_dreams` and `ingested M chunks into dream_knowledge`. A row count spot-check:

```bash
docker --context gcp-dreamrag compose exec backend python - <<'PY'
import os
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
for ns in ("community_dreams", "dream_knowledge"):
    n = sb.table("documents").select("id", count="exact").eq("namespace", ns).execute()
    print(ns, n.count)
    assert n.count > 0, f"namespace {ns} empty"
PY
```

---

## 5. Automated Smoke (The Actual Test)

```bash
./scripts/smoke_gcp.sh "$VM_IP"
```

Script performs seven probes; see `scripts/smoke_gcp.sh` for source. Exit code 0 = demo-ready.

| Step | What it catches |
|------|-----------------|
| 1 `/health` chat | Server crashed, OOM, or wrong port |
| 2 `/health` embed | Embed server missing, wrong pooling flag |
| 3 chat tool-arg fidelity | KV quant too aggressive, template broken, sampler drift |
| 4 embed dim = 1024 | MRL misconfig, wrong model pulled |
| 5 `POST /copilotkit` | FastAPI not mounted, CORS misconfig, env vars missing |
| 6 `GET :3000` | Next.js build failed, wrong `REMOTE_ACTION_URL` |
| 7 cold+warm TTFT | CPU fallback, offload regression |

### Scripted end-to-end agent turn

`smoke_gcp.sh` only exercises the REST surface. For the full AG-UI loop (frontend-tools registration → llama.cpp tool-call → LangGraph spawn → state stream), add this one-shot probe:

```bash
docker --context gcp-dreamrag compose exec backend python - <<'PY'
import asyncio, json, os, httpx
async def main():
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post("http://localhost:8000/copilotkit",
            json={"threadId":"smoke","runId":"smoke-1","messages":[
                {"id":"u1","role":"user","content":"I had a dream of flying over a dark ocean."}
            ],"state":{"active_widgets":[]},"tools":[],"context":[],"forwardedProps":{}})
        r.raise_for_status()
        body = r.text
        assert "TOOL_CALL_START" in body or "tool_calls" in body, body[:500]
        assert "active_widgets" in body, "no widget state in stream"
        print("agent turn ok — spawned widgets detected")
asyncio.run(main())
PY
```

Failure modes this catches: tools arriving as `[]` at backend (see `docs/bug-tool-registration-pipeline.md`), Qwen3 malformed tool-call JSON not being repaired, spawn tool not writing to `active_widgets`.

---

## 6. Triage Cheatsheet (What Claude Does When a Step Fails)

| Symptom | Likely cause | Autonomous fix | Escalate |
|---------|--------------|----------------|----------|
| `chat-model` stuck `health: starting` >15 min | HF download stalled or CUDA init loop | `docker --context gcp-dreamrag compose logs --tail=200 chat-model` then retry `up -d` | If logs show `CUDA error: out of memory`, ask user before dropping `-c` |
| Step 3 returns valid chat but wrong JSON | `enable_thinking` not applied, sampler drift | Verify `docker compose config` still shows the JSON kwargs; if missing, patch compose | Never silently lower temperature — ask user |
| Step 4 returns 768 dims | Wrong model pulled | Check `alias` and `-hf` tag in compose; purge `hf-cache` volume **only after user consent** | Always — volume purge re-downloads 18 GB |
| Step 5 returns 500 | Supabase auth failed, `EMBED_BASE_URL` not wired | `docker compose exec backend env \| grep -E 'SUPABASE\|EMBED\|OPENAI'` — confirm overrides landed | If creds invalid, escalate; do not rotate keys |
| Step 7 warm TTFT >2.5 s | Layers offloaded to CPU | `docker compose logs chat-model \| grep -E 'offloaded\|CUDA'` — confirm all layers on GPU | If `-ngl 99` isn't taking, escalate |
| `nvidia-smi` shows 0% GPU util during chat | Container lost GPU access | `docker compose restart chat-model`; re-run smoke | If persists, ask user |

**Never do autonomously, even to unblock tests:**
- `docker system prune`, `docker volume rm hf-cache`, or any flag that deletes downloaded models
- `gcloud compute instances delete` or `reset`
- Edit `frontend/backend/.env` to swap real creds
- Change model quant or turn off `-fa on` / `fp16 KV` — these affect demo correctness
- Rotate / regenerate Supabase keys

---

## 7. Shutdown After Testing

When smoke is green and the user has reviewed, ask: *"Stack is green. Stop the VM to save cost until demo? (stop / suspend / leave running)"*.

- `stop` — cheapest, re-start ~1–2 min: `gcloud compute instances stop dreamrag-vm --zone="$ZONE"`
- `suspend` — preserves RAM (including loaded models), re-start ~30 s, costs disk: `gcloud compute instances suspend dreamrag-vm --zone="$ZONE"`
- `leave running` — demo-day mode; GPU billed ~$0.70/hr on g2-standard-8

On demo day, `gcloud compute instances start ... && ./scripts/smoke_gcp.sh VM_IP` — if green, open the frontend URL.

---

## 8. Test Log (Append-Only)

Claude appends one block per smoke run below. Do not rewrite history — only append.

<!-- TEMPLATE
### YYYY-MM-DD HH:MM TZ — <short summary>
- VM: dreamrag-vm / us-central1-a / <IP>
- Compose state: all healthy / <service> unhealthy
- Probes:
  - [1–7] pass/fail per smoke_gcp.sh
  - agent-turn probe: pass/fail
- Observations: <TTFT cold/warm ms, VRAM %, notable logs>
- Actions taken: <restart/redeploy/triage cheatsheet entry #>
- Outcome: demo-ready | needs follow-up (see below)
- Follow-ups: <bullet list or "none">
-->

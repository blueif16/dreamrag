# GCP VM Smoke Test — Fully Automated Runbook

> **Audience: Claude Code (autonomous operator).**
> The human user will not run any test commands. Claude owns the entire verification loop: provision check → bring stack up → run probes → interpret failures → fix or escalate.
> Stop and ask the user only for: (a) the VM IP/SSH alias, (b) destructive actions (VM delete, `docker system prune`), (c) cost decisions (keep running vs `gcloud compute instances stop`).

---

## 0. Inputs Claude Needs Before Starting

Ask the user once, then cache for the whole session:

| Variable | Purpose | How to obtain |
|----------|---------|---------------|
| `PROJECT` | GCP project id | `gcloud config get-value project` |
| `ZONE` | GCP zone — **may not be `us-central1-a`** | L4 stockout is common; we have historically landed in `us-west1-a`. Confirm via `gcloud compute instances list --filter='name=dreamrag-vm' --format='value(zone.basename())'` |
| `VM_IP` | External IP | `gcloud compute instances describe dreamrag-vm --zone=$ZONE --project=$PROJECT --format='get(networkInterfaces[0].accessConfigs[0].natIP)'` |
| `SSH_USER` | Linux user on the VM | Usually the gcloud account local-part; confirm via `gcloud compute ssh dreamrag-vm --zone=$ZONE --command=whoami` |

Do not prompt for Supabase creds — they already live in `frontend/backend/.env` and are mounted via `env_file` in compose. Supabase is shared between local dev and the GCP stack, so **data is already ingested — do NOT run `scripts/ingest.py` on the VM.**

---

## 0.5. First-Time Provision (Skip If VM Already Exists)

If `gcloud compute instances describe dreamrag-vm` returns `NOT_FOUND`, you are on a fresh project or a new machine. Run the provisioning block in `CLAUDE.md` → "One-time VM provisioning" and "One-time VM setup (on the VM)" sections. The runbook there is the source of truth for:

- Compute Engine API enablement
- GPU quota request (`GPUS_ALL_REGIONS` global **and** `NVIDIA_L4_GPUS` regional — Education accounts start at 0 for both, require manual request)
- VM `gcloud compute instances create` command (image family is `common-cu129-ubuntu-2204-nvidia-580`, boot disk 150GB)
- L4 zone fallback list when `us-central1-a` reports `ZONE_RESOURCE_POOL_EXHAUSTED`
- Docker install on the VM (DLVM image ships without Docker despite having `nvidia-ctk`)
- Firewall rule for tcp:3000 and tcp:8000
- Adding the VM to `~/.ssh/config` so Docker's SSH context can auth with the gcloud key

Only proceed to §1 once `gcloud compute ssh dreamrag-vm --command='docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi -L'` prints the L4 GPU.

---

## 1. Pre-flight (Local Laptop, Before Touching the VM)

Run from `/Users/tk/Desktop/dreamrag`. All commands must exit 0.

```bash
docker compose config --quiet                          # 1.1 YAML syntax valid
docker compose config | grep -q 'enable_thinking'      # 1.2 JSON kwargs survived YAML parsing
test -f frontend/backend/.env && grep -q SUPABASE_URL frontend/backend/.env  # 1.3 secrets present
test -x scripts/smoke_gcp.sh                           # 1.4 smoke script executable
test -f frontend/.npmrc && grep -q 'legacy-peer-deps=true' frontend/.npmrc  # 1.5 legacy-peer-deps
grep -q 'COPY package\*.json \.npmrc' frontend/Dockerfile                  # 1.6 Dockerfile copies .npmrc
```

If 1.2 fails, the `--chat-template-kwargs` arg was mangled — re-check `docker-compose.yml` uses the list-form `command:` block, not the folded `>` scalar.

If 1.5 or 1.6 fails, `npm ci` inside the frontend container will die on `next-themes@0.3.0` not accepting React 19 peer. The repo `.npmrc` sets `legacy-peer-deps=true`; the Dockerfile must COPY it alongside `package*.json`, otherwise the setting is dropped at build time.

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

## 4. Data Ingest — Already Done, DO NOT Re-Run

The Supabase project is shared between local dev and the GCP stack. All rows in `community_dreams` and `dream_knowledge` were ingested once from a laptop and persist across VM recreations, GPU detach/reattach, and full project wipes.

**Only re-run `scripts/ingest.py` if a fresh/different Supabase project is being used.** Otherwise skip straight to §5.

Spot-check row counts (safe to run any time):

```bash
docker --context gcp-dreamrag compose exec -T backend .venv/bin/python - <<'PY'
import os
from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])
for ns in ("community_dreams", "dream_knowledge"):
    n = sb.table("documents").select("id", count="exact").eq("namespace", ns).execute()
    print(ns, n.count)
    assert n.count > 0, f"namespace {ns} empty"
PY
```

Note: invoke the backend python via `.venv/bin/python`, NOT bare `python` — the Dockerfile installs deps into `/app/backend/.venv`, and the system python in the base image does not have `requests`, `supabase`, `httpx`, etc.

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
| chat-model crash-loops with `CUDA error: out of memory in ggml_cuda_flash_attn_ext_mma_f16_case` | L4 shared-mem-per-block cap hit by FA kernel for Qwen3.6 head_dim=256 | Verify `docker-compose.yml` has chat-model `-ub 128` (NOT 512); recreate | If `-ub 128` still crashes, escalate before disabling `-fa on` |
| chat-model fails `alloc_tensor_range: failed to allocate CUDA0 buffer` after a `compose up -d` with embed-model already healthy | Load-order: chat needs the ~17.5 GB VRAM window, embed (4–5 GB) is hogging it | Verify `depends_on: chat-model healthy` is on embed-model service; if missing, patch compose and `down && up` | Never bump `-ngl` below 99 to make room — ask user |
| `npm ci` fails in frontend build with `ERESOLVE` on next-themes peer | `.npmrc` not copied into image | Check `frontend/Dockerfile` line for `COPY package*.json .npmrc ./` | If Dockerfile is correct but still fails, escalate |
| llama-server errors `invalid argument: --embd-normalize` | Upstream removed the flag (moved to per-request JSON) | Delete the two `--embd-normalize`/`2` lines from embed-model `command:` — default L2 normalize already matches previous behavior | — |
| Docker SSH context fails with `Host key verification failed` | Docker's plain SSH can't find the host key or the gcloud key | Add entry to `~/.ssh/config`: `Host <VM_IP>` / `User <SSH_USER>` / `IdentityFile ~/.ssh/google_compute_engine` / `StrictHostKeyChecking accept-new` | — |
| Frontend reachable over LAN but not from browser | GCP firewall default-deny inbound on tcp:3000 | `gcloud compute firewall-rules create ... --rules=tcp:3000,tcp:8000 --target-tags=http-server` (VM must have `http-server` tag) | — |

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

### 2026-04-19 — cold provision on nlp-school-488918 project
- VM: dreamrag-vm / us-west1-a / 34.145.76.145 (us-central1-a L4 stocked out; also `us-central1-b` hit transient internal error; `us-west1-a` succeeded on first attempt)
- Compose state: all four healthy after load-order + `-ub 128` fixes
- Probes:
  - [1–7] all pass (cold TTFT 179ms, warm 139ms — well under 2.5s budget)
  - agent-turn probe: pass — Qwen3.6-35B emitted valid `search_dreams(query="dark ocean water subconscious", namespace="dream_knowledge", top_k=5)` tool call; `active_widgets` streamed to client
- Observations: VRAM after stabilization ≈ 21.5/23 GB used; IQ4_XS fits with ordering fix but has <1 GB headroom
- Actions taken during bring-up (all now captured in runbook + cheatsheet):
  - Enabled Compute Engine API + requested `GPUS_ALL_REGIONS=1` (Education account defaulted to 0)
  - Image family `common-cu124-ubuntu-2204` no longer exists → used `common-cu129-ubuntu-2204-nvidia-580`
  - Installed Docker on VM (DLVM ships only with `nvidia-ctk`, not docker)
  - Added VM to `~/.ssh/config` with `IdentityFile ~/.ssh/google_compute_engine` so Docker's SSH context authenticates
  - Patched `frontend/Dockerfile` to COPY `.npmrc` (legacy-peer-deps) alongside `package*.json`
  - Deleted obsolete `--embd-normalize 2` from embed-model `command:` (upstream removal)
  - Dropped chat-model `-ub` from 512 → 128 (L4 FA shared-mem constraint)
  - Added `depends_on: chat-model healthy` to embed-model (load-order VRAM contention)
  - Added `ports: 8081/8082` on the two model services for in-VM smoke probing
  - Fixed `scripts/smoke_gcp.sh` backend probe: `curl -fsS` → `-sS` so 422 is accepted
  - Fixed `scripts/ingest.py` health check to derive URL from `EMBED_BASE_URL` instead of hardcoded `localhost:8082` (moot unless re-ingesting, but correct now)
  - Opened GCP firewall rule `dreamrag-frontend-3000` for tcp:3000,8000 on tag `http-server`
- Outcome: demo-ready. Frontend reachable at http://34.145.76.145:3000
- Follow-ups: none for functionality. Optional: (a) remove `enable_thinking` deprecation by switching to `--reasoning off`; (b) monitor VRAM headroom — 1.5 GB is tight if context grows toward 32K.

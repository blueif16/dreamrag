# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A full-stack AI agent platform for dream analysis: CopilotKit frontend (Next.js 15 + React 19) talks to a LangGraph orchestrator (FastAPI) via AG-UI protocol. The LLM spawns UI widgets onto a canvas through tool calls. Widgets are either **smart** (have a subagent that takes over chat) or **dumb** (display-only, rendered on the client).

**RAG layer**: Supabase pgvector with two namespaces — `community_dreams` (~115K dream narratives from DreamBank, SDDb, Dryad) and `dream_knowledge` (Freud, Jung, Hall/Van de Castle coding manual). Embeddings via local Qwen3-Embedding-0.6B (llama.cpp). Retrieval tools live in `examples/dreams/tools.py` (`record_dream`, `search_dreams`, `get_symbol_graph`, `get_user_profile`).

**Target deployment**: GCP VM (L4 24GB) with all models served locally via llama.cpp — no external LLM API needed in production. All features (chat, widgets, RAG) remain identical to local dev.

## Data Ingest (one-time setup)

**Step 1 — Install llama.cpp and download the embedding model**
```bash
brew install llama.cpp
huggingface-cli download Qwen/Qwen3-Embedding-0.6B-GGUF Qwen3-Embedding-0.6B-Q8_0.gguf --local-dir ~/models
```

**Step 2 — Start the embedding server** (keep this terminal open)
```bash
llama-server --model ~/models/Qwen3-Embedding-0.6B-Q8_0.gguf \
  --port 8082 --pooling last --embd-normalize 2 --embedding -ngl 99
```

**Step 3 — Run the ingest script** (new terminal, from `frontend/backend/`)
```bash
cd backend
source .venv/bin/activate
uv sync
python scripts/ingest.py
```

Run only one namespace if needed:
```bash
python scripts/ingest.py --namespace community_dreams
python scripts/ingest.py --namespace dream_knowledge
```

---

## Data Ingest — Windows (llama.cpp on PowerShell) + WSL (ingest script)

**Step 1 — Install llama.cpp on Windows (PowerShell)**
```powershell
winget install Git.Git
winget install Python.Python.3
pip install huggingface_hub[cli]
huggingface-cli download Qwen/Qwen3-Embedding-0.6B-GGUF Qwen3-Embedding-0.6B-Q8_0.gguf --local-dir C:\models

# Download llama.cpp release binary (no build needed)
# Go to: https://github.com/ggerganov/llama.cpp/releases/latest
# Download: llama-<version>-bin-win-cuda-cu12.4-x64.zip (CUDA) or llama-<version>-bin-win-noavx-x64.zip (CPU)
# Extract to C:\llama.cpp\
```

**Step 2 — Start model servers on Windows (PowerShell)**

WSL2 shares localhost with Windows by default — use `localhost` from WSL, no IP tricks needed.

```powershell
# Embedding model — :8082 (run during ingest AND serving)
.\llama-server.exe `
  --model C:\models\Qwen3-Embedding-0.6B-Q8_0.gguf `
  --host 0.0.0.0 --port 8082 `
  --pooling last `
  --embedding -ngl 99

# Chat model — :8081 (run for the main app)
# Target model on L4 24GB: unsloth/Qwen3.6-35B-A3B-GGUF:UD-Q4_K_XL (MoE, 3B active)
.\llama-server.exe `
  --model C:\models\Qwen3.6-35B-A3B-UD-Q4_K_XL.gguf `
  --host 0.0.0.0 --port 8081 `
  --ctx-size 32768 `
  --n-gpu-layers 99 `
  --flash-attn `
  --cont-batching
```

Model downloads (run once in PS):
```powershell
huggingface-cli download Qwen/Qwen3-Embedding-0.6B-GGUF Qwen3-Embedding-0.6B-Q8_0.gguf --local-dir C:\models
huggingface-cli download unsloth/Qwen3.6-35B-A3B-GGUF UD-Q4_K_XL/* --local-dir C:\models
```

**Step 3 — Run ingest from WSL** (localhost works, no changes to script)
```bash
cd /path/to/dreamrag/frontend/backend
source .venv/bin/activate
uv sync
python scripts/ingest.py
```

---

Also run the SQL migrations in Supabase SQL editor before step 3:
- `supabase/migrations/001_rag_schema.sql`
- `supabase/migrations/002_user_dreams.sql`

---

## Commands

```bash
# Run both servers (kills existing processes on 3000/8000 first)
./startup.sh

# Run individually
npm run dev                                        # Frontend :3000
cd backend && source .venv/bin/activate && python server.py  # Backend :8000

# Build / lint / test
npm run build
npm run lint
npm run type-check                                 # tsc --noEmit
npm test                                           # jest
cd backend && pytest                               # pytest (asyncio_mode=auto)

# Backend venv setup (first time)
cd backend && uv venv --python 3.12 && source .venv/bin/activate && uv sync
```

## Package Versions -- NEVER CHANGE

Always use versions specified in `backend/pyproject.toml`. Never run `pip install` or change versions without explicit user approval.

- `copilotkit==0.1.75` -- v0.1.76+ broke import (`langchain.agents.middleware` removed)
- `ag-ui-langgraph>=0.0.26`
- Frontend ALWAYS uses `@copilotkitnext/react` and `@copilotkitnext/runtime` (the v2 API). NEVER import from `@copilotkit/react-core` or `@copilotkit/react-ui` in frontend code -- those are legacy v1 packages that happen to exist in node_modules but are not used.

## Architecture

### Request Flow

```
Browser → Next.js /api/copilotkit/[[...path]] → CopilotKit runtime → POST :8000/copilotkit
→ ag_ui_langgraph → LangGraphAGUIAgent → StateGraph(OrchestratorState)
```

### Graph Structure (backend/agent/graph.py)

- **Entry routing** (`route_entry`): if `focused_agent` is set, resume that subagent node; otherwise go to `orchestrator`.
- **Orchestrator node**: binds frontend tools + skeleton tools + spawn tools + example tools to LLM. Includes tool-call JSON repair for Qwen3 malformed args.
- **tools_node**: unified executor for all backend tool calls (spawn, clear_canvas, domain, example/MCP tools). Writes state patches (active_widgets, widget_state, focused_agent).
- **Subagent nodes**: created dynamically from registry. Each gets its own domain_tools + handoff_to_orchestrator.
- **Routing after tools** (`route_after_tools`): after spawn → subagent (if intro_message) or END; otherwise back to focused subagent or orchestrator.

### Widget System (Two Types)

**Smart widgets** (`agent: "subagent_id"` in config):
- Spawn tool routed to `tools_node` → writes `active_widgets`, `widget_state`, `focused_agent`
- Subagent takes over conversation, has domain tools
- State streamed live via `emit_intermediate_state`

**Dumb widgets** (`agent: null` in config):
- Tool routed to AG-UI → client `useFrontendTool` handler renders optimistically
- 1-turn delay: backend syncs via `_sync_dumb_widgets` on follow-up turn
- `expectedDumbIds` ref in page.tsx guards against stale intermediate snapshots

### Auto-Discovery (Plugin System)

Both frontend and backend auto-discover from `examples/`:
- **Frontend**: `examples/index.ts` re-exports; `src/lib/widgetEntries.ts` scans for WidgetConfig + Component pairs
- **Backend**: `examples/__init__.py` `load_all_backend_tools()` finds `examples/*/tools.py` with `all_tools` (standalone tools only — spawn tools come from SUBAGENTS)
- **Subagents**: `backend/agent/subagents/registry.py` finds `examples/*/__init__.py` with `SUBAGENTS` list

### Adding a New Example

1. Create `examples/my_example/` with widget dirs under `widgets/`
2. Each widget needs `widget.config.ts` (exports WidgetConfig) and a React component
3. Example `index.ts` re-exports all widget configs + components
4. Add `export * as myExample from "./my_example"` in `examples/index.ts`
5. For smart widgets: export `SUBAGENTS: SubagentConfig[]` from `examples/my_example/__init__.py`
6. For MCP/backend tools: export `all_tools` from `examples/my_example/tools.py`
7. Component name must be PascalCase of `config.id` with underscores removed (e.g. `red_flower` → `RedFlower`)

### Frontend Tool Registration

NEVER call `.runAgent()` directly on an agent instance. Always use `copilotkit.runAgent({ agent })` from `useCopilotKit()` -- direct calls bypass `buildFrontendTools()` and tools arrive as `[]` at the backend.

`WidgetToolRegistrar` components must be mounted at page root (unconditionally) so `useFrontendTool` effects fire before the first user message.

### Canvas Operations

All spawn tools accept `operation` param: `replace_all` (default, clears canvas), `add` (alongside existing), `replace_one` (remove same id then add). `clear_canvas` is only for removing without replacing.

## MCP Server: teaching-db

**Server:** `http://47.95.179.148:9999` (teaching-db v1.26.0)
**Client:** `examples/mcp_client.py` -- JSON-RPC over SSE, supports `list_tools` and `call` commands.

## Key State Fields (OrchestratorState)

- `active_widgets: List[{id, type, props}]` -- single source of truth for canvas
- `focused_agent: Optional[str]` -- which subagent owns chat (None = orchestrator)
- `widget_state: Dict` -- live mutable state for focused smart widget
- `pending_agent_message: Optional[str]` -- intro message injected on subagent's first turn

## Environment

- `LLM_PROVIDER`: `nebius` (default), `openai`, or `google`
- `NEBIUS_API_KEY`, `NEBIUS_MODEL` (default: `Qwen/Qwen3.5-397B-A17B-fast`)
- `OPENAI_API_KEY`, `OPENAI_MODEL` (default: `gpt-4o`)
- `GOOGLE_API_KEY`, `GOOGLE_MODEL`
- `SYSTEM_PROMPT`: override orchestrator system prompt
- Frontend env in `.env.local`, backend env in `backend/.env`

## GCP Deployment (Docker Compose via SSH context)

All services (llama.cpp embedding + llama.cpp chat + FastAPI backend + Next.js frontend) deploy from a single `docker-compose.yml` at the repo root. Models are bind-mounted from `~/models` on the VM — never baked into images.

Target VM: L4 24GB. Chat model: `unsloth/Qwen3.6-35B-A3B-GGUF:UD-IQ4_XS` (MoE — ~17.7GB at IQ4_XS, ~3B active params per token). IQ4_XS is chosen over UD-Q4_K_XL to leave ~5GB headroom for fp16 KV cache at 32K context + CUDA buffers. Do **not** quantise KV — `-ctk f16 -ctv f16` is required for tool-call argument fidelity in this agentic RAG workload.

### L4-specific constraints (do not change without retesting)

- **chat-model `-ub 128`** (not 512). L4 (sm_89) caps dynamic shared memory per block at ~100KB. Qwen3.6's `n_embd_head_k_all = 256` makes the FA-MMA kernel request more than that at `-ub 512`, crashing during warmup (`CUDA error: out of memory in ggml_cuda_flash_attn_ext_mma_f16_case`). `-ub 128` keeps the kernel under the shared-mem budget; no measurable perf loss on single-user serving.
- **Load order: chat-model must come up before embed-model.** Enforced by `depends_on: chat-model healthy` on embed-model. Chat needs ~17.5GB free VRAM to load; if embed (4–5GB) is already resident, chat runs out during model buffer alloc. Never reorder.
- **Do NOT turn off `-fa on` or quantise KV to work around L4 issues.** Both are correctness-critical for tool-call JSON fidelity. If you hit a real FA/KV problem, escalate — do not downgrade silently.

### One-time VM provisioning (from laptop)

```bash
# 0. Enable Compute Engine API if first time in project
gcloud services enable compute.googleapis.com --project=$PROJECT

# 1. GPU quota (Education / new projects start at 0). Must request BOTH:
#    - "GPUs (all regions)" global → at least 1
#    - "NVIDIA L4 GPUs" in your chosen region → at least 1
#    Submit via Console → IAM & Admin → Quotas. Approval is usually <10 min,
#    but Education accounts can take up to 2 business days.

# 2. Create VM. L4 stock varies by zone — if us-central1-a returns
#    ZONE_RESOURCE_POOL_EXHAUSTED, try us-west1-a, us-east4-c, us-east1-d in turn.
gcloud compute instances create dreamrag-vm \
  --project=$PROJECT \
  --zone=us-west1-a \
  --machine-type=g2-standard-8 \
  --accelerator=type=nvidia-l4,count=1 \
  --maintenance-policy=TERMINATE \
  --image-family=common-cu129-ubuntu-2204-nvidia-580 \
  --image-project=deeplearning-platform-release \
  --boot-disk-size=150GB \
  --boot-disk-type=pd-balanced \
  --metadata="install-nvidia-driver=True" \
  --tags=http-server,https-server
# Image family changes over time — verify with:
#   gcloud compute images list --project=deeplearning-platform-release --filter="family~cu12.*ubuntu"
# 150GB boot disk is required: ~18GB GGUFs + docker layers + OS; default 50GB overflows.

# 3. Firewall rule for demo access (frontend :3000, backend :8000)
gcloud compute firewall-rules create dreamrag-ports \
  --project=$PROJECT --direction=INGRESS --action=ALLOW \
  --rules=tcp:3000,tcp:8000 --source-ranges=0.0.0.0/0 --target-tags=http-server
```

### One-time VM setup (on the VM)

DLVM `common-cu129` ships with the NVIDIA driver + `nvidia-ctk` preinstalled, but NOT Docker. Run this once per new VM:

```bash
gcloud compute ssh dreamrag-vm --zone=$ZONE --command='
  curl -fsSL https://get.docker.com | sudo sh
  sudo nvidia-ctk runtime configure --runtime=docker
  sudo systemctl restart docker
  sudo usermod -aG docker $USER
  # verify GPU visible inside containers:
  sudo docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi -L
'
```

Models auto-download on first `docker compose up` via llama.cpp's `-hf` flag into the `hf-cache` named volume — no manual download step.

### Deploy from local machine

```bash
# One-time: add VM to ~/.ssh/config so Docker's SSH context uses the gcloud key
#   (Docker's SSH context uses plain ssh, not gcloud ssh)
cat >> ~/.ssh/config <<EOF

Host $GCP_VM_IP
    User $SSH_USER
    IdentityFile ~/.ssh/google_compute_engine
    StrictHostKeyChecking accept-new
EOF

# One-time: create SSH context pointing at GCP VM
docker context create gcp-dreamrag --docker host=ssh://$SSH_USER@$GCP_VM_IP

# Deploy (builds images on the VM using local source, starts all services)
docker --context gcp-dreamrag compose up -d --build
```

The backend reads `frontend/backend/.env` for Supabase creds and overrides `EMBED_BASE_URL` / LLM settings to point to the in-compose service hostnames (`chat-model`, `embed-model`).

### Live VM (current)

- **IP**: `35.231.190.210` — docker context `gcp-dreamrag` (ssh://tk@35.231.190.210)
- **Endpoints** (firewall rule `dreamrag-llm-ports` opens 8081/8082 to 0.0.0.0/0):
  - Frontend: `http://35.231.190.210:3000`
  - Backend: `http://35.231.190.210:8000`
  - Chat LLM: `http://35.231.190.210:8081/v1` (model alias `qwen3.6-35b-a3b`)
  - Embed: `http://35.231.190.210:8082/v1` (model alias `qwen3-embedding-0.6b`, dim 1024)
- **Local dev → remote LLM**: set in `backend/.env` → `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=http://35.231.190.210:8081/v1`, `OPENAI_API_KEY=not-needed`, `OPENAI_MODEL=qwen3.6-35b-a3b`, `EMBED_BASE_URL=http://35.231.190.210:8082/v1`, `EMBED_MODEL=qwen3-embedding-0.6b`.

### Useful commands (run while on gcp-dreamrag context)
```bash
docker compose logs -f backend        # tail backend logs
docker compose logs -f chat-model     # tail model server
docker compose restart backend        # hot-restart after code change
docker compose down                   # stop everything
```

### Verifying the deployment

**The user does not run tests — Claude owns the full smoke loop autonomously.** Follow [`docs/gcp-smoke-test.md`](docs/gcp-smoke-test.md) start to finish:
1. Collect VM_IP / SSH_USER / ZONE from the user once.
2. Run pre-flight → compose up → ingest → `scripts/smoke_gcp.sh` → agent-turn probe.
3. Interpret failures against the triage cheatsheet in §6 of that doc before escalating.
4. Append a dated entry to §8 "Test Log" on every run — this file is the source of truth for demo-readiness state.

Never bypass `fp16 KV`, `-fa on`, or the `-c 32768` budget to work around test failures — those are correctness-critical for the agent's tool-call fidelity.

---

## Bug Records & Architecture Decisions

Detailed write-ups of past bugs and design decisions live in `docs/`:
- [`docs/widget-design-system.md`](docs/widget-design-system.md) -- **widget catalog, design tokens, 3 composition flows (new dream / symbol query / temporal), page layout, file structure**
- [`docs/widget-protocol.md`](docs/widget-protocol.md) -- smart vs dumb widget lifecycle, canvas operations, 1-turn delay
- [`docs/bug-tool-registration-pipeline.md`](docs/bug-tool-registration-pipeline.md) -- tools arriving as `[]` at backend; full request flow trace
- [`docs/bug-canvas-clear.md`](docs/bug-canvas-clear.md) -- why clear_canvas is a backend tool, not frontend
- [`docs/thinking-token-rendering.md`](docs/thinking-token-rendering.md) -- inline `<think>` token parsing, what was avoided and why
- [`docs/3d_particle_morph_practices.md`](docs/3d_particle_morph_practices.md) -- 3D particle morph system: GLB pipeline, shader setup, blending/Bloom gotchas, scroll-driven morph architecture
- [`docs/3d_shape_morph.md`](docs/3d_shape_morph.md) -- full runbook for the particle morph landing page (step-by-step execution guide)

# DreamRAG — AI Dream Analysis with Dynamic Bento Dashboard

> CS 6120 NLP Final Project — Northeastern University, Khoury College
> **v2 — March 2026 — Fully Local Inference (Zero Cloud APIs)**

---

## 1. Vision

DreamRAG is a RAG system that turns dream journals into a living dashboard. Users type into a single chat input — the LLM retrieves from three knowledge layers (community dreams, academic literature, personal dream DB) and dynamically composes a full-page bento-grid of glassmorphic widget cards. The AI decides which widgets to render, their sizes, and their data. Every card carries **provenance links** back to the originating chunks.

This is not a static dashboard with a chat sidebar. The entire page IS the response.

---

## 2. Data Sources

### 2.1 Community Dream Corpus (~100K+ narratives)

| Source | Scale | Format | Access |
|--------|-------|--------|--------|
| **DreamBank** | ~27K reports | JSON | [DreamScrape GitHub](https://github.com/mattbierner/DreamScrape) |
| **DreamBank Annotated** | ~27K reports | HF dataset | [gustavecortal/DreamBank-annotated](https://huggingface.co/datasets/gustavecortal/DreamBank-annotated) — HVdC coded |
| **DReAMy-lib** | ~20K reports | HF dataset | [DReAMy-lib/DreamBank-dreams-en](https://huggingface.co/datasets/DReAMy-lib/DreamBank-dreams-en) |
| **SDDb** | ~45K reports + surveys | CSV | [Zenodo](https://doi.org/10.5281/zenodo.11662064) |
| **Reddit r/Dreams** | ~44K from 34K users | Scrape | Validated in EPJ Data Science 2025 — 217 topics / 22 themes |
| **Dryad Annotated** | ~20K reports | CSV | [Dryad](https://datadryad.org/dataset/doi:10.5061/dryad.qbzkh18fr) — HVdC NLP annotations |

### 2.2 Dream Analysis Knowledge Base (textbook layer)

| Source | Content |
|--------|---------|
| **Hall/Van de Castle Manual** | 10 categories of dream elements — [dreams.ucsc.edu/Coding](https://dreams.ucsc.edu/Coding/) |
| **Jungian Theory** | Jung's "Symbols and the Interpretation of Dreams" (public domain) |
| **Freudian Theory** | Freud's "The Interpretation of Dreams" (public domain) |
| **Domhoff Neurocognitive** | Continuity hypothesis, MIT Press |
| **NLP Dream Research** | "Our Dreams, Our Selves" (2020); Reddit dream content (2025) |

### 2.3 User's Personal Dreams (Supabase — structured + vector)

```sql
create table user_dreams (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id),
  recorded_at timestamptz default now(),
  raw_text text not null,
  emotion_tags text[] default '{}',
  symbol_tags text[] default '{}',
  character_tags text[] default '{}',
  interaction_type text,
  lucidity_score float,
  vividness_score float,
  hvdc_codes jsonb default '{}',
  embedding vector(1024),
  created_at timestamptz default now()
);
create index on user_dreams using hnsw (embedding vector_cosine_ops);
create index on user_dreams using gin (symbol_tags);
create index on user_dreams using gin (emotion_tags);
```

---

## 3. Technical Stack

### 3.1 Pinned Versions (Critical)

| Package | Version | Why |
|---------|---------|-----|
| `copilotkit` | `==0.1.75` | Released 2026-01-09. v0.1.76 shipped 2 min later with broken `langchain.agents.middleware` import. 0.1.75 is the correct pin. |
| `langgraph` | `1.0.10` | Pulled by copilotkit, satisfies `>=0.3.25,<1.1.0` |
| `ag-ui-langgraph` | `0.0.27` | AG-UI protocol bridge |
| `ag-ui-protocol` | `0.1.14` | Wire protocol |
| `fastapi` | `0.115.14` | Satisfies `>=0.115.0,<0.116.0` |
| `langchain` | `1.2.10` | Core orchestration |
| `langchain-core` | `1.2.20` | Base abstractions |

**What 0.1.75 gives us (everything needed):** `CopilotKitSDK`, `LangGraphAgent`, `LangGraphAGUIAgent`, `CopilotKitState` / `emit_intermediate_state`, `add_fastapi_endpoint`. The only thing 0.1.76+ added was `CopilotKitMiddleware` — broken, unused.

### 3.2 Infrastructure — GCP Compute Engine (Fully Self-Hosted)

**Zero cloud APIs. Every model runs on our own GPU. Nothing leaves the box.**

```
+----------------------------------------------------------------------+
|  GCP Compute Engine (g2-standard-8, NVIDIA L4 24GB)                  |
|                                                                      |
|  +-------------+  +-------------+  +------------------------------+  |
|  | Next.js 15  |  | FastAPI     |  | llama.cpp  (llama-server)    |  |
|  | +CopilotKit |  | +LangGraph  |  |                              |  |
|  | :3000       |  | :8123       |  |  :8081 -> qwen3.5-9b (chat)  |  |
|  +------+------+  +------+------+  |  :8082 -> qwen3-embed-0.6b   |  |
|         | AG-UI          |         |  :8083 -> qwen3.5-4b (tag)   |  |
|         +-------+--------+         +---------------+--------------+  |
|                 | Supabase SDK                      | OpenAI-compat  |
|                 v                                   | API            |
|  +--------------------------------------------------------------+    |
|  |  Supabase Postgres (hosted or self-hosted)                   |    |
|  |  documents (pgvector + BM25) | user_dreams                   |    |
|  |  doc_relations (graph)       | checkpoints                   |    |
|  +--------------------------------------------------------------+    |
+----------------------------------------------------------------------+
```

### 3.3 Models (All Local via llama.cpp)

| Role | Model | GGUF Quant | VRAM | Why |
|------|-------|-----------|------|-----|
| **Chat / Orchestration** | `qwen3.5-9b` | Q4_K_M (~5.5GB) | ~6GB | Latest Qwen family (Feb 2026). Hybrid architecture — Gated Delta Networks + sparse MoE. 262K native context. Outperforms GPT-OSS-120B on multiple benchmarks at 13x smaller. Handles classification, composition, synthesis. |
| **Embeddings** | `qwen3-embedding-0.6b` | Q8_0 (~0.7GB) | ~1GB (or CPU) | SOTA MTEB scores for its class. Instruction-aware. MRL support — flexible dims 32-1024, we use 1024. 32K context. Decoder-only with last-token (EOS) pooling. Runs on CPU during ingestion to keep GPU free for chat. |
| **Auto-tagging** | `qwen3.5-4b` | Q4_K_M (~2.5GB) | ~3GB | Lighter Qwen3.5 for batch HVdC annotation. Near-8B quality at half the size thanks to MoE architecture. JSON structured output. |
| **Fallback (complex synthesis)** | `qwen3.5-35b-A3B` | Q4_K_M (~20GB) | ~22GB | MoE — only 3B params active per token, so fast despite 35B total. Swap in for multi-source synthesis when 9B struggles. Requires unloading other models. |

**VRAM Budget (NVIDIA L4, 24GB):**

| Concurrent Config | Total VRAM | Headroom |
|-------------------|-----------|----------|
| chat (9B) + embed (0.6B on CPU) | ~6GB | 18GB free |
| chat (9B) + embed (0.6B) + tag (4B) | ~10GB | 14GB free |
| fallback only (35B-A3B) | ~22GB | 2GB free |

### 3.4 llama.cpp Server Configuration

All models served via `llama-server` (the llama.cpp HTTP server) exposing an OpenAI-compatible API. Direct GGUF loading, no abstraction layer overhead.

```bash
# Chat model — qwen3.5-9b
llama-server \
  --model /models/qwen3.5-9b-q4_k_m.gguf \
  --host 0.0.0.0 --port 8081 \
  --ctx-size 32768 \
  --n-gpu-layers 99 \
  --flash-attn \
  --threads 4 \
  --cont-batching \
  --metrics

# Embedding model — qwen3-embedding-0.6b (CPU for ingestion, GPU for serving)
llama-server \
  --model /models/qwen3-embedding-0.6b-q8_0.gguf \
  --host 0.0.0.0 --port 8082 \
  --ctx-size 8192 \
  --embedding \
  --pooling last \
  --embd-normalize 2 \
  --n-gpu-layers 0 \
  --threads 8 \
  --ubatch-size 512

# Auto-tagging model — qwen3.5-4b
llama-server \
  --model /models/qwen3.5-4b-q4_k_m.gguf \
  --host 0.0.0.0 --port 8083 \
  --ctx-size 16384 \
  --n-gpu-layers 99 \
  --flash-attn \
  --threads 4
```

**Key flags:**

- `--flash-attn` — flash attention for memory efficiency on L4
- `--cont-batching` — continuous batching for concurrent users on the chat model
- `--embedding --pooling last` — required for Qwen3-Embedding (decoder-only, uses last-token/EOS pooling, not CLS)
- `--embd-normalize 2` — L2 normalization (required for cosine similarity in pgvector)
- `--n-gpu-layers 0` on embed model — run on CPU to keep GPU free for chat; switch to `99` for serving if VRAM allows

**Qwen3-Embedding note:** These models use decoder-only architecture with last-token pooling. The `<|endoftext|>` token aggregates the full sequence meaning. Instruction-aware — prefix queries with task instructions for 1-5% improvement:

```
Instruct: Given a dream journal entry, retrieve similar dream narratives
Query: I was flying over a dark ocean and felt peaceful
```

### 3.5 LangChain Integration with llama.cpp

```python
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Chat — points at llama-server on :8081
llm = ChatOpenAI(
    base_url="http://localhost:8081/v1",
    api_key="not-needed",
    model="qwen3.5-9b",
    temperature=0.7,
)

# Embeddings — points at llama-server on :8082
embeddings = OpenAIEmbeddings(
    base_url="http://localhost:8082/v1",
    api_key="not-needed",
    model="qwen3-embedding-0.6b",
    dimensions=1024,  # MRL: can reduce to 768 or 512 if needed
)

# Auto-tagger — points at llama-server on :8083
tagger_llm = ChatOpenAI(
    base_url="http://localhost:8083/v1",
    api_key="not-needed",
    model="qwen3.5-4b",
    temperature=0,
)
```

### 3.6 Reference Scaffolds

| Scaffold | What We Use | Reference |
|----------|-------------|-----------|
| **Supabase RAG Scaffold** | `RAGStore`, `DataAdapter`, pgvector schema, `search_context_mesh` RRF+Graph SQL, namespace isolation, `doc_relations`, ingestion patterns | `SPECIFICATION.md` + `docs/v1_guide.md` |
| **CopilotKit + LangGraph Scaffold** | `CopilotKitSDK` + `LangGraphAGUIAgent`, `add_fastapi_endpoint`, `useCoAgent` state sync, AG-UI streaming | `README.md` in CopilotKit scaffold |

---

## 4. RAG Architecture (Supabase-Native)

All retrieval in a single Supabase Postgres via the RAG Scaffold's "Context Mesh": RRF (BM25 + pgvector) -> graph traversal via `doc_relations`.

### 4.1 Namespaces

| Namespace | Content |
|-----------|---------|
| `community_dreams` | 100K+ dream narratives from DreamBank, SDDb, Reddit, Dryad |
| `dream_knowledge` | Textbook/academic chunks — Jung, Freud, Domhoff, HVdC manual |
| `user_{uid}_dreams` | Personal entries (also in `user_dreams` table for SQL) |

### 4.2 What the Graph Layer Enables (Beyond Basic Vector Search)

The `doc_relations` table + recursive CTE graph walk is what separates this from a naive "embed and retrieve" system. Specific capabilities the graph unlocks for dream analysis:

**Multi-hop symbolic reasoning.** A user asks "what does water mean in my dreams?" -> vector search finds their water dreams -> graph edges (`symbolizes`, `associated_with`) walk from the water-dream chunks to Jungian "unconscious" concepts, to Freudian "birth/womb" interpretations, to HVdC coding norms for water elements -> all arrive in a single context window without separate queries.

**Cross-corpus triangulation.** Edges link a user's personal dream chunk to the most similar community dream (via `similar_to` edges built during ingestion), which is itself linked to an academic interpretation chunk. The synthesize node can now say "your dream mirrors a common pattern documented in DreamBank, which Jung would interpret as..." — with provenance for each hop.

**Temporal pattern discovery.** Edges of type `follows`, `recurs_with`, and `co_occurs` between a user's own dream entries let the graph surface patterns that vector similarity alone misses: "water appears in your dreams every time flying also appears, and this co-occurrence has increased over the last 3 months."

**Supernode pruning.** Generic symbols like "house" or "person" connect to thousands of nodes. The `properties->>'is_generic'` flag and the 0.8x score decay per hop prevent these from flooding the context with irrelevant neighbors. Only high-weight, specific edges survive the walk.

**Edge types used in DreamRAG:**

| Edge Type | Connects | Example |
|-----------|----------|---------|
| `symbolizes` | dream element -> academic concept | water_chunk -> unconscious_jungian |
| `similar_to` | dream -> dream (cross-corpus) | user_dream_42 -> dreambank_1337 |
| `co_occurs` | symbol -> symbol (within user's corpus) | water -> flying (weight: 0.73) |
| `follows` | dream -> dream (temporal) | user_dream_41 -> user_dream_42 |
| `interprets` | academic chunk -> academic chunk | jung_water -> freud_water |
| `contradicts` | academic chunk -> academic chunk | continuity_hypothesis -> activation_synthesis |
| `coded_as` | dream element -> HVdC category | aggressive_interaction -> A/H code |

### 4.3 Retrieval Flow (Self-Correcting LangGraph)

```
User query -> LangGraph Orchestrator:
  1. classify_query     -> symbol / temporal / similarity / new_entry
  2. plan_retrieval     -> which namespaces + which SQL queries
  3. retrieve_node      -> search_context_mesh() per namespace + SQL aggregations
  4. grade_node         -> LLM checks chunk relevance
  5. (if poor) rewrite  -> re-retrieve with refined query
  6. synthesize_node    -> widget layout + content + chunk-to-widget mapping
  7. emit_state         -> stream to frontend via AG-UI
```

### 4.4 Ingestion (via RAG Scaffold)

```python
from app.core import RAGStore, DataAdapter

rag = RAGStore(namespace="community_dreams")
chunks = DataAdapter.from_json_file("dreambank.json", content_field="content")
rag.ingest_batch(chunks, source="dreambank")

rag_kb = RAGStore(namespace="dream_knowledge")
chunks = DataAdapter.from_text_chunks(jung_text, chunk_size=1500, chunk_overlap=200)
rag_kb.ingest_batch(chunks, source="jung_symbols")

# Graph edges — this is where the scaffold's graph layer pays off
rag_kb.add_relation(water_id, unconscious_id, "symbolizes", properties={"weight": 0.9})
rag_kb.add_relation(water_id, birth_id, "symbolizes", properties={"weight": 0.7, "theory": "freudian"})
rag_kb.add_relation(jung_water_id, freud_water_id, "contradicts", properties={"weight": 0.6})
```

**Automated edge extraction during ingestion:**

```python
# After ingesting a user dream, auto-extract symbol co-occurrences
symbols = tagger_llm.invoke(f"Extract symbols from: {dream_text}")  # -> ["water", "flying", "dark"]
for pair in combinations(symbols, 2):
    existing = rag.get_relation(pair[0]_chunk_id, pair[1]_chunk_id, "co_occurs")
    if existing:
        new_weight = min(existing.weight + 0.1, 1.0)  # strengthen on repetition
        rag.update_relation(existing.id, properties={"weight": new_weight})
    else:
        rag.add_relation(pair[0]_chunk_id, pair[1]_chunk_id, "co_occurs", properties={"weight": 0.3})
```

### 4.5 Embedding Dimension Update

The schema uses **`vector(1024)`** to match `qwen3-embedding-0.6b`'s native max dimension. This model supports MRL (Matryoshka Representation Learning), so we can reduce to 768 or 512 at query time if latency matters — but 1024 is the default for maximum retrieval quality.

All previous references to `vector(768)` in the scaffold SQL must be updated to `vector(1024)`.

---

## 5. Chunk Provenance — Every Card Links to Sources

Hard requirement. Every widget card carries provenance metadata linking to the exact chunks that populated it.

### 5.1 Agent State (Backend)

```python
class DreamAgentState(TypedDict):
    question: str
    query_type: str  # symbol / temporal / similarity / new_entry
    chunk_registry: dict  # { chunk_id: { content, source, namespace, score, depth, source_type } }
    layout: dict
    widgets: list[dict]  # each has "source_chunks": ["chunk_12", "chunk_45"]
    retry_count: int
    messages: list
```

Every chunk returned by `search_context_mesh` is registered with a unique ID. The `source_type` field distinguishes `"seed"` (direct RRF hit) from graph-traversed results (edge type like `"symbolizes"`, `"co_occurs"`). When `synthesize_node` builds widgets, it tags each with the chunk IDs it consumed.

### 5.2 Frontend: Source Drawer (via CopilotKit `useCoAgent`)

```typescript
const { state } = useCoAgent<DreamAgentState>({
  name: "dream_agent",
  initialState: { widgets: [], chunk_registry: {} },
});
```

Every widget component receives this interface:

```typescript
interface WidgetProps {
  type: string;
  content: Record<string, any>;
  col_span: number;
  row_span: number;
  source_chunks: string[];              // chunk IDs for this card
  chunk_registry: Record<string, {      // full lookup table
    content: string;       // preview (~200 chars)
    full_content: string;  // complete chunk text
    source: string;        // "dreambank" | "jung_symbols" | "user_journal"
    namespace: string;
    score: number;
    depth: number;         // 0 = seed, 1+ = graph hop
    source_type: string;   // "seed" | "symbolizes" | "co_occurs" | etc.
    type: "seed" | "graph_traversed";
  }>;
}
```

Every card has a small **"N sources"** link at the bottom. Clicking it expands a drawer showing chunk previews, source DB name, graph hop distance, edge type, and relevance score. Non-negotiable — the user must always be able to trace any insight back to its origin.

---

## 6. Widget Catalog

| Widget | Source | Description | Size |
|--------|--------|-------------|------|
| **Interpretation Synthesis** | All 3 | Rich text, multi-source analysis. Inline source badges per paragraph. | 2col tall |
| **Dream Frequency Timeline** | Personal SQL | Area chart over time. Lucid markers as glowing dots. | 2col |
| **Emotion Radar** | Personal SQL | Spider chart, 6 axes. Ghost line for previous period. | 1col tall |
| **Symbol Co-occurrence Network** | Personal SQL + Graph | Force-directed bubble graph. Built from `co_occurs` edges in `doc_relations`. Central symbol + connected nodes with edge weights as line thickness. | Full width |
| **Community Mirror** | `community_dreams` | 3-4 anonymized snippets + emotion tags + similarity %. Populated via `similar_to` graph edges. | 1col |
| **Textbook Card** | `dream_knowledge` | Authoritative excerpt, serif type, source citation. Reached via `symbolizes` / `interprets` graph edges. | 1col |
| **Heatmap Calendar** | Personal SQL | GitHub-style grid, colored by dominant emotion. | 2col |
| **Stat Card** | Personal + baseline | Bold metric + population comparison from DreamBank norms. | Small |
| **Lucidity Gauge** | Personal SQL | Radial ring + trend arrow. | Small |
| **Vividness Score** | Personal SQL | Large number + sparkline. | Small |
| **Emotion Split** | Personal SQL | Two donuts: symbol-specific vs overall emotion distribution. | 1col |
| **Top Symbols Bar** | Personal SQL | Horizontal bars, top N symbols. | 1col |
| **Vertical Dream Timeline** | Personal SQL + Graph | Date nodes + excerpts + emotion dots. `follows` edges power the sequence. | 1col tall |
| **Monthly Insight** | All 3 | LLM-generated summary of patterns and shifts. | 1col |

### Composition Rules

**Symbol queries** -> Interpretation (hero) + Textbook + Community Mirror + stat + co-occurrence + emotion split. 4-6 cards.

**Temporal queries** -> Frequency Timeline + Radar + Heatmap + Top Symbols + Lucidity + Vividness + Insight. 6-8 cards.

**Similarity queries** -> Community Mirror (expanded) + population stat + Textbook. 3-4 cards.

**New entry** -> Interpretation + Textbook + Community Mirror + streak stat. 3-4 cards.

---

## 7. UI Design

**Theme:** Light only. Ethereal quiet luxury. Meditation app x Bloomberg.

**Background:** Pale lavender (#EEEAFF) -> warm cream (#FFF9F2), blurred aurora blobs.

**Cards:** Glassmorphism — 55-65% white opacity, `backdrop-filter: blur(16px)`, 20px radius, thin white border, soft shadow, 12px gaps.

**Type:** Playfair Display (headings) + Satoshi (body). Line-height 1.6.

**Palette:** Lavender, muted indigo (#5B6EAF), dusty rose (#C4899C), cream, gold (#D4A853). Gradients: indigo-to-violet.

**Chat:** Frosted pill, bottom-center, "Ask about your dreams...", indigo send button.

**Layout engine:** CopilotKit state delivers layout JSON from LangGraph -> frontend renders as CSS Grid with staggered card reveals.

---

## 8. Project Structure

```
dreamrag/
+-- docker-compose.yml
+-- supabase/
|   +-- migrations/
|       +-- 001_rag_schema.sql          # documents + doc_relations + search_context_mesh() [vector(1024)]
|       +-- 002_user_dreams.sql         # user_dreams table [vector(1024)]
|       +-- 003_checkpoints.sql         # LangGraph PostgresSaver
|       +-- 004_debug_functions.sql     # debug_bm25_search, debug_rrf_fusion, etc.
+-- models/                             # GGUF model files (downloaded at deploy time)
|   +-- qwen3.5-9b-q4_k_m.gguf
|   +-- qwen3-embedding-0.6b-q8_0.gguf
|   +-- qwen3.5-4b-q4_k_m.gguf
+-- backend/
|   +-- Dockerfile
|   +-- pyproject.toml                  # copilotkit==0.1.75, langgraph, fastapi
|   +-- app/
|       +-- main.py                     # FastAPI + add_fastapi_endpoint
|       +-- core/                       # from Supabase RAG Scaffold
|       |   +-- rag_store.py            # updated: uses local llama.cpp embeddings
|       |   +-- qwen_embeddings.py      # OpenAI-compat wrapper -> localhost:8082
|       |   +-- tool_factory.py
|       |   +-- adapters.py
|       +-- graph/                      # pattern from CopilotKit Scaffold
|       |   +-- state.py                # DreamAgentState (chunk_registry w/ graph depth)
|       |   +-- nodes.py                # classify, retrieve, grade, rewrite, synthesize
|       |   +-- edges.py
|       |   +-- workflow.py             # StateGraph + PostgresSaver
|       +-- ingestion/
|       |   +-- dreambank_loader.py
|       |   +-- sddb_loader.py
|       |   +-- reddit_loader.py
|       |   +-- textbook_loader.py
|       |   +-- auto_tagger.py          # qwen3.5-4b HVdC annotation via :8083
|       |   +-- edge_builder.py         # automated co_occurs / similar_to extraction
|       +-- widgets/
|           +-- catalog.py              # Widget types + composition rules
+-- frontend/
|   +-- package.json                    # next 15, react 19, copilotkit, recharts, d3
|   +-- src/
|       +-- app/
|       |   +-- api/copilotkit/         # Runtime endpoint proxy
|       |   +-- layout.tsx              # CopilotKit provider
|       |   +-- page.tsx                # Bento grid + chat input
|       +-- components/
|       |   +-- BentoGrid.tsx
|       |   +-- GlassCard.tsx           # Glassmorphic wrapper + SourceDrawer
|       |   +-- ChatInput.tsx
|       |   +-- SourceDrawer.tsx        # Chunk provenance panel (shows graph hops)
|       |   +-- widgets/               # 14 widget components
|       +-- hooks/
|           +-- useDreamAgent.ts        # useCoAgent<DreamAgentState>
+-- scripts/
    +-- ingest_all.py
    +-- build_graph_edges.py            # batch edge extraction after initial ingest
    +-- setup_llama_cpp.sh              # build llama.cpp from source, download GGUFs
    +-- deploy_gcp.sh
```

---

## 9. Deployment (GCP Compute Engine)

```bash
# Create VM with L4 GPU
gcloud compute instances create dreamrag-vm \
  --machine-type=g2-standard-8 --zone=us-central1-a \
  --boot-disk-size=200GB --accelerator=type=nvidia-l4,count=1

# SSH in, install CUDA drivers + build llama.cpp from source
sudo apt-get install -y build-essential cmake libcurl4-openssl-dev
git clone https://github.com/ggml-org/llama.cpp && cd llama.cpp
cmake -B build -DGGML_CUDA=ON -DLLAMA_CURL=ON
cmake --build build --config Release -j$(nproc)
sudo cp build/bin/llama-* /usr/local/bin/

# Download GGUF models (from Hugging Face)
mkdir -p /models
huggingface-cli download Qwen/Qwen3.5-9B-GGUF qwen3.5-9b-q4_k_m.gguf --local-dir /models
huggingface-cli download Qwen/Qwen3-Embedding-0.6B-GGUF qwen3-embedding-0.6b-q8_0.gguf --local-dir /models
huggingface-cli download Qwen/Qwen3.5-4B-GGUF qwen3.5-4b-q4_k_m.gguf --local-dir /models

# Start llama-server instances (use systemd in production — see 9.1)
# See Section 3.4 for exact flags

# Clone repo -> docker-compose up -> python scripts/ingest_all.py -> python scripts/build_graph_edges.py
```

### 9.1 systemd Service Example

```ini
[Unit]
Description=llama.cpp Chat Server (qwen3.5-9b)
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/llama-server \
  --model /models/qwen3.5-9b-q4_k_m.gguf \
  --host 0.0.0.0 --port 8081 \
  --ctx-size 32768 --n-gpu-layers 99 \
  --flash-attn --cont-batching --threads 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 10. Evaluation

**Retrieval:** Precision@5 / Recall@5 against curated DreamBank similar-dream pairs. Compare RRF-only vs RRF+Graph to quantify graph layer value.

**Graph impact:** Measure how many synthesis widgets include graph-traversed chunks (depth > 0) vs seed-only. Target: >=40% of Interpretation Synthesis content comes from graph hops.

**Interpretation:** Likert scale vs HVdC expert annotations on Dryad set.

**Provenance:** Sample 50 cards — verify linked chunks actually support rendered content. Check that graph hop metadata (edge type, depth) is accurate.

**Composition:** A/B static dashboard vs dynamic LLM-composed layout.

**E2E:** 10-15 users journal for 2 weeks, survey on insight quality + provenance usefulness.

**Inference latency:** Benchmark llama.cpp throughput on L4 — target <2s first token for chat, <50ms per embedding.

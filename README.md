# DreamRAG — AI Dream Analysis with Dynamic Bento Dashboard

> CS 6120 NLP Final Project — Northeastern University, Khoury College
> **v2 — March 2026 — Fully Local Inference (Zero Cloud APIs)**

---

## Product Update — 2026-03-25

This snapshot reflects the current single-page frontend shell in `index.html`, with `preview.html` forwarding into that entry.

The current UI is still a static prototype with shared styling in `theme.css`, but it now behaves as one web surface with hash-based view switching: `#home`, `#dashboard`, `#archive`, and `#profile`. The older files `homepage.html`, `dashboard.html`, `archive.html`, and `profile.html` are kept as reference fragments, not as the primary runtime entry. The product behavior described below captures the intended runtime architecture and backend responsibilities implied by those screens.

### Frontend Architecture

| Surface | Role | Current Prototype Surface | Intended Runtime Responsibility |
|---------|------|---------------------------|---------------------------------|
| `preview.html` | Entry route | Immediate redirect into the product | Bootstraps the app / hosted preview route |
| `index.html` | Single-page shell | Owns the shared topbar, view switching, and unified app chrome | Becomes the main web app container |
| `index.html#home` | Dream capture | Collect a new dream and start analysis | Create a dream record and launch analysis |
| `index.html#dashboard` | Latest reading | Show the active dream, interpretation, follow-up chat, metrics, and sources | Read the latest dream, stream or fetch analysis, and continue contextual chat |
| `index.html#archive` | Historical workspace | Browse saved dreams, inspect one dream, and continue archive-specific follow-up | Search, filter, compare, and reopen prior dream analyses |
| `index.html#profile` | Long-term patterns | Summarize motifs, emotional climate, rhythm, and recurring threads | Serve user-level aggregates and recurring pattern insights |
| `homepage.html`, `dashboard.html`, `archive.html`, `profile.html` | Reference fragments | Legacy standalone snapshots of each view | Editing reference only; no longer primary entrypoints |

Shared frontend conventions in the prototype:

- A persistent top navigation connects capture, latest reading, archive, and profile.
- The same dream can be revisited through multiple surfaces: current reading, archive detail, and profile-level pattern summaries.
- Source cards, follow-up prompts, and CTA buttons imply backend retrieval, provenance, and asynchronous analysis workflows even though they are not wired yet.

### User Experience Flow

1. The user lands on `preview.html`, which forwards into `index.html#home`.
2. On the `#home` view, the user writes a dream entry and starts analysis.
3. The app creates a dream record, launches retrieval + interpretation, and switches into `index.html#dashboard` as the primary reading surface.
4. On the `#dashboard` view, the user reads the interpretation, sees emotional and symbolic summaries, checks provenance links, and asks follow-up questions grounded in the same dream.
5. The user switches to `index.html#archive` to revisit prior dreams, compare entries across time, and continue conversations from a saved dream context.
6. The user switches to `index.html#profile` to zoom out from single dreams into recurring motifs, emotional trends, cadence, and long-term reflection.
7. The loop repeats from the persistent top navigation when the user records another dream; the latest reading, archive, and profile aggregates all update over time.

### Backend Functions Implied by the Prototype

| Surface | Backend capabilities required |
|---------|-------------------------------|
| `preview.html` | Static hosting or route redirect only; analytics optional |
| `index.html#home` | User/session resolution, create dream record, persist raw dream text, enqueue analysis job, return job status, expose latest reading pointer |
| `index.html#dashboard` | Fetch latest dream + structured interpretation, emotion extraction, symbol extraction, recurrence metrics, atmosphere/relationship graph data, follow-up chat with dream context, related-dream retrieval, citation/provenance lookup |
| `index.html#archive` | List user dreams, pagination, filtering, full-text/tag search, fetch single dream detail, compare selected dream to past entries, archive-scoped follow-up chat, citation retrieval for saved readings |
| `index.html#profile` | Compute and serve user-level aggregates such as streaks, top symbols, emotional distribution, recurrence rhythm, lucidity trend, dream frequency heatmap, and recurring theme summaries |

Shared backend services implied across all pages:

- Authentication and ownership for per-user dream data.
- Dream storage for raw entries, timestamps, tags, and archive state.
- Analysis storage for interpretations, extracted motifs, emotional labels, recurrence signals, and provenance links.
- Retrieval over personal dreams, community dream corpora, and academic interpretation sources.
- Chat memory scoped to a dream and optionally to a saved archive thread.
- Async job orchestration for analysis pipelines that may not complete synchronously.
- User-level aggregation jobs that periodically update profile insights from the dream corpus.

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
|  | :3000       |  | :8000       |  |  :8081 -> qwen3.6-35b-a3b    |  |
|  +------+------+  +------+------+  |  :8082 -> qwen3-embed-0.6b   |  |
|         | AG-UI          |         +---------------+--------------+  |
|         +-------+--------+                         | OpenAI-compat  |
|                 | Supabase SDK                     | API            |
|                 v                                                    |
|  +--------------------------------------------------------------+    |
|  |  Supabase Postgres (hosted)                                  |    |
|  |  documents (pgvector + BM25) | user_dreams                   |    |
|  |  doc_relations (graph)       | checkpoints                   |    |
|  +--------------------------------------------------------------+    |
+----------------------------------------------------------------------+
```

### 3.3 Models (All Local via llama.cpp)

Single chat model (MoE) + single embedding model, both containerised via llama.cpp's prebuilt CUDA image. Models are pulled from Hugging Face on first boot into a shared `hf-cache` volume, so there is no manual download step.

| Role | Model | GGUF Quant | VRAM | Why |
|------|-------|-----------|------|-----|
| **Chat / Orchestration** | `unsloth/Qwen3.6-35B-A3B-GGUF` | `UD-IQ4_XS` (~17.7 GB) | ~20 GB w/ 32K fp16 KV | MoE — 35B total, ~3B active per token. IQ4_XS matches Q4_K_M quality within noise, costs ~4.7 GB less than UD-Q4_K_XL, and leaves headroom for fp16 KV + CUDA context. fp16 KV (not q8_0) preserves long-context needle retrieval and tool-call argument fidelity — critical for agentic RAG. |
| **Embeddings** | `Qwen/Qwen3-Embedding-0.6B-GGUF` | `Q8_0` (~0.7 GB) | ~1 GB on GPU | SOTA MTEB for its class. Instruction-aware. MRL support — 1024 dims default, reducible to 768/512. Decoder-only with last-token (EOS) pooling. |

**VRAM Budget (NVIDIA L4, 24 GB):**

| Config | Chat weights | KV @ 32K fp16 | Embed | Slack | Fits |
|--------|--------------|---------------|-------|-------|------|
| chat IQ4_XS + embed Q8 (default) | 17.7 GB | ~3 GB | 1 GB | ~2 GB | yes |
| chat IQ4_XS + embed Q8 + `--parallel 2` | 17.7 GB | ~3 GB × 2 slots (share budget) | 1 GB | tight | maybe — drop `-c` to 24 K |
| chat only (no embed on GPU) | 17.7 GB | ~3 GB | — | ~3 GB | yes |

**Realistic throughput on L4** (~300 GB/s memory bandwidth, ~30 TFLOPS fp16 — **not** a 3090/4090):

- Decode: 30–50 tok/s (community 4090 numbers of ~120 tok/s do **not** port).
- Prefill: ~2–4 s for a 4K prompt. Mitigated by `--slot-save-path` + `--cache-reuse 256` so shared system prompts are reused across requests.

### 3.4 llama.cpp Server Configuration

Both models run via `llama-server` inside `ghcr.io/ggml-org/llama.cpp:server-cuda` with an OpenAI-compatible API. Exact flags live in `docker-compose.yml`; the equivalent bare-metal commands:

```bash
# Chat — qwen3.6-35b-a3b (primary)
llama-server \
  -hf unsloth/Qwen3.6-35B-A3B-GGUF:UD-IQ4_XS \
  --host 0.0.0.0 --port 8081 \
  --alias qwen3.6-35b-a3b \
  -ngl 99 -fa on \
  -c 32768 --parallel 1 \
  -ctk f16 -ctv f16 \
  -b 2048 -ub 512 \
  --slot-save-path /var/cache/llama/slots \
  --cache-reuse 256 \
  --temp 0.7 --top-p 0.8 --top-k 20 --min-p 0.0 \
  --chat-template-kwargs '{"enable_thinking":false}' \
  --metrics

# Embedding — qwen3-embedding-0.6b
llama-server \
  -hf Qwen/Qwen3-Embedding-0.6B-GGUF:Q8_0 \
  --host 0.0.0.0 --port 8082 \
  --alias qwen3-embedding-0.6b \
  --embedding --pooling last --embd-normalize 2 \
  -ngl 99 -ub 512
```

**Why these flags:**

- `-fa on` + `-ngl 99` — flash attention, full GPU offload.
- `-c 32768 --parallel 1` — 32K context, single slot. `-c` is **total** KV budget; raising `--parallel` splits it.
- `-ctk f16 -ctv f16` — fp16 KV. `q8_0` KV saves ~1.5 GB but measurably hurts long-context recall and tool-arg fidelity; only flip to q8 if you need ≥128K context.
- `-b 2048 -ub 512` — physical / micro batch sizes tuned for L4 prefill throughput.
- `--slot-save-path` + `--cache-reuse 256` — persist KV prefixes across requests. Huge win for the DreamRAG orchestrator, which re-sends the same system prompt every turn.
- `--chat-template-kwargs '{"enable_thinking":false}'` — Unsloth's recommended non-thinking setting for Qwen3.6 chat workloads. For coding/precise tasks, flip to thinking mode with `temp=0.6 top_p=0.95`.
- Embedding `--pooling last --embd-normalize 2` — required for Qwen3-Embedding (decoder-only EOS pooling) and for cosine similarity in pgvector.

**Tuning rules of thumb:**

- OOM? Drop `-c` before dropping quant. 32K → 16K saves ~1.5 GB.
- Gibberish at long context on certain drivers? Try `-ctk bf16 -ctv bf16`.
- Need huge (128K+) context? Flip `-ctk q8_0 -ctv q8_0` — quality hit is only on deep-recall.
- Do **not** use `--n-cpu-moe`. `g2-standard-8` has 32 GB RAM and PCIe 4.0 x16 — MoE expert offload only helps when you have 128+ GB RAM and want a bigger model.

**Qwen3-Embedding note:** These models use decoder-only architecture with last-token pooling. The `<|endoftext|>` token aggregates the full sequence meaning. Instruction-aware — prefix queries with task instructions for 1-5% improvement:

```
Instruct: Given a dream journal entry, retrieve similar dream narratives
Query: I was flying over a dark ocean and felt peaceful
```

### 3.5 LangChain Integration with llama.cpp

```python
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Chat — points at llama-server on :8081 (in-compose hostname: chat-model)
llm = ChatOpenAI(
    base_url="http://chat-model:8081/v1",  # or http://localhost:8081/v1 outside compose
    api_key="not-needed",
    model="qwen3.6-35b-a3b",
    temperature=0.7,
)

# Embeddings — points at llama-server on :8082 (in-compose hostname: embed-model)
embeddings = OpenAIEmbeddings(
    base_url="http://embed-model:8082/v1",
    api_key="not-needed",
    model="qwen3-embedding-0.6b",
    dimensions=1024,  # MRL: can reduce to 768 or 512 if needed
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
+-- models/                             # (optional) bind-mount target; default flow uses HF cache volume
|   +-- Qwen3.6-35B-A3B-GGUF/UD-IQ4_XS.gguf
|   +-- Qwen3-Embedding-0.6B-GGUF/Q8_0.gguf
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

## 9. Deployment (GCP Compute Engine — Docker Compose, Zero Source Builds)

Everything ships as containers. No building llama.cpp, no systemd units. The compose file at the repo root orchestrates `chat-model`, `embed-model`, `backend`, and `frontend`. Models are auto-downloaded from Hugging Face into a named volume (`hf-cache`) on first boot.

### 9.1 Provision the VM

```bash
# Create VM (L4 24GB, 200GB disk — enough for UD-IQ4_XS (~18GB) + embed (~0.7GB) + buffer)
gcloud compute instances create dreamrag-vm \
  --machine-type=g2-standard-8 --zone=us-central1-a \
  --boot-disk-size=200GB --boot-disk-type=pd-balanced \
  --accelerator=type=nvidia-l4,count=1 \
  --maintenance-policy=TERMINATE \
  --image-family=debian-12 --image-project=debian-cloud \
  --metadata=install-nvidia-driver=True \
  --tags=http-server,https-server

# Firewall for frontend (3000) and backend health checks (8000)
gcloud compute firewall-rules create dreamrag-web \
  --allow=tcp:3000,tcp:8000 --target-tags=http-server
```

### 9.2 One-time VM Bootstrap (SSH into the VM)

```bash
gcloud compute ssh dreamrag-vm --zone=us-central1-a

# Docker + NVIDIA Container Toolkit
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Sanity — must print a GPU row:
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```

### 9.3 Deploy the Stack (from your laptop)

```bash
# One-time — point local Docker at the VM over SSH
docker context create gcp-dreamrag --docker host=ssh://USER@GCP_VM_IP
docker context use gcp-dreamrag

# Bring everything up (first run: ~5–10 min to pull GGUFs into hf-cache volume)
docker compose up -d --build
docker compose logs -f chat-model   # wait for "server is listening on http://0.0.0.0:8081"

# Ingest (one-time, runs against the in-VM embed-model)
docker compose exec backend python scripts/ingest.py

# Smoke the chat endpoint
curl http://GCP_VM_IP:3000           # frontend
curl http://GCP_VM_IP:8000/healthz   # backend
```

See §10.1 (Automated Test Flow) for the end-to-end verification script.

---

## 10. Evaluation

**Retrieval:** Precision@5 / Recall@5 against curated DreamBank similar-dream pairs. Compare RRF-only vs RRF+Graph to quantify graph layer value.

**Graph impact:** Measure how many synthesis widgets include graph-traversed chunks (depth > 0) vs seed-only. Target: >=40% of Interpretation Synthesis content comes from graph hops.

**Interpretation:** Likert scale vs HVdC expert annotations on Dryad set.

**Provenance:** Sample 50 cards — verify linked chunks actually support rendered content. Check that graph hop metadata (edge type, depth) is accurate.

**Composition:** A/B static dashboard vs dynamic LLM-composed layout.

**E2E:** 10-15 users journal for 2 weeks, survey on insight quality + provenance usefulness.

**Inference latency:** Benchmark llama.cpp throughput on L4 — target <2s first token for chat, <50ms per embedding.

---

### 10.1 Automated Test Flow (Demo-Day Smoke)

Run this from your laptop after `docker compose up -d` on the VM. No human judgment required — every step exits non-zero on failure. Save as `scripts/smoke_gcp.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
VM="${1:?usage: smoke_gcp.sh <GCP_VM_IP>}"

echo "[1/6] chat-model /health"
curl -fsS "http://$VM:8081/health" | grep -q '"status":"ok"'

echo "[2/6] embed-model /health"
curl -fsS "http://$VM:8082/health" | grep -q '"status":"ok"'

echo "[3/6] chat completion (tool-arg fidelity)"
curl -fsS "http://$VM:8081/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3.6-35b-a3b","messages":[{"role":"user","content":"Reply with exactly the JSON: {\"ok\":true}"}],"temperature":0,"max_tokens":32}' \
  | python3 -c 'import sys,json; r=json.load(sys.stdin); c=r["choices"][0]["message"]["content"]; assert "\"ok\":true" in c.replace(" ",""), c; print("ok:", c)'

echo "[4/6] embedding shape = 1024"
curl -fsS "http://$VM:8082/v1/embeddings" \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3-embedding-0.6b","input":"a dream of flying over water"}' \
  | python3 -c 'import sys,json; v=json.load(sys.stdin)["data"][0]["embedding"]; assert len(v)==1024, len(v); print("dim:", len(v))'

echo "[5/6] backend /copilotkit reachable"
curl -fsS -o /dev/null -w '%{http_code}\n' "http://$VM:8000/copilotkit" | grep -qE '^(200|405)$'

echo "[6/6] end-to-end agent turn (records a dream, expects widget spawn)"
python3 scripts/smoke_agent.py --host "$VM"
echo "ALL GREEN"
```

`scripts/smoke_agent.py` posts one turn through the CopilotKit runtime and asserts that the AG-UI stream contains at least one `TOOL_CALL_START` for a spawn tool and one `STATE_DELTA` setting `active_widgets`. That single call exercises: frontend→backend routing, LangGraph orchestrator, tool binding, llama.cpp tool-call generation, `search_dreams` pgvector hop, `record_dream` Supabase write, and widget state streaming. If it passes, demo-day works.

**Latency budget check (fail demo if exceeded):**

```bash
docker compose exec backend python - <<'PY'
import time, httpx
t=time.time(); r=httpx.post("http://chat-model:8081/v1/chat/completions",
  json={"model":"qwen3.6-35b-a3b","messages":[{"role":"user","content":"hi"}],"max_tokens":1},timeout=60)
print(f"TTFT ~{(time.time()-t)*1000:.0f}ms"); assert r.status_code==200
PY
```

Expect 1.5–3 s cold (first request triggers prefill + CUDA graph warmup), 300–800 ms warm. If cold >8 s or warm >1.5 s, something is offloading to CPU — check `nvidia-smi` and `docker compose logs chat-model | grep offloaded`.

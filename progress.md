# DreamRAG — Progress Log

> CS 6120 NLP Final Project — Northeastern University, Khoury College

---

## Final Goal

Build a **RAG-powered dream analysis dashboard** where:
1. Users type a dream into a chat input
2. A LangGraph orchestrator (backed by local Qwen models on GCP L4 GPU) retrieves from 3 knowledge layers (community dreams, academic literature, personal dream DB) via Supabase pgvector + graph traversal
3. The LLM dynamically **composes a bento dashboard** of glassmorphic widget cards — choosing which widgets to show, their layout, and their data
4. Every card carries **provenance links** back to the originating chunks (source drawer with graph hop distance, edge type, relevance score)
5. The entire page IS the response — not a static dashboard with a chat sidebar

The system runs **fully locally** (zero cloud APIs) on a GCP Compute Engine g2-standard-8 with NVIDIA L4 24GB, using llama.cpp to serve Qwen3.5-9b (chat), Qwen3-Embedding-0.6b (embeddings), and Qwen3.5-4b (auto-tagging).

---

## What's Been Done

### Phase 1: Static HTML Prototype (pre-existing)
- `index.html` — Single-page shell with hash-based view switching (#home, #dashboard, #archive, #profile)
- `theme.css` — Full glassmorphic design system (Playfair Display + DM Sans, lavender/indigo/rose/gold palette, blur effects)
- `dashboard.html`, `archive.html`, `profile.html`, `homepage.html` — Reference fragments for each view
- `README.md` — Complete spec: data sources, tech stack, RAG architecture, widget catalog, deployment plan

### Phase 2: CopilotKit Widget Platform (2026-03-27)
**Bootstrapped `frontend/` from [copilot-scaffold](https://github.com/blueif16/copilot-scaffold.git)**

Copied the scaffold's core machinery into `dreamrag/frontend/`:
- Next.js 15 + React 19 + CopilotKit 1.54.0 + AG-UI protocol
- LangGraph orchestrator backend (FastAPI + copilotkit + ag-ui-langgraph)
- Widget auto-discovery system (`widgetEntries.ts` matches configs to components)
- `WidgetToolRegistrar` — registers each widget as a frontend tool via `useFrontendTool`
- `WidgetPanel` — renders spawned widgets in a CSS grid

**Created 18 dumb widgets** (all `agent: null`, `parameters: {}`, hardcoded demo data):

| # | Widget | Tool Name | Layout | Source |
|---|--------|-----------|--------|--------|
| 1 | InterpretationSynthesis | `show_interpretation_synthesis` | half, tall | scaffold |
| 2 | TextbookCard | `show_textbook_card` | third, medium | scaffold |
| 3 | CommunityMirror | `show_community_mirror` | third, medium | scaffold |
| 4 | StatCard | `show_stat_card` | third, compact | scaffold |
| 5 | SymbolCooccurrenceNetwork | `show_symbol_cooccurrence_network` | full, tall | scaffold |
| 6 | EmotionSplit | `show_emotion_split` | third, medium | scaffold |
| 7 | CurrentDream | `show_current_dream` | half, tall | new |
| 8 | EmotionRadar | `show_emotion_radar` | third, medium | new |
| 9 | RecurrenceCard | `show_recurrence_card` | third, medium | new |
| 10 | DreamAtmosphere | `show_dream_atmosphere` | half, tall | new |
| 11 | FollowupChat | `show_followup_chat` | third, tall | new |
| 12 | EchoesCard | `show_echoes_card` | third, compact | new |
| 13 | SourcesPanel | `show_sources_panel` | third, medium | new |
| 14 | HeatmapCalendar | `show_heatmap_calendar` | half, compact | new |
| 15 | EmotionalClimate | `show_emotional_climate` | half, medium | new |
| 16 | LucidityGauge | `show_lucidity_gauge` | third, compact | new |
| 17 | DreamStreak | `show_dream_streak` | third, compact | new |
| 18 | TopSymbol | `show_top_symbol` | third, compact | new |

**Customizations applied:**
- 3-column bento grid (was 2-column in scaffold)
- Lavender-to-cream gradient background on the dashboard and chat views
- DreamRAG system prompt with composition rules (which widgets to spawn for symbol/temporal/new-entry/dashboard queries)
- Stripped `symbol` parameter from all widgets — LLM calls `show_X()` with no args
- Removed WidgetShell wrapper (widgets have their own glassmorphic styling)
- Loaded Playfair Display + DM Sans fonts in root layout
- Stripped non-dream examples (flower_garden, science_lab, textbook_content)

---

## What's Next

### Phase 3: Wire Up Real Data (Backend) — 2026-03-28

**Completed:**
- [x] Supabase migrations written: `001_rag_schema.sql` (documents + doc_relations + `search_context_mesh()` RRF+graph), `002_user_dreams.sql` (HNSW + GIN indexes, vector(1024))
- [x] `RAGStore` implemented (`frontend/backend/app/core/rag_store.py`) — ingest/ingest_batch/search/add_relation, dedup by content hash, namespace isolation
- [x] `QwenEmbeddings` wrapper (`app/core/qwen_embeddings.py`) — llama.cpp OpenAI-compat at `:8082`, instruction prefix, L2 norm
- [x] `DataAdapter` + `StreamingAdapter` (`app/core/adapters.py`) — JSON/CSV/JSONL/text chunk parsers
- [x] Supabase `.env` configured (URL + service role key)
- [x] Ingest script (`frontend/backend/scripts/ingest.py`) — one command, auto-downloads all sources:
  - `community_dreams`: DreamBank/DReAMy-lib (22K) + DreamBank Annotated (28K) + SDDb (44K) + Dryad (20K) = ~115K dreams
  - `dream_knowledge`: Freud IoD + Jung PotU (Gutenberg) + HVdC manual (scraped from dreams.ucsc.edu)
- [x] Runtime tools: `record_dream` + `search_dreams` auto-discovered by LangGraph orchestrator

**Still needed before Phase 3 is fully live:**
- [ ] Run SQL migrations in Supabase SQL editor (001, 002, 003)
- [ ] Set up llama.cpp embedding server locally (`Qwen3-Embedding-0.6B-Q8_0.gguf` on `:8082`)
- [ ] Run `python scripts/ingest.py` to populate the DB
- [ ] Run `python scripts/ingest.py --backfill-metadata` to patch metadata on already-ingested 22K records (no re-embed)
- [ ] Run `python scripts/build_corpus_stats.py` to populate `corpus_stats` from annotated metadata
- [ ] Build `doc_relations` graph edges (symbolizes, similar_to, co_occurs, follows)

### Phase 3.5: Widget ↔ RAG Grounding — 2026-03-28

**Completed:**
- [x] Widget data architecture designed: 18 widgets split into agent-populated vs self-contained
  - **Agent-populated** (LLM synthesizes from retrieved chunks, passes props + source_chunk_ids):
    CurrentDream, DreamAtmosphere, FollowupChat, EchoesCard, InterpretationSynthesis, TextbookCard, CommunityMirror
  - **Self-contained** (widget fetches user SQL stats itself, agent calls with no params):
    EmotionalClimate, RecurrenceCard
- [x] All agent-populated widget configs updated with `source_chunk_ids` parameter — agent must pass chunk IDs that backed each widget's content
- [x] Orchestrator prompt rewritten with explicit retrieval protocol:
  - NEW DREAM: `record_dream` + 3× `search_dreams` (dream_knowledge, community_dreams, user_*_dreams) BEFORE any widget spawn
  - SYMBOL query: `search_dreams`×2 + `get_symbol_graph` BEFORE spawning
  - Each widget content field mapped to the specific namespace that backs it (e.g. `meaning` ← dream_knowledge, `life_echo` ← community_dreams)
- [x] `EmotionalClimate` + `RecurrenceCard` converted to self-contained: fetch `/api/user-profile` on mount, show loading state + graceful empty fallback
- [x] `/api/user-profile` Next.js route — aggregates emotion_tags, symbol_tags, streak, last7, lucidity_avg from `user_dreams`
- [x] New tool: `get_symbol_graph` — queries `doc_relations` co_occurs edges for DreamAtmosphere satellites; gracefully returns empty until graph is built
- [x] Ingest pipeline upgraded:
  - DreamBank Annotated: stores `emotion_tags` + `character_tags` in metadata JSONB
  - Dryad: stores all HVdC numeric scores as `hvdc_*` keys in metadata JSONB
  - `--backfill-metadata` flag: patches already-ingested records without re-embedding
- [x] `003_corpus_stats.sql` migration: `corpus_stats` table + `get_corpus_stat()` function
- [x] `scripts/build_corpus_stats.py`: aggregates emotion/symbol/HVdC frequencies from `documents.metadata` → upserts into `corpus_stats` for StatCard population baselines
- [x] SourcesPanel removed from composition rules — replaced by per-widget `source_chunk_ids` prop

**Decision log:**
- Self-contained widgets fetch own data so agent doesn't need to query user SQL — keeps agent tool calls to ≤4 per dashboard
- `source_chunk_ids` on each widget (not a separate SourcesPanel) — provenance is per-card, traceable to exact retrieval results
- Metadata backfill instead of re-ingest — 22K already-ingested dreams get emotion/HVdC metadata via content_hash UPDATE, no re-embedding

### Phase 4: Make Widgets Smart
- [ ] Implement SourceDrawer: "N sources" disclosure on each card → shows chunk content, source DB, score, graph hop depth
- [ ] Wire FollowupChat as a smart subagent widget with dream-scoped conversation
- [ ] Auto-tagger pipeline (qwen3.5-4b on :8083) — annotates `emotion_tags`, `symbol_tags`, `lucidity_score` on `record_dream`

### Phase 5: Local Inference (GCP Deployment)
- [ ] Set up llama.cpp servers on GCP L4: qwen3.5-9b (:8081), qwen3-embed (:8082), qwen3.5-4b (:8083)
- [ ] Point LangChain ChatOpenAI/OpenAIEmbeddings at localhost llama-server
- [ ] Auto-tagger pipeline (qwen3.5-4b for HVdC annotation)
- [ ] systemd services for all model servers

### Phase 6: Evaluation
- [ ] Retrieval: Precision@5 / Recall@5 on curated DreamBank pairs
- [ ] Graph impact: % of synthesis content from graph hops (target >= 40%)
- [ ] Provenance accuracy: sample 50 cards, verify chunk links
- [ ] E2E user study: 10-15 users, 2-week journal, survey

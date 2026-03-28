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

### Phase 3: Wire Up Real Data (Backend)
- [ ] Set up Supabase (pgvector + BM25) with `001_rag_schema.sql`, `002_user_dreams.sql`
- [ ] Implement `RAGStore` + `search_context_mesh()` for hybrid retrieval
- [ ] Build ingestion pipeline: DreamBank, SDDb, Reddit, textbook chunks
- [ ] Build `doc_relations` graph edges (symbolizes, similar_to, co_occurs, follows)
- [ ] Connect widgets to real data via LangGraph state (replace hardcoded demo data)

### Phase 4: Make Widgets Smart
- [ ] Convert widgets from dumb (hardcoded) to data-driven (receive props from LLM)
- [ ] Add `source_chunks` and `chunk_registry` to widget props for provenance
- [ ] Implement SourceDrawer component (click "N sources" to see chunk details)
- [ ] Wire follow-up chat as a smart widget with dream-scoped conversation

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

# cloud_e2e — end-to-end pipeline test against the cloud VM

One test that drives the shipped retriever → spawner graph against the real
Qwen3.6-35B-A3B model running on the GCP L4 VM. No mocks for the LLM, no mocks
for `search_dreams` / `record_dream`. If either the LLM endpoint or Supabase
is unreachable, the test fails loudly and does not stub.

## What it verifies

A realistic dream narrative is sent through the graph. The test asserts:

1. Retriever ran and issued ≥1 `search_dreams` call.
2. Retriever called `dispatch_to_spawner` (did not loop forever).
3. Spawner ran.
4. Spawner's input contained ONLY `SystemMessage` + `HumanMessage` — no
   `ToolMessage` or `AIMessage` leaked from the retriever era (context
   isolation).
5. Spawner emitted ≥1 real spawn tool call (`show_current_dream`, etc.).
6. `state.knowledge` has `dream_knowledge` and/or `community_dreams` populated.
7. `state.active_widgets` is non-empty (dumb-widget sync ran correctly).

## Run

```bash
# 1. Confirm the cloud VM is serving the model.
curl http://35.231.190.210:8081/v1/models   # should list qwen3.6-35b-a3b

# 2. Point the backend at the VM (already in backend/.env for this project).
export LLM_PROVIDER=openai
export OPENAI_BASE_URL=http://35.231.190.210:8081/v1
export OPENAI_API_KEY=not-needed
export OPENAI_MODEL=qwen3.6-35b-a3b

# 3. Run the test.
cd frontend/backend
source .venv/bin/activate
pytest tests/cloud_e2e/test_pipeline.py -v -s -m cloud_e2e
```

If you want to tunnel through SSH instead of hitting the VM directly:

```bash
gcloud compute ssh dreamrag-vm --zone=us-east4-c -- -NL 8081:localhost:8081
export OPENAI_BASE_URL=http://localhost:8081/v1
```

## Outputs

Every run drops one JSONL file at `runs/<ts>_<uuid>.jsonl` containing:

- `run_start` — run metadata.
- `llm_call` × N — one record per `_invoke_with_repair_and_retry` call:
  `{label, turn, wall_ms, input_messages, input_message_roles,
    output_tool_calls, output_content_preview}`. Use this to diagnose
  context leakage, parallel vs serial tool calls, and loop behaviour.
- `final_state` — knowledge namespace sizes, active_widgets, note.
- `cleanup` — count of rows removed from `user_dreams` (see below).
- `run_complete` — total wall time + turn count.

## Supabase hygiene

Each run prefixes its test dream with `[E2E_TEST_MARKER_<run_uuid>]` and, on
teardown, deletes every `user_dreams` row whose `raw_text` starts with that
marker. No rows from earlier runs are touched.

## Marker registration

The `cloud_e2e` marker is registered in `backend/pyproject.toml` so these
tests are skipped by default in normal CI — only `pytest -m cloud_e2e` picks
them up.

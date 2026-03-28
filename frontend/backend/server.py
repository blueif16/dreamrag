"""FastAPI server with AG-UI + LangGraph integration."""
import os
import sys
import logging
import warnings

# Add project root to path so examples can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Data-first: enable logging for message flow
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress Pydantic warnings from third-party libraries about unsupported Field attributes
warnings.filterwarnings("ignore", category=Warning, module="pydantic.*", message=".*UnsupportedFieldAttributeWarning.*")

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from copilotkit import LangGraphAGUIAgent
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from agent.graph import graph

app = FastAPI(title="Widget Platform Orchestrator", version="0.2.0")

# Log all requests to copilotkit endpoint
@app.middleware("http")
async def log_requests(request: Request, call_next):
    if "/copilotkit" in request.url.path:
        logger.info(f"Incoming request to {request.url.path}")
        body = await request.body()
        import json
        try:
            parsed = json.loads(body)
            tools = parsed.get("tools", [])
            logger.info(f"[server] RAW tools count: {len(tools)}")
            for t in tools:
                logger.info(f"[server] RAW tool: {t.get('name', '?')}")
            if not tools:
                logger.info(f"[server] Full body keys: {list(parsed.keys())}")
                logger.info(f"[server] Full body (first 1000): {json.dumps(parsed)[:1000]}")
        except Exception:
            logger.debug(f"Request body (raw): {body[:1000]}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_langgraph_fastapi_endpoint(
    app=app,
    agent=LangGraphAGUIAgent(
        name="orchestrator",
        description="Widget platform orchestrator agent",
        graph=graph,
    ),
    path="/copilotkit",
)


@app.post("/widget-state")
async def update_widget_state(request: Request):
    """Patch widget_state in the LangGraph checkpoint.

    Allows the frontend widget to persist human-initiated state changes
    directly into the graph checkpoint, without waiting for the next runAgent call.

    Body: { "thread_id": str, "patch": dict }
    """
    import json
    body = await request.json()
    thread_id = body.get("thread_id")
    patch = body.get("patch")
    if not thread_id or not isinstance(patch, dict):
        return {"error": "thread_id (str) and patch (dict) required"}, 400

    config = {"configurable": {"thread_id": thread_id}}
    try:
        state_snapshot = await graph.aget_state(config)
        current_ws = dict(state_snapshot.values.get("widget_state") or {})
        current_ws.update(patch)
        await graph.aupdate_state(config, {"widget_state": current_ws}, as_node="tools")
        logger.info(f"[WIDGET-STATE] thread={thread_id} patch={patch} → widget_state={current_ws}")
        return {"widget_state": current_ws}
    except Exception as e:
        logger.error(f"[WIDGET-STATE] failed: {e}")
        return {"error": str(e)}


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

#!/bin/bash

# startup.sh - Start both frontend and backend with logging
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOG_DIR="$PROJECT_ROOT/logs"

# Kill existing processes on ports 8000 and 3000
echo -e "${YELLOW}🔪 Checking for existing processes on ports...${NC}"
for port in 8000 3000; do
    PID=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo -e "${YELLOW}⚠️  Killing existing process on port $port (PID: $PID)${NC}"
        kill -9 $PID 2>/dev/null || true
        sleep 1
    fi
done

# Create logs directory
mkdir -p "$LOG_DIR"

# Timestamp for log files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FRONTEND_LOG="$LOG_DIR/frontend_$TIMESTAMP.log"
BACKEND_LOG="$LOG_DIR/backend_$TIMESTAMP.log"

echo -e "${BLUE}=== CopilotKit + LangGraph Startup ===${NC}"
echo -e "${BLUE}Project: $PROJECT_ROOT${NC}"
echo ""

# Check if .env files exist
if [ ! -f "$PROJECT_ROOT/.env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local not found, copying from .env.local.example${NC}"
    cp "$PROJECT_ROOT/.env.local.example" "$PROJECT_ROOT/.env.local"
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  backend/.env not found, copying from backend/.env.example${NC}"
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your API keys${NC}"
fi

# Check if node_modules exists
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Setup Python virtual environment if it doesn't exist (use .venv)
if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo -e "${YELLOW}🐍 Creating Python virtual environment...${NC}"
    cd "$BACKEND_DIR"
    uv venv --python 3.12
    source .venv/bin/activate
    uv sync
    cd "$PROJECT_ROOT"
else
    echo -e "${GREEN}✓ Python virtual environment exists${NC}"
fi

# Activate virtual environment
echo -e "${GREEN}✓ Activating Python virtual environment${NC}"
source "$BACKEND_DIR/.venv/bin/activate"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    kill $(jobs -p) 2>/dev/null || true
    wait
    echo -e "${GREEN}✓ All services stopped${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${BLUE}🚀 Starting backend server (port 8000)...${NC}"
cd "$BACKEND_DIR"
python server.py 2>&1 | while IFS= read -r line; do
    echo -e "${GREEN}[BACKEND]${NC} $line"
    echo "$line" >> "$BACKEND_LOG"
done &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Wait for backend to be ready
echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Backend failed to start${NC}"
        cleanup
    fi
    sleep 1
done

# Start frontend
echo -e "${BLUE}🚀 Starting frontend server (port 3000)...${NC}"
npm run dev 2>&1 | while IFS= read -r line; do
    echo -e "${BLUE}[FRONTEND]${NC} $line"
    echo "$line" >> "$FRONTEND_LOG"
done &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo -e "${YELLOW}⏳ Waiting for frontend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Frontend failed to start${NC}"
        cleanup
    fi
    sleep 1
done

echo ""
echo -e "${GREEN}✅ All services running!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Frontend:${NC} http://localhost:3000"
echo -e "${GREEN}Backend:${NC}  http://localhost:8000"
echo -e "${GREEN}Health:${NC}   http://localhost:8000/health"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Logs:${NC}"
echo -e "  Frontend: $FRONTEND_LOG"
echo -e "  Backend:  $BACKEND_LOG"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all background jobs
wait

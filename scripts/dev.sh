#!/usr/bin/env bash
set -euo pipefail

# Invana — Start development environment
# Starts engine (FastAPI) and studio (Vite) with hot reload

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill 0
  wait
}
trap cleanup EXIT INT TERM

echo "Starting Invana development environment..."
echo ""

# Start engine
echo "[engine] Starting FastAPI on http://localhost:8000"
cd "$ROOT_DIR/engine"
uv run uvicorn invana.main:app --reload --host 127.0.0.1 --port 8000 &

# Start studio
echo "[studio] Starting Vite on http://localhost:3000"
cd "$ROOT_DIR/studio"
pnpm dev --host 127.0.0.1 --port 3000 &

echo ""
echo "Engine:  http://localhost:8000"
echo "Studio:  http://localhost:3000"
echo "API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

wait

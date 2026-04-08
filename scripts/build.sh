#!/usr/bin/env bash
set -euo pipefail

# Invana — Build for distribution
# Builds studio assets into engine, then builds the Python wheel

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Building Invana ==="
echo ""

# Step 1: Build Studio
echo "[1/3] Building Studio..."
cd "$ROOT_DIR/studio"
pnpm install --frozen-lockfile
pnpm build
echo "  → Studio assets built to engine/src/invana/studio/static/"

# Step 2: Build Python wheel
echo "[2/3] Building Python package..."
cd "$ROOT_DIR/engine"
uv build
echo "  → Wheel built to engine/dist/"

# Step 3: Summary
echo "[3/3] Build complete!"
echo ""
ls -lh "$ROOT_DIR/engine/dist/"*.whl 2>/dev/null || echo "  No wheel found — check for errors above"

#!/usr/bin/env bash
set -euo pipefail

# Invana — Release helper
# Tags and pushes a release. Actual publishing is handled by CI.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

# Read version from pyproject.toml
VERSION=$(grep '^version' engine/pyproject.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')

if [ -z "$VERSION" ]; then
  echo "Error: Could not read version from engine/pyproject.toml"
  exit 1
fi

TAG="v${VERSION}"

echo "=== Invana Release ==="
echo "Version: $VERSION"
echo "Tag:     $TAG"
echo ""

# Check for uncommitted changes
if ! git diff --quiet HEAD; then
  echo "Error: Uncommitted changes detected. Commit or stash first."
  exit 1
fi

# Check tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: Tag $TAG already exists."
  exit 1
fi

read -p "Create and push tag $TAG? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  git tag -a "$TAG" -m "Release $VERSION"
  git push origin "$TAG"
  echo ""
  echo "Tag $TAG pushed. CI will handle:"
  echo "  - Publishing Python package to PyPI"
  echo "  - Building and pushing Docker images to Docker Hub"
  echo "  - Creating GitHub release"
else
  echo "Aborted."
fi

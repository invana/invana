.PHONY: help setup dev docs docs-build \
       engine-test engine-lint engine-format \
       studio-test studio-lint studio-format \
       test lint format \
       build release publish docker \
       clean

# ─── Default ────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Setup ──────────────────────────────────────────────────────
setup: ## Install all dependencies (engine + studio + docs)
	@[ -f engine/pyproject.toml ] && (cd engine && uv sync) || echo "  skip engine (no pyproject.toml)"
	@[ -f studio/package.json ]   && (cd studio && pnpm install) || echo "  skip studio (no package.json)"
	@[ -f docs/pyproject.toml ]   && (cd docs && uv sync) || echo "  skip docs (no pyproject.toml)"
	@command -v lefthook >/dev/null && lefthook install || echo "  skip lefthook (not installed)"
	@echo "\n✓ Setup complete"

# ─── Development ────────────────────────────────────────────────
dev: ## Start engine + studio dev servers
	@echo "Starting Invana development environment..."
	@(cd engine && uv run uvicorn invana.main:app --reload --host 127.0.0.1 --port 8200) & \
	 (cd studio && pnpm dev --host 127.0.0.1 --port 8300) & \
	 wait

docs: ## Serve docs locally (http://localhost:8000)
	NO_MKDOCS_2_WARNING=1 uv run --directory docs mkdocs serve

docs-build: ## Build docs static site
	NO_MKDOCS_2_WARNING=1 uv run --directory docs mkdocs build

# ─── Engine ─────────────────────────────────────────────────────
engine-test: ## Run engine tests
	cd engine && uv run pytest tests/ -x -q

engine-lint: ## Lint engine (ruff check)
	cd engine && uv run ruff check .

engine-format: ## Format engine (ruff format)
	cd engine && uv run ruff format .

# ─── Studio ─────────────────────────────────────────────────────
studio-test: ## Run studio tests
	cd studio && pnpm test run

studio-lint: ## Lint studio (biome check)
	cd studio && pnpm biome check .

studio-format: ## Format studio (biome format)
	cd studio && pnpm biome check --write .

# ─── All ────────────────────────────────────────────────────────
test: engine-test studio-test ## Run all tests

lint: engine-lint studio-lint ## Lint everything

format: engine-format studio-format ## Format everything

# ─── Build & Release ────────────────────────────────────────────
build: ## Build studio + engine wheel
	@echo "=== Building Invana ==="
	cd studio && pnpm install --frozen-lockfile && pnpm build
	cd engine && uv build
	@echo "✓ Build complete"
	@ls -lh engine/dist/*.whl 2>/dev/null || true

release: ## Tag and push a release (reads version from engine/pyproject.toml)
	@VERSION=$$(grep '^version' engine/pyproject.toml | head -1 | sed 's/.*"\(.*\)".*/\1/'); \
	TAG="v$$VERSION"; \
	echo "=== Release $$TAG ==="; \
	git diff --quiet HEAD || (echo "Error: uncommitted changes" && exit 1); \
	git rev-parse "$$TAG" >/dev/null 2>&1 && (echo "Error: tag $$TAG exists" && exit 1) || true; \
	read -p "Create and push tag $$TAG? (y/N) " REPLY; \
	if [ "$$REPLY" = "y" ] || [ "$$REPLY" = "Y" ]; then \
		git tag -a "$$TAG" -m "Release $$VERSION"; \
		git push origin "$$TAG"; \
		echo "✓ Tag $$TAG pushed"; \
	else echo "Aborted."; fi

publish: ## Publish wheel to PyPI
	cd engine && uv publish

# ─── Docker ─────────────────────────────────────────────────────
docker: ## Build engine + studio Docker images
	docker build --target engine -t invana/engine .
	docker build --target studio -t invana/studio .

docker-run: ## Run engine via Docker
	docker run -p 8200:8200 invana/engine

# ─── Cleanup ────────────────────────────────────────────────────
clean: ## Remove build artifacts and caches
	rm -rf engine/dist/ engine/build/
	rm -rf studio/dist/
	rm -rf docs/site/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true

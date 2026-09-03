# Dev image for `docker compose up` — hot-reload via bind mount +
# `invana start --reload`. Not used for production builds (see
# docs/internal/mvp/engine.md §7.1 "Docker" for the not-yet-built prod image).
#
# Build context is the repo root (see docker-compose.yml): engine/pyproject.toml
# path-depends on the sibling integrations/invana-* packages (editable), so both
# trees must be present in the image.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim

WORKDIR /app
COPY engine/ ./engine/
COPY integrations/ ./integrations/

WORKDIR /app/engine
RUN uv sync --dev --extra all

ENV PATH="/app/engine/.venv/bin:$PATH"

EXPOSE 8200

CMD ["uv", "run", "invana", "start", "--host", "0.0.0.0", "--port", "8200", "--reload"]

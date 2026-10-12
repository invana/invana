"""starlette-admin views for the plugin registry's three tables.

``plugin_states`` is which tool and MCP plugins an install Admin has enabled;
``envelope_outcomes`` is what a worker made of each envelope it ran;
``mcp_servers`` is each MCP server with its frozen tool list. None holds a
secret — an MCP token is the environment's — so every column is shown.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class PluginStateView(ModelView):
    """Whether a tool plugin is enabled — no row is disabled."""

    fields = ["name", "enabled", "changed_by_id", "changed_at"]
    search_fields = ["name"]


class EnvelopeOutcomeView(ModelView):
    """A worker's outcome for one envelope, keyed by its idempotency key."""

    fields = ["idempotency_key", "run_id", "outcome", "created_at"]
    search_fields = ["idempotency_key", "run_id"]


class McpServerView(ModelView):
    """An MCP server and the tool list frozen when it was added or last refreshed."""

    fields = ["name", "url", "revision", "tools", "skipped", "server", "frozen_at", "added_by_id"]
    search_fields = ["name", "url"]

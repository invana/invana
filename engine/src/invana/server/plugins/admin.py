"""starlette-admin views for the plugin registry's two tables.

``plugin_states`` is which tool plugins an install Admin has enabled;
``envelope_outcomes`` is what a worker made of each envelope it ran. Neither
holds a secret, so every column is shown.
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

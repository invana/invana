"""starlette-admin view for ``llm_providers`` (migration-plan §4.1).

The encrypted key column is excluded from ``fields`` so it is neither shown
nor editable.
"""

from __future__ import annotations

from starlette_admin import StringField
from starlette_admin.contrib.sqla import ModelView


class LLMProviderView(ModelView):
    label = "LLM providers"
    icon = "fa fa-sparkles"
    # ``api_key_encrypted`` deliberately excluded from `fields` — ciphertext
    # isn't useful in admin and we don't want it edited by hand.
    fields = [
        "id",
        "graph_id",
        "name",
        StringField("provider", label="Provider"),
        "base_url",
        "guardrails",
        "last_ping_at",
        "last_ping_ok",
        "last_ping_error",
        "created_at",
        "updated_at",
    ]
    search_fields = ["name", "base_url"]


class LLMModelView(ModelView):
    label = "LLM models"
    icon = "fa fa-cube"
    fields = [
        "id",
        "provider_id",
        "model_id",
        "display_name",
        "capabilities",
        "pricing",
        "status",
        "created_at",
        "updated_at",
    ]
    search_fields = ["model_id", "display_name"]

"""starlette-admin view for ``mcp_served`` — the switches of this Graph's MCP server.

Flipped from Connections, This Graph's server; listed here so somebody
debugging a Graph can see which agents and functions it serves.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class McpServedView(ModelView):
    label = "Served over MCP"
    icon = "fa fa-plug"
    fields = ["graph_id", "kind", "ref", "served", "changed_by_id", "changed_at"]
    search_fields = ["kind", "ref"]

"""Every SQLAlchemy query behind this Graph's MCP server (migration-plan §4.1)."""

from invana.apps.mcp_server.querysets.served import ServedQuerySet

__all__ = ["ServedQuerySet"]

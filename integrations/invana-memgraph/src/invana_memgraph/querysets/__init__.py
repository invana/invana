"""Memgraph's own querysets — only what its dialect says differently."""

from invana_memgraph.querysets.schema_reader import MemgraphSchemaReaderQuerySet

__all__ = ["MemgraphSchemaReaderQuerySet"]

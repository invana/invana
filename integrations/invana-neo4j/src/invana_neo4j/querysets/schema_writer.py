from typing import Literal

from invana.graph.connectors.cypher.querysets.schema_writer import OpenCypherSchemaWriterQuerySet


class Neo4jSchemaWriterQuerySet(OpenCypherSchemaWriterQuerySet):
    """Neo4j-specific schema writer with corrected fulltext index syntax for Neo4j 5."""

    async def create_index(
        self,
        label: str,
        properties: list[str],
        *,
        index_type: Literal["btree", "fulltext", "composite"] = "btree",
        name: str | None = None,
    ) -> None:
        idx_name = f"`{name}`" if name else f"`idx_{label}_{'_'.join(properties)}`"

        if index_type == "fulltext":
            props_str = ", ".join(f"n.`{p}`" for p in properties)
            query = f"CREATE FULLTEXT INDEX {idx_name} FOR (n:`{label}`) ON EACH [{props_str}]"
        else:
            prop_list = ", ".join(f"n.`{p}`" for p in properties)
            query = f"CREATE INDEX {idx_name} FOR (n:`{label}`) ON ({prop_list})"

        await self._connector.execute(query)

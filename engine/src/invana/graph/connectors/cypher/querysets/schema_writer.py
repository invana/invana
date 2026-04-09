"""OpenCypher schema-writing queryset implementation."""

from typing import Any, Literal

from invana.graph.connectors.base.querysets.schema_writer import BaseSchemaWriterQuerySet


class OpenCypherSchemaWriterQuerySet(BaseSchemaWriterQuerySet):
    """OpenCypher implementation of schema-writing operations."""

    async def create_index(
        self,
        label: str,
        properties: list[str],
        *,
        index_type: Literal["range", "btree", "composite", "fulltext", "text", "point", "lookup"] = "range",
        name: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> None:
        prop_list = ", ".join(f"n.`{p}`" for p in properties)
        idx_name = f"`{name}`" if name else f"`idx_{label}_{'_'.join(properties)}`"

        if index_type == "fulltext":
            labels_str = f"[:`{label}`]"
            props_str = "[" + ", ".join(f'"{p}"' for p in properties) + "]"
            query = f"CREATE FULLTEXT INDEX {idx_name} FOR (n:{labels_str}) ON EACH {props_str}"
        elif index_type == "text":
            query = f"CREATE TEXT INDEX {idx_name} FOR (n:`{label}`) ON ({prop_list})"
        elif index_type == "point":
            query = f"CREATE POINT INDEX {idx_name} FOR (n:`{label}`) ON ({prop_list})"
        elif index_type == "lookup":
            query = f"CREATE LOOKUP INDEX {idx_name} FOR (n) ON EACH labels(n)"
        else:
            # range, btree, composite all use standard CREATE INDEX
            query = f"CREATE INDEX {idx_name} FOR (n:`{label}`) ON ({prop_list})"

        await self._connector.execute(query)

    async def drop_index(self, name: str) -> None:
        await self._connector.execute(f"DROP INDEX `{name}`")

    async def create_constraint(
        self,
        label: str,
        properties: list[str],
        *,
        constraint_type: Literal[
            "unique",
            "exists",
            "node_key",
            "relationship_unique",
            "relationship_exists",
        ] = "unique",
        name: str | None = None,
    ) -> None:
        constraint_name = f"`{name}`" if name else f"`cst_{label}_{'_'.join(properties)}`"

        if constraint_type in ("relationship_unique", "relationship_exists"):
            # Relationship property constraints use ()-[r:TYPE]-() syntax
            prop_list = ", ".join(f"r.`{p}`" for p in properties)
            if constraint_type == "relationship_unique":
                query = f"CREATE CONSTRAINT {constraint_name} FOR ()-[r:`{label}`]-() REQUIRE ({prop_list}) IS UNIQUE"
            else:
                query = f"CREATE CONSTRAINT {constraint_name} FOR ()-[r:`{label}`]-() REQUIRE ({prop_list}) IS NOT NULL"
        else:
            prop_list = ", ".join(f"n.`{p}`" for p in properties)
            if constraint_type == "unique":
                query = f"CREATE CONSTRAINT {constraint_name} FOR (n:`{label}`) REQUIRE ({prop_list}) IS UNIQUE"
            elif constraint_type == "exists":
                query = f"CREATE CONSTRAINT {constraint_name} FOR (n:`{label}`) REQUIRE ({prop_list}) IS NOT NULL"
            elif constraint_type == "node_key":
                query = f"CREATE CONSTRAINT {constraint_name} FOR (n:`{label}`) REQUIRE ({prop_list}) IS NODE KEY"
            else:
                msg = f"Unknown constraint type: {constraint_type}"
                raise ValueError(msg)

        await self._connector.execute(query)

    async def drop_constraint(self, name: str) -> None:
        await self._connector.execute(f"DROP CONSTRAINT `{name}`")

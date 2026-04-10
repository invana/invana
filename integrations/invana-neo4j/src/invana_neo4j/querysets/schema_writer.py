from typing import Any, Literal

from invana.graph.connectors.base.querysets.schema_writer import BaseSchemaWriterQuerySet


class Neo4jSchemaWriterQuerySet(BaseSchemaWriterQuerySet):
    """Neo4j 5-specific schema writer.

    Extends the generic OpenCypher writer with Neo4j-specific index types
    (``fulltext``, ``text``, ``point``, ``lookup``) and uses ``IF NOT EXISTS`` /
    ``IF EXISTS`` guards to make all operations idempotent.
    """

    async def create_index(
        self,
        label: str,
        properties: list[str],
        *,
        index_type: Literal["range", "btree", "composite", "fulltext", "text", "point", "lookup"] = "range",
        name: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> None:
        idx_name = f"`{name}`" if name else f"`idx_{label}_{'_'.join(properties)}`"
        prop_list = ", ".join(f"n.`{p}`" for p in properties)

        if index_type == "fulltext":
            props_str = ", ".join(f"n.`{p}`" for p in properties)
            query = f"CREATE FULLTEXT INDEX {idx_name} IF NOT EXISTS FOR (n:`{label}`) ON EACH [{props_str}]"
        elif index_type == "text":
            query = f"CREATE TEXT INDEX {idx_name} IF NOT EXISTS FOR (n:`{label}`) ON ({prop_list})"
        elif index_type == "point":
            query = f"CREATE POINT INDEX {idx_name} IF NOT EXISTS FOR (n:`{label}`) ON ({prop_list})"
        elif index_type == "lookup":
            query = f"CREATE LOOKUP INDEX {idx_name} IF NOT EXISTS FOR (n) ON EACH labels(n)"
        else:
            # range, btree, composite — standard CREATE INDEX
            query = f"CREATE INDEX {idx_name} IF NOT EXISTS FOR (n:`{label}`) ON ({prop_list})"

        await self._connector.execute(query)

    async def drop_index(self, name: str) -> None:
        await self._connector.execute(f"DROP INDEX `{name}` IF EXISTS")

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
        options: dict[str, Any] | None = None,
    ) -> None:
        constraint_name = f"`{name}`" if name else f"`cst_{label}_{'_'.join(properties)}`"

        if constraint_type in ("relationship_unique", "relationship_exists"):
            prop_list = ", ".join(f"r.`{p}`" for p in properties)
            if constraint_type == "relationship_unique":
                query = (
                    f"CREATE CONSTRAINT {constraint_name} IF NOT EXISTS "
                    f"FOR ()-[r:`{label}`]-() REQUIRE ({prop_list}) IS UNIQUE"
                )
            else:
                query = (
                    f"CREATE CONSTRAINT {constraint_name} IF NOT EXISTS "
                    f"FOR ()-[r:`{label}`]-() REQUIRE ({prop_list}) IS NOT NULL"
                )
        else:
            prop_list = ", ".join(f"n.`{p}`" for p in properties)
            if constraint_type == "unique":
                query = (
                    f"CREATE CONSTRAINT {constraint_name} IF NOT EXISTS "
                    f"FOR (n:`{label}`) REQUIRE ({prop_list}) IS UNIQUE"
                )
            elif constraint_type == "exists":
                query = (
                    f"CREATE CONSTRAINT {constraint_name} IF NOT EXISTS "
                    f"FOR (n:`{label}`) REQUIRE ({prop_list}) IS NOT NULL"
                )
            elif constraint_type == "node_key":
                query = (
                    f"CREATE CONSTRAINT {constraint_name} IF NOT EXISTS "
                    f"FOR (n:`{label}`) REQUIRE ({prop_list}) IS NODE KEY"
                )
            else:
                msg = f"Unknown constraint type: {constraint_type}"
                raise ValueError(msg)

        await self._connector.execute(query)

    async def drop_constraint(self, name: str) -> None:
        await self._connector.execute(f"DROP CONSTRAINT `{name}` IF EXISTS")

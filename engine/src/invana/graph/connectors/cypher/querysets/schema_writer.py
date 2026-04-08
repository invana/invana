from typing import Literal

from invana.graph.connectors.base.querysets.schema_writer import BaseSchemaWriterQuerySet


class OpenCypherSchemaWriterQuerySet(BaseSchemaWriterQuerySet):
    async def create_index(
        self,
        label: str,
        properties: list[str],
        *,
        index_type: Literal["btree", "fulltext", "composite"] = "btree",
        name: str | None = None,
    ) -> None:
        # Standard openCypher CREATE INDEX syntax
        prop_list = ", ".join(f"n.`{p}`" for p in properties)
        idx_name = f"`{name}`" if name else f"`idx_{label}_{'_'.join(properties)}`"

        if index_type == "fulltext":
            # Fulltext indexes use a different syntax in most Cypher DBs
            labels_str = f"[:`{label}`]"
            props_str = "[" + ", ".join(f'"{p}"' for p in properties) + "]"
            query = f"CREATE FULLTEXT INDEX {idx_name} FOR (n:{labels_str}) ON EACH {props_str}"
        else:
            query = f"CREATE INDEX {idx_name} FOR (n:`{label}`) ON ({prop_list})"

        await self._connector.execute(query)

    async def drop_index(self, name: str) -> None:
        await self._connector.execute(f"DROP INDEX `{name}`")

    async def create_constraint(
        self,
        label: str,
        properties: list[str],
        *,
        constraint_type: Literal["unique", "exists", "node_key"] = "unique",
        name: str | None = None,
    ) -> None:
        constraint_name = f"`{name}`" if name else f"`cst_{label}_{'_'.join(properties)}`"
        prop_list = ", ".join(f"n.`{p}`" for p in properties)

        if constraint_type == "unique":
            query = f"CREATE CONSTRAINT {constraint_name} FOR (n:`{label}`) REQUIRE ({prop_list}) IS UNIQUE"
        elif constraint_type == "exists":
            # Standard openCypher existence constraint (single property)
            query = f"CREATE CONSTRAINT {constraint_name} FOR (n:`{label}`) REQUIRE ({prop_list}) IS NOT NULL"
        elif constraint_type == "node_key":
            query = f"CREATE CONSTRAINT {constraint_name} FOR (n:`{label}`) REQUIRE ({prop_list}) IS NODE KEY"
        else:
            msg = f"Unknown constraint type: {constraint_type}"
            raise ValueError(msg)

        await self._connector.execute(query)

    async def drop_constraint(self, name: str) -> None:
        await self._connector.execute(f"DROP CONSTRAINT `{name}`")

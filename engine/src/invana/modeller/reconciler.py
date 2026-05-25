"""Reconciler — checks and syncs schema state on startup.

Compares three sources of truth:
1. **Active app version** — what the app intends the DB schema to be.
2. **Last projection** — what was last pushed to the DB.
3. **Live DB** — what the DB actually has right now.

Four reconciliation modes:
- ``strict``:          Block on any drift.
- ``auto_project``:    Re-project if app is ahead; block if DB is ahead.
- ``auto_introspect``: Re-project if app ahead; create draft if DB ahead.
- ``warn``:            Log warnings, never block.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from invana.modeller.schemas import SchemaDrift

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.graph.connectors.base.connector import BaseConnector
    from invana.modeller.introspector import Introspector
    from invana.modeller.projector import Projector
    from invana.modeller.store import SchemaStore

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class SchemaNotConfiguredError(Exception):
    """No active schema version exists."""


class SchemaOutOfSyncError(Exception):
    """The live DB schema has drifted from the expected state."""


# ---------------------------------------------------------------------------
# Reconciler
# ---------------------------------------------------------------------------


class Reconciler:
    """Performs three-way schema comparison and sync."""

    def __init__(
        self,
        store: SchemaStore,
        projector: Projector,
        introspector: Introspector,
    ) -> None:
        self._store = store
        self._projector = projector
        self._introspector = introspector

    async def reconcile(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        connector: BaseConnector,
        connector_id: str,
        mode: str = "strict",
    ) -> dict[str, Any]:
        """Run reconciliation and return a status dict.

        Returns a dict matching ``ReconcileResponse`` fields.
        """
        # 1. Get active version
        active = await self._store.get_active_version(session, model_id)

        if active is None:
            return await self._handle_no_active(
                session,
                model_id=model_id,
                connector=connector,
                connector_id=connector_id,
                mode=mode,
            )

        # 2. Get last projection
        last_proj = await self._store.get_latest_projection(session, model_id, connector_id)

        # 3. Get live DB state
        live_indexes = await connector.schema_reader.get_indexes()
        live_constraints = await connector.schema_reader.get_constraints()

        live_idx_keys = {(idx.label, tuple(idx.properties), idx.type) for idx in live_indexes}
        live_con_keys = {(c.label, tuple(c.properties), c.type) for c in live_constraints}

        # 4. Compute expected state from last projection
        if last_proj is not None and last_proj.operations:
            projected_idx_keys, projected_con_keys = self._extract_projected_keys(
                last_proj.operations,
            )
        else:
            projected_idx_keys = set()
            projected_con_keys = set()

        # 5. Compare
        drift = self._compute_drift(
            live_idx_keys,
            live_con_keys,
            projected_idx_keys,
            projected_con_keys,
            live_indexes,
            live_constraints,
        )

        app_ahead = bool(drift.missing_indexes or drift.missing_constraints)
        db_ahead = bool(drift.extra_indexes or drift.extra_constraints)

        # Both changed → conflict
        if app_ahead and db_ahead:
            msg = "Both app and DB schemas have changed. Manual reconciliation required."
            if mode in ("strict", "auto_project"):
                raise SchemaOutOfSyncError(msg)
            logger.warning(msg)
            return self._result(
                connector_id,
                model_id,
                active.version,
                status="error",
                drift=drift,
                message=msg,
            )

        # In sync
        if not app_ahead and not db_ahead:
            return self._result(
                connector_id,
                model_id,
                active.version,
                status="in_sync",
                message="Schema is in sync.",
            )

        # App ahead
        if app_ahead:
            return await self._handle_app_ahead(
                session,
                model_id=model_id,
                version=active,
                connector=connector,
                connector_id=connector_id,
                mode=mode,
                drift=drift,
            )

        # DB ahead
        return await self._handle_db_ahead(
            session,
            model_id=model_id,
            connector=connector,
            connector_id=connector_id,
            mode=mode,
            drift=drift,
            active_version=active.version,
        )

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    async def _handle_no_active(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        connector: BaseConnector,
        connector_id: str,
        mode: str,
    ) -> dict[str, Any]:
        """Handle the case where no active schema version exists."""
        if mode in ("strict", "auto_project"):
            raise SchemaNotConfiguredError(f"No active schema version for schema '{model_id}'.")

        if mode == "auto_introspect":
            logger.warning("No active schema — introspecting DB to create initial draft.")
            result = await self._introspector.introspect(
                session,
                model_id=model_id,
                connector=connector,
            )
            return self._result(
                connector_id,
                model_id,
                None,
                status="draft_created",
                new_draft_version_id=result["version_id"],
                message="Introspected DB and created initial draft version.",
            )

        # warn mode
        logger.warning("No active schema version for schema '%s'.", model_id)
        return self._result(
            connector_id,
            model_id,
            None,
            status="drifted",
            message="No active schema version. Configure a schema and activate it.",
        )

    async def _handle_app_ahead(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        version: Any,
        connector: BaseConnector,
        connector_id: str,
        mode: str,
        drift: SchemaDrift,
    ) -> dict[str, Any]:
        """Handle: app has state not in the DB."""
        if mode == "strict":
            raise SchemaOutOfSyncError("App schema is ahead of DB. Run projection or use auto_project mode.")

        if mode in ("auto_project", "auto_introspect"):
            logger.info("App ahead — auto-projecting active version.")
            proj_result = await self._projector.project(
                session,
                version=version,
                connector=connector,
                connector_id=connector_id,
            )
            return self._result(
                connector_id,
                model_id,
                version.version,
                status="projected",
                projection=proj_result,
                message="Auto-projected active version to DB.",
            )

        # warn mode
        logger.warning("App schema is ahead of DB for schema '%s'.", model_id)
        return self._result(
            connector_id,
            model_id,
            version.version,
            status="drifted",
            drift=drift,
            message="App schema is ahead of DB. Run projection to sync.",
        )

    async def _handle_db_ahead(
        self,
        session: AsyncSession,
        *,
        model_id: str,
        connector: BaseConnector,
        connector_id: str,
        mode: str,
        drift: SchemaDrift,
        active_version: str | None,
    ) -> dict[str, Any]:
        """Handle: DB has state not in the app schema."""
        if mode in ("strict", "auto_project"):
            raise SchemaOutOfSyncError("DB schema is ahead of app. Direct DB changes detected.")

        if mode == "auto_introspect":
            logger.warning("DB ahead — creating draft from introspection.")
            result = await self._introspector.introspect(
                session,
                model_id=model_id,
                connector=connector,
            )
            return self._result(
                connector_id,
                model_id,
                active_version,
                status="draft_created",
                drift=drift,
                new_draft_version_id=result["version_id"],
                message="DB has changes. Created draft version from introspection for review.",
            )

        # warn mode
        logger.warning("DB schema is ahead of app for schema '%s'.", model_id)
        return self._result(
            connector_id,
            model_id,
            active_version,
            status="drifted",
            drift=drift,
            message="DB schema is ahead of app. Direct DB changes detected.",
        )

    # ------------------------------------------------------------------
    # Drift computation
    # ------------------------------------------------------------------

    def _compute_drift(
        self,
        live_idx_keys: set,
        live_con_keys: set,
        projected_idx_keys: set,
        projected_con_keys: set,
        live_indexes: list,
        live_constraints: list,
    ) -> SchemaDrift:
        """Compare live DB state against projected state."""
        missing_idx = projected_idx_keys - live_idx_keys
        extra_idx = live_idx_keys - projected_idx_keys
        missing_con = projected_con_keys - live_con_keys
        extra_con = live_con_keys - projected_con_keys

        return SchemaDrift(
            missing_indexes=[{"label": k[0], "properties": list(k[1]), "type": k[2]} for k in missing_idx],
            extra_indexes=[{"label": k[0], "properties": list(k[1]), "type": k[2]} for k in extra_idx],
            missing_constraints=[{"label": k[0], "properties": list(k[1]), "type": k[2]} for k in missing_con],
            extra_constraints=[{"label": k[0], "properties": list(k[1]), "type": k[2]} for k in extra_con],
        )

    def _extract_projected_keys(
        self,
        operations: list[dict],
    ) -> tuple[set, set]:
        """Extract index/constraint keys from projection operations."""
        idx_keys: set = set()
        con_keys: set = set()

        for op in operations:
            action = op.get("action", "")
            label = op.get("label", "")
            props = tuple(op.get("properties", []))

            if action == "create_index":
                idx_type = op.get("index_type", "range")
                idx_keys.add((label, props, idx_type))
            elif action == "create_constraint":
                con_type = op.get("constraint_type", "unique")
                con_keys.add((label, props, con_type))

        return idx_keys, con_keys

    # ------------------------------------------------------------------
    # Result builder
    # ------------------------------------------------------------------

    @staticmethod
    def _result(
        connector_id: str,
        model_id: str | None,
        active_version: str | None,
        *,
        status: str,
        drift: SchemaDrift | None = None,
        new_draft_version_id: str | None = None,
        projection: dict | None = None,
        message: str = "",
    ) -> dict[str, Any]:
        return {
            "connector_id": connector_id,
            "model_id": model_id,
            "active_version": active_version,
            "status": status,
            "drift": drift,
            "new_draft_version_id": new_draft_version_id,
            "projection": projection,
            "message": message,
        }

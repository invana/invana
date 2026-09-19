"""Whether a Graph is ready, derived from what exists.

**A section is done when the thing it asks for exists** — nothing has to tell
setup that an import ran or a model published, so a step cannot go stale.

Its own app because the derivation is a **cross-app read** (migration-plan §14.1):
`modeller`, `llm_providers` and `skills` each answer part of it, and living in
`apps/graphs` made all of them import `graphs` back.

One of the questions is no longer an app's to answer. *Has data landed?* is
"did a load run and succeed", and a load is a **TaskRun** — a runtime record,
one band above this one (§ 6.7). So it arrives through a reader the caller
supplies, the same shape `MembershipReader` uses for the other direction
(migration-plan §17 step 7): the band stays one-way, and nothing here imports
upward to ask.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph, GraphConnection
from invana.apps.graphs.schemas import (
    SECTION_BLOCKED_BY,
    SECTION_GATE,
    SETUP_GATES,
    SETUP_REQUIRED,
    SETUP_SECTIONS,
    SETUP_SKIPPABLE,
    GraphRead,
)
from invana.apps.setup.sections import _iso, _mark_section
from invana.core.errors import ConflictError, ValidationError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, emit_event

if TYPE_CHECKING:
    from datetime import datetime


class LoadsReader(Protocol):
    """When records first landed in a Graph, or ``None`` if they never have.

    Implemented in the runtime, where the runs are. Setup asks the question; it
    does not know what a run is.
    """

    async def first_succeeded_load_at(self, session: AsyncSession, *, graph_id: str) -> datetime | None: ...


class SetupManager:
    def __init__(self, loads: LoadsReader | None = None) -> None:
        #: Without one, *data is in* reads as **not yet** rather than guessing —
        #: a step that cannot be checked is not a step that is done.
        self._loads = loads

    async def graph_read(self, session: AsyncSession, graph: Graph) -> GraphRead:
        """A Graph read with its setup state **derived**, not as stored.

        The composition lives here rather than in `apps/graphs` because deriving
        the state reads four other apps; `graphs` importing `setup` would put
        the §14.1 cycles straight back.
        """
        state = await self.derive_setup_state(session, graph)
        return await self._graphs.serialize(session, graph, setup_state=state)

    async def graph_reads(self, session: AsyncSession, graphs: list[Graph]) -> list[GraphRead]:
        """The same composition for a list. Every surface that reads a Graph goes
        through here, so setup state is derived on every read and never the stored
        column."""
        return [await self.graph_read(session, graph) for graph in graphs]

    @property
    def _graphs(self):
        """Deferred: `graphs` does not import `setup`, and this keeps it that way."""
        from invana.apps.graphs.managers import GraphManager  # noqa: PLC0415

        return GraphManager()

    async def derive_setup_state(self, session: AsyncSession, graph: Graph) -> dict[str, dict]:
        """Read setup progress off the Graph itself
        (docs/for-developers/modules/platform/features/setup.md · CM8).

        A section is done when the thing it asks for **exists** — nothing has to tell
        setup that an import ran, a model published or a skill was written, so a step
        finished from the CLI or by another member is done without a second path
        (SU1). Each section reports::

            {"done": bool, "completed_at": str | None, "skipped_at": str | None,
             "required": bool, "gate": str | None, "blocked_by": str | None,
             "broken": str | None}

        ``completed_at`` is the moment the fact came into being (the connection row,
        the first published version, the first succeeded run) where a timestamp
        exists, so Studio can draw the steps as a timeline. ``broken`` is a step that
        was done and stopped being true — an unreachable database, a rejected key —
        and it carries what was stored about the failure, never an invented reason.

        The stored column contributes exactly one thing: ``skipped_at`` on an optional
        section, plus the instructions stamp, which is the only completion time the
        schema records.
        """
        from invana.apps.llm_providers.models import LLMProvider  # noqa: PLC0415
        from invana.apps.modeller.models import GraphModel, GraphVersion, NodeTypeDefinition  # noqa: PLC0415
        from invana.apps.skills.models import Skill  # noqa: PLC0415

        stored = graph.setup_state or {}

        # A connection cannot be saved without a passing test (connect-a-database.md
        # CD2), so the row existing *is* the test. A later health check that errored
        # does not un-attach it — it breaks it.
        connection = (
            (
                await session.execute(
                    select(GraphConnection).where(GraphConnection.graph_id == graph.id),
                )
            )
            .scalars()
            .first()
        )

        # A published version on a model this Graph authored. The introspected mirror
        # is not authorship (CM6) — it is regenerated from the database and nobody
        # decided any of it.
        authored_versions, first_publish_at = (
            await session.execute(
                select(
                    func.count(GraphVersion.id),
                    func.min(func.coalesce(GraphVersion.activated_at, GraphVersion.created_at)),
                )
                .join(GraphModel, GraphModel.id == GraphVersion.model_id)
                .where(
                    GraphModel.graph_id == graph.id,
                    GraphModel.origin != "introspected",
                    GraphVersion.status == "active",
                ),
            )
        ).one()

        # A **succeeded** load means records landed in the graph, and the load is
        # the run — there is no second row that says files were registered
        # (§ 6.7). Both kinds count: a bulk load validated nothing, but the
        # records are in the database either way, and this step asks whether the
        # Graph has data (inspect-what-landed.md).
        first_import_at = await self._loads.first_succeeded_load_at(session, graph_id=graph.id) if self._loads else None

        # Records already in the database count (SU11). Introspection writes the
        # mirror; a node type in it means the database holds that label, so a Graph
        # pointed at a populated database is grounded on arrival and is never asked to
        # import its own data to satisfy a checklist.
        introspected_labels, introspected_at = (
            await session.execute(
                select(
                    func.count(NodeTypeDefinition.id),
                    func.min(func.coalesce(GraphVersion.activated_at, GraphVersion.created_at)),
                )
                .join(GraphVersion, GraphVersion.id == NodeTypeDefinition.version_id)
                .join(GraphModel, GraphModel.id == GraphVersion.model_id)
                .where(
                    GraphModel.graph_id == graph.id,
                    GraphModel.origin == "introspected",
                    GraphVersion.status == "active",
                ),
            )
        ).one()

        # The Graph's default provider is what an agent without one of its own uses
        # (providers-and-models.md C5), so it is the one that has to work. Save stores
        # it; the ping proves it (C3), and until it has been proved the step is not
        # done — the whole point is that the first question does not fail on
        # configuration.
        default_provider = (
            (
                await session.execute(
                    select(LLMProvider).where(LLMProvider.graph_id == graph.id, LLMProvider.is_default.is_(True)),
                )
            )
            .scalars()
            .first()
        )

        first_skill_at = (
            await session.execute(
                select(func.min(Skill.created_at)).where(Skill.graph_id == graph.id),
            )
        ).scalar_one_or_none()

        instructions_written = bool((graph.instructions or "").strip())
        data_landed_at = first_import_at or (introspected_at if introspected_labels else None)

        facts: dict[str, tuple[bool, str | None, str | None]] = {
            "graph_info": (
                connection is not None,
                _iso(connection.created_at) if connection is not None else None,
                "The database was unreachable at the last health check."
                if connection is not None and connection.status == "ERROR"
                else None,
            ),
            "model": (authored_versions > 0, _iso(first_publish_at), None),
            "datasets": (data_landed_at is not None, _iso(data_landed_at), None),
            "providers": (
                default_provider is not None and default_provider.last_ping_ok is True,
                _iso(default_provider.last_ping_at) if default_provider is not None else None,
                default_provider.last_ping_error
                if default_provider is not None and default_provider.last_ping_ok is False
                else None,
            ),
            # The schema keeps no "instructions written at"; the stored stamp is it.
            "instructions": (instructions_written, stored.get("instructions", {}).get("completed_at"), None),
            "skills": (first_skill_at is not None, _iso(first_skill_at), None),
        }

        state: dict[str, dict] = {}
        for section in SETUP_SECTIONS:
            done, completed_at, broken = facts[section]
            skipped_at = stored.get(section, {}).get("skipped_at") if section in SETUP_SKIPPABLE else None
            blocks = SECTION_BLOCKED_BY.get(section)
            state[section] = {
                "done": done,
                "completed_at": completed_at if done else None,
                "skipped_at": skipped_at,
                "required": section in SETUP_REQUIRED,
                "gate": SECTION_GATE.get(section),
                # A blocked step names what unblocks it rather than offering a form
                # that would refuse it (SU12).
                "blocked_by": blocks if (blocks is not None and not done and not facts[blocks][0]) else None,
                "broken": broken if done else None,
            }
        return state

    async def update_setup_section(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        section: str,
        action: str,
        actor_id: str,
    ) -> GraphRead:
        if section not in SETUP_SECTIONS:
            raise ValidationError(f"Unknown setup section '{section}'. Expected one of: {', '.join(SETUP_SECTIONS)}.")
        if action == "skip" and section not in SETUP_SKIPPABLE:
            raise ConflictError(f"Section '{section}' is required and cannot be skipped.")
        _mark_section(graph, section, action)
        await session.flush()
        event_action = {
            "complete": actions.SETUP_COMPLETE,
            "skip": actions.SETUP_SKIP,
            "reset": actions.SETUP_RESET,
        }.get(action)
        if event_action is not None:
            await emit_event(
                session,
                action=event_action,
                target_kind=actions.TARGET_GRAPH,
                target_id=graph.id,
                graph_id=graph.id,
                actor_id=actor_id,
                details={"section": section},
                trace_id=current_trace_id(),
            )
        return await self.graph_read(session, graph)

    async def is_setup_complete(self, session: AsyncSession, graph: Graph) -> tuple[bool, list[str]]:
        """Return (all_required_done, missing_sections), read off the facts (CM8).

        "Ready" — the Graph can be asked a question. Use :func:`is_gate_open` to ask
        the narrower question a single surface actually has: authoring a model waits
        on the connection, not on an LLM provider (SU3).
        """
        state = await self.derive_setup_state(session, graph)
        missing = [s for s in SETUP_REQUIRED if not state.get(s, {}).get("done")]
        return (not missing, missing)

    async def is_gate_open(self, session: AsyncSession, graph: Graph, gate: str) -> tuple[bool, list[str]]:
        """Return (gate_open, missing_sections) for one gate — ``connected`` ·
        ``grounded`` · ``answering`` (setup.md §2)."""
        if gate not in SETUP_GATES:
            raise ValueError(f"Unknown setup gate '{gate}'. Expected one of: {', '.join(SETUP_GATES)}.")
        state = await self.derive_setup_state(session, graph)
        missing = [s for s in SETUP_GATES[gate] if not state.get(s, {}).get("done")]
        return (not missing, missing)

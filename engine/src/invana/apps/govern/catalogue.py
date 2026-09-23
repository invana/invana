"""What a Graph can address at all — resolved, never stored.

The pickers in the authoring form and the *what this would match, right now*
preview in the rule builder both read this
([GV21](docs/for-developers/modules/govern/spec.md)). It is a **view** over what
the Graph already declares — its published model versions and their axes, its
stitches, its configured providers, the cache kinds and the roles — so a stored
copy would go stale the moment a model publishes.

That is also what makes *narrowing is picking, not writing*
([WO7](docs/for-developers/modules/govern/features/worlds.md)) enforceable:
every control offers what is here, so nothing can name something that is not.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import GOVERNED_LAYERS, Layer, matches
from invana.apps.govern.query_lens import ModelBinding, model_address
from invana.apps.govern.querysets.catalogue import CatalogueQuerySet

#: Fixed vocabularies. These are not configuration — they are the kinds of
#: participant the runtime has, and a Graph does not add to them.
CACHE_KINDS: tuple[str, ...] = ("answer", "prefix", "result")
HUMAN_ROLES: tuple[str, ...] = ("analyst", "owner", "member")


@dataclass(frozen=True, slots=True)
class Participant:
    """One addressable thing, and what a rule may say about it."""

    address: str
    layer: Layer
    sublayer: str
    name: str
    #: ``Routes@v4`` · ``claude-opus-5`` — what a list shows before the address.
    label: str = ""
    #: The axes this participant declared, if it is a model version. A lens may
    #: only slice along these ([GV14]).
    axes: dict[str, Any] = field(default_factory=dict)
    #: Its property names, for the exclusion picker.
    properties: tuple[str, ...] = ()
    #: Why it cannot be sliced, when it cannot. Shown in place of the controls,
    #: so *cannot slice* is never mistaken for *nobody sliced it*.
    note: str = ""


@dataclass(frozen=True, slots=True)
class Catalogue:
    """Every participant in one Graph, by layer."""

    participants: tuple[Participant, ...] = ()

    def by_layer(self, layer: Layer | str) -> tuple[Participant, ...]:
        wanted = Layer(layer)
        return tuple(p for p in self.participants if p.layer is wanted)

    def get(self, address: str) -> Participant | None:
        return next((p for p in self.participants if p.address == address), None)

    def matching(self, pattern: str) -> tuple[Participant, ...]:
        """What a rule pattern would bite, resolved against what exists now.

        The builder shows this as it is typed
        ([GR9](docs/for-developers/modules/govern/features/guardrails.md)): a
        rule whose effect you only discover at run time is one written blind,
        and a pattern matching nothing is almost always a typo.
        """
        return tuple(p for p in self.participants if matches(pattern, p.address))

    def layers_present(self) -> tuple[Layer, ...]:
        """Which governed layers this Graph has anything in.

        A layer with nothing configured says so in the builder rather than
        rendering an empty list — *nothing set* and *nothing permitted* must
        not look alike ([GR6]).
        """
        present = {p.layer for p in self.participants}
        return tuple(layer for layer in GOVERNED_LAYERS if layer in present)


class CatalogueResolver:
    """Builds the catalogue for a Graph, from the rows that already exist."""

    catalogue_qs = CatalogueQuerySet()

    async def resolve(self, session: AsyncSession, *, graph_id: str) -> Catalogue:
        participants: list[Participant] = []
        participants.extend(await self._graph_data(session, graph_id))
        participants.extend(await self._llm(session, graph_id))
        participants.extend(self._cache())
        participants.extend(self._human())
        # `third_party` is deliberately empty until endpoints are configured
        # rows of their own. A deny needs no catalogue, and the builder says
        # *no third-party endpoints are configured* rather than showing nothing.
        return Catalogue(participants=tuple(participants))

    async def _graph_data(self, session: AsyncSession, graph_id: str) -> list[Participant]:
        out: list[Participant] = []
        for model_name, version_label, axes, properties in await self.catalogue_qs.published_versions(
            session, graph_id
        ):
            label = f"{model_name}@{version_label}" if version_label else model_name
            out.append(
                Participant(
                    address=f"{Layer.graph_data.value}/model/{label}",
                    layer=Layer.graph_data,
                    sublayer="model",
                    name=label,
                    label=label,
                    axes=axes or {},
                    properties=tuple(properties),
                    note="" if (axes or {}) else "none declared — whole, cannot slice",
                )
            )
        for stitch_name in await self.catalogue_qs.stitch_names(session, graph_id):
            out.append(
                Participant(
                    address=f"{Layer.graph_data.value}/stitch/{stitch_name}",
                    layer=Layer.graph_data,
                    sublayer="stitch",
                    name=stitch_name,
                    label=stitch_name,
                    note="a link between models — permitted or denied, never sliced",
                )
            )
        return out

    async def _llm(self, session: AsyncSession, graph_id: str) -> list[Participant]:
        """One participant per *model on a configured provider row*.

        The sublayer is the provider row, not the vendor
        ([GV9](docs/for-developers/modules/govern/spec.md)) — which is exactly
        what lets one address name one credential.
        """
        out: list[Participant] = []
        for provider_name, model_id in await self.catalogue_qs.provider_models(session, graph_id):
            out.append(
                Participant(
                    address=f"{Layer.llm.value}/{provider_name}/{model_id}",
                    layer=Layer.llm,
                    sublayer=provider_name,
                    name=model_id,
                    label=model_id,
                    note="egress governs what may accompany a call to it",
                )
            )
        return out

    async def llm_address(self, session: AsyncSession, *, graph_id: str, model_row_id: str) -> str | None:
        """The address of one configured model — what a run is checked at.

        A run holds the ``llm_models`` row; the lens, the ledger and the rule all
        speak the address ([GV4](docs/for-developers/modules/govern/spec.md)), so
        the translation happens here, against the same naming the catalogue's own
        listing uses. ``None`` where the model is not this Graph's, which is a
        caller's mistake rather than a refusal — an unaddressable participant
        cannot be governed and must not be quietly permitted.
        """
        for row_id, name, model_id in await self.catalogue_qs.provider_rows(session, graph_id):
            if row_id == model_row_id:
                return f"{Layer.llm.value}/{name}/{model_id}"
        return None

    async def model_bindings(
        self, session: AsyncSession, *, graph_id: str, excluding: str | None = None
    ) -> tuple[ModelBinding, ...]:
        """Every published version a rule could name, with the types it declares.

        What makes an authored model a **bound** and not only something the
        picker offers ([GV33](docs/for-developers/modules/govern/spec.md)): a
        run is grounded on the introspected mirror, and a rule naming
        ``Deals@*`` narrows the types ``Deals`` declares, sliced along that
        model's axes.

        ``excluding`` drops the grounding version's own address — it is the
        fallback the resolution starts from, and reading it a second time would
        let its own *not narrowed* verdict widen a bound another model named.
        """
        out: list[ModelBinding] = []
        for model_name, version_label, axes, type_names in await self.catalogue_qs.published_type_names(
            session, graph_id
        ):
            address = model_address(model_name=model_name, version_label=version_label)
            if address == excluding:
                continue
            out.append(ModelBinding(address=address, types=tuple(type_names), axes=axes or {}))

        # The stitches too, and for the same reason. The edges that cross two
        # models belong to neither of them, so a world naming all four of a
        # Graph's models still could not traverse between them — the crossing
        # edge types would fall to the grounding version, and a closed layer
        # would leave them out. A stitch is its own participant
        # ([GV24](docs/for-developers/modules/govern/spec.md)), so it is its own
        # binding, bounding the one edge type it writes. It carries no axes: a
        # stitch is permitted or denied whole, never sliced.
        for stitch_name, edge_type in await self.catalogue_qs.stitch_bindings(session, graph_id):
            out.append(ModelBinding(address=f"{Layer.graph_data.value}/stitch/{stitch_name}", types=(edge_type,)))
        return tuple(out)

    async def version_address(self, session: AsyncSession, *, version_id: str) -> str | None:
        """``graph_data/model/AirRoutes@1.0.1`` for the version a run is grounded on.

        The same string the listing builds, for the same reason
        :meth:`llm_address` exists: a run is checked at the address a rule was
        written against, or it is checked at nothing ([GV4]).
        """
        found = await self.catalogue_qs.version_label(session, version_id)
        if found is None:
            return None
        model_name, version_label = found
        return model_address(model_name=model_name, version_label=version_label)

    def _cache(self) -> list[Participant]:
        return [
            Participant(
                address=f"{Layer.cache.value}/{kind}/*",
                layer=Layer.cache,
                sublayer=kind,
                name="*",
                label=kind,
                note="max_age_s bounds how stale a hit may be; 0 is walk it fresh",
            )
            for kind in CACHE_KINDS
        ]

    def _human(self) -> list[Participant]:
        return [
            Participant(
                address=f"{Layer.human.value}/role/{role}",
                layer=Layer.human,
                sublayer="role",
                name=role,
                label=role,
                note="max_rounds bounds how often a run may come back to a person",
            )
            for role in HUMAN_ROLES
        ]

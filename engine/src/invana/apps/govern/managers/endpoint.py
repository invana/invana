"""Which model answers, and whether a model may stop being offered.

Two rules that both need a lens and a provider in the same room, so they live
in Govern — the band that may read both.

**Resolution** ([PM14](docs/for-developers/modules/agents/features/providers-and-models.md)).
With ``is_default`` and ``agents.llm_config_id`` both gone, a run picks its
model exactly one way: compose the effective lens, resolve the role against it,
and look the address up in ``llm_models``. Where the lens casts nothing, the
**shipped cast** over the Graph's own models answers; where the Graph offers no
models at all, it is the 422 that routes a person to ``Agents → LLMs``.

**Ranking, at add** ([PM17](docs/for-developers/modules/agents/features/providers-and-models.md)).
``cost_rank`` and ``power_rank`` exist because ``shipped_cast`` — two functions
away, in this same app — is the only thing that reads them, so deriving one is
Govern's rule and not the provider row's. A model offered without them would sit
at the middle of an ordering every backfilled row was seeded into from its
published rate, and *which model answers when nobody said* would depend on
whether a row predates the split.

**Removal** ([PM11](docs/for-developers/modules/agents/features/providers-and-models.md)).
A model a cast names cannot quietly stop existing — the refusal names the
worlds, and the recourse is to retune them first. A model nothing names says so,
so the safe case is visibly safe.

**Renaming** ([PM18](docs/for-developers/modules/agents/features/providers-and-models.md)).
The ``name`` *is* the address's middle segment, so a rename moves every address
under the endpoint at once — which is removal's question asked of the whole row,
and answered the same way.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.cast import resolve as resolve_role
from invana.apps.govern.cast import shipped_cast
from invana.apps.govern.catalogue import Catalogue
from invana.apps.govern.models import Lens
from invana.apps.govern.querysets import LensQuerySet
from invana.apps.govern.rules import Effective, Role
from invana.apps.llm.pricing import rate_for
from invana.apps.llm_providers.endpoint import LLM_LAYER, LLMEndpoint, split_address
from invana.apps.llm_providers.managers import LLMProviderManager
from invana.apps.llm_providers.models import LLMModel, LLMProvider, LLMProviderKind
from invana.apps.llm_providers.querysets import LLMModelQuerySet
from invana.apps.llm_providers.schemas import LLMModelCreate, LLMProviderCreate, LLMProviderUpdate
from invana.core.errors import ConflictError, ValidationError

#: Kinds whose calls spend no API dollars and leave the machine for nothing —
#: the one ordering the price list cannot express.
_LOCAL_KINDS = (LLMProviderKind.ollama, LLMProviderKind.local)


class NoEndpointError(ValidationError):
    """The Graph offers no model this run could call. A 422 that routes a person
    to ``Agents → LLMs`` rather than a failure three steps in."""


class LLMEndpointManager:
    models_qs = LLMModelQuerySet()
    lenses_qs = LensQuerySet()
    providers = LLMProviderManager()
    catalogue = Catalogue()

    async def resolve(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        effective: Effective | None = None,
        role: Role | str = Role.decide,
        prefer_model_row_id: str | None = None,
    ) -> LLMEndpoint:
        """The endpoint this run calls, or a 422 naming what is missing.

        ``prefer_model_row_id`` is an explicit pick — a person naming the model
        for this one ask. It still has to be a model this Graph offers; it does
        **not** bypass the cast's check, because a pick is a resolution and not a
        widening ([GV6](docs/for-developers/modules/govern/spec.md)).
        """
        offered = await self.models_qs.endpoints_for_graph(session, graph_id)
        if not offered:
            raise NoEndpointError("No LLM is configured for this graph — add a provider in Agents → LLMs.")

        if prefer_model_row_id:
            picked = next((e for e in offered if e.model.id == prefer_model_row_id), None)
            if picked is None:
                raise ValidationError("That model was not found for this graph.")
            return picked

        address = self._cast_address(offered, effective=effective, role=role)
        if address is None:
            raise NoEndpointError(
                f"Nothing casts {Role(role).value} and no model this graph offers can stand in for it."
            )

        segments = split_address(address)
        found = next((e for e in offered if (e.row.name, e.model.model_id) == segments), None) if segments else None
        if found is None:
            # The cast names a model this Graph does not offer — a real
            # misconfiguration, and the refusal says which address, because
            # that is the string somebody has to go and fix.
            raise NoEndpointError(f"{address} is cast for {Role(role).value}, and this graph does not offer it.")
        return found

    def _cast_address(
        self,
        offered: list[LLMEndpoint],
        *,
        effective: Effective | None,
        role: Role | str,
    ) -> str | None:
        """The address for a role — the lens's, else the shipped cast's.

        The shipped cast is computed over what the Graph *offers*, so a Graph
        with providers and no cast still runs
        ([PM4](docs/for-developers/modules/agents/features/providers-and-models.md)).
        """
        shipped = shipped_cast([(e.address, e.capabilities) for e in offered])
        if effective is None:
            return shipped.get(Role(role).value)
        resolution = resolve_role(effective, role=role, shipped=shipped)
        if not resolution.allowed or resolution.address is None:
            # A denied cast is the lens refusing this run, and it already carries
            # the sentence that names its bound.
            raise ValidationError(resolution.refusal or "This run cannot open.")
        return resolution.address

    # ── offering one more ────────────────────────────────────────────────────

    async def create_provider(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: LLMProviderCreate,
        encryption_key: str,
        actor_id: str,
    ) -> LLMProvider:
        """Configure an endpoint and the models it opens with, ranked.

        Configuring one is one round trip (PM9), and the models that arrive on
        it are ranked exactly as a later one is — otherwise the first model a
        Graph offers is the one model the shipped cast cannot order.
        """
        provider = await self.providers.create(
            session,
            graph_id=graph_id,
            payload=payload.model_copy(update={"models": []}),
            encryption_key=encryption_key,
            actor_id=actor_id,
        )
        for model in payload.models:
            await self.add_model(session, provider=provider, payload=model, actor_id=actor_id)
        return provider

    async def add_model(
        self,
        session: AsyncSession,
        *,
        provider: LLMProvider,
        payload: LLMModelCreate,
        actor_id: str,
    ) -> LLMModel:
        """Offer one more model, ranked the way the backfilled rows are.

        The caller may state the ranks — a Graph on a negotiated rate knows its
        own order ([PM12](docs/for-developers/modules/agents/features/providers-and-models.md)).
        Where it does not, they are derived from the published rate, because
        vendors price by capability: cheap is a low ``cost_rank``, expensive a
        high ``power_rank``. A model nobody publishes a rate for is neither, and
        the middle is what says so.
        """
        capabilities = dict(payload.capabilities or {})
        if "cost_rank" not in capabilities or "power_rank" not in capabilities:
            derived = self._ranks(provider, payload.model_id)
            capabilities = {**derived, **capabilities}
        return await self.providers.add_model(
            session,
            provider=provider,
            payload=payload.model_copy(update={"capabilities": capabilities}),
            actor_id=actor_id,
        )

    @staticmethod
    def _ranks(provider: LLMProvider, model_id: str) -> dict:
        """What the shipped cast reads, from what the vendor charges.

        The same derivation migration ``53`` seeded every existing row with, so a
        model added today sorts against one backfilled yesterday rather than
        beside it.
        """
        local = provider.provider in _LOCAL_KINDS
        # A transient endpoint: `rate_for` reads a provider row and a model id,
        # and the row this model will become does not exist yet.
        rate = rate_for(LLMEndpoint(row=provider, model=LLMModel(provider_id=provider.id, model_id=model_id)))
        if local:
            # A local model costs no API dollars and is the one `judge` prefers,
            # because nothing leaves the machine.
            cost_rank, power_rank = 0, 20
        elif rate is None:
            # Unknown is not cheap and not capable — the middle, so an unpriced
            # model never silently wins either role.
            cost_rank, power_rank = 50, 50
        else:
            cost_rank = power_rank = min(99, round(rate.input_per_mtok))
        return {
            "context_window": None,
            "supports_tools": True,
            "embedding": False,
            "cost_rank": cost_rank,
            "power_rank": power_rank,
            "local": local,
        }

    # ── renaming, which moves every address under the endpoint ───────────────

    async def update_provider(
        self,
        session: AsyncSession,
        *,
        provider: LLMProvider,
        payload: LLMProviderUpdate,
        encryption_key: str,
        actor_id: str,
    ) -> LLMProvider:
        """Edit an endpoint, refusing a rename a world still names.

        The ``name`` is the address's middle segment
        ([PM10](docs/for-developers/modules/agents/features/providers-and-models.md)),
        so renaming moves ``llm/<name>/*`` in one write. A rule or a cast left
        naming the old address points at a participant that no longer exists,
        and a bound that matches nothing bounds nothing — migration ``53``
        rewrote addresses rather than allow that once, and this is the standing
        version of the same rule ([PM18](docs/for-developers/modules/agents/features/providers-and-models.md)).

        Everything else on the row — the credential, the base URL, the
        guardrails — is edited without a question, because none of it is
        addressed.
        """
        if payload.name is not None and payload.name != provider.name:
            named_by = await self.worlds_naming_endpoint(session, graph_id=provider.graph_id, name=provider.name)
            if named_by:
                raise ConflictError(
                    f"{LLM_LAYER}/{provider.name}/* is named by {', '.join(named_by)}. "
                    "Retune those worlds first, or configure a second endpoint under the new name — "
                    "renaming this one would leave them naming an endpoint that does not exist."
                )
        return await self.providers.update(
            session,
            provider=provider,
            payload=payload,
            encryption_key=encryption_key,
            actor_id=actor_id,
        )

    async def worlds_naming_endpoint(self, session: AsyncSession, *, graph_id: str, name: str) -> list[str]:
        """The lenses that name anything under ``llm/<name>`` — a cast address
        or a rule's pattern.

        Broader than :meth:`worlds_naming` by as much as a rename is broader
        than dropping one model: ``deny llm/anthropic-prod/**`` names no single
        address and would stop matching all the same.

        The walk is structural rather than a list of known keys, the way
        migration ``53``'s rewrite was — a rule that grows a field keeps being
        read. Named lenses only, for the reason :meth:`worlds_naming` gives.
        """
        out: list[str] = []
        for lens in await self.lenses_qs.list_for_graph(session, graph_id):
            if _names_endpoint(lens.rules, name) or _names_endpoint(lens.cast, name):
                out.append(self._name_of(lens))
        return out

    # ── removal, and the worlds that stand in its way ────────────────────────

    async def remove_model(
        self,
        session: AsyncSession,
        *,
        provider: LLMProvider,
        model: LLMModel,
        actor_id: str,
    ) -> None:
        address = LLMEndpoint(row=provider, model=model).address
        named_by = await self.worlds_naming(session, graph_id=provider.graph_id, address=address)
        if named_by:
            raise ConflictError(
                f"{address} is cast by {', '.join(named_by)}. "
                "Retune those worlds first — removing it would change what produces their answers."
            )
        await self.providers.remove_model(session, provider=provider, model=model, actor_id=actor_id)

    async def worlds_naming(self, session: AsyncSession, *, graph_id: str, address: str) -> list[str]:
        """The lenses whose ``cast`` resolves any role to this address.

        Named lenses only — worlds and guardrails. An unnamed lens belongs to
        one past run and is private to it, so naming it in a refusal would give
        a person nothing they could go and retune
        ([WO1](docs/for-developers/modules/govern/features/worlds.md)).

        Reads the lenses rather than a counter: a counter can disagree with the
        rows it counts ([data model § 8](docs/for-developers/building-engine/govern-and-agents-data-model.md)).
        """
        out: list[str] = []
        for lens in await self.lenses_qs.list_for_graph(session, graph_id):
            if address in (lens.cast or {}).values():
                out.append(self._name_of(lens))
        return out

    @staticmethod
    def _name_of(lens: Lens) -> str:
        return lens.display_name


def _names_endpoint(value: object, name: str) -> bool:
    """Whether any string anywhere in a rule document addresses ``llm/<name>``.

    The endpoint itself counts, and so does anything under it: a pattern, a
    cast address, and a segment that is only the first half of one.
    """
    prefix = f"{LLM_LAYER}/{name}"
    if isinstance(value, str):
        return value == prefix or value.startswith(f"{prefix}/")
    if isinstance(value, list):
        return any(_names_endpoint(item, name) for item in value)
    if isinstance(value, dict):
        return any(_names_endpoint(item, name) for item in value.values())
    return False

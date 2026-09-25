"""The soul preview — one ask, answered in the current voice and in the draft
([soul.md C5 · SO7](docs/for-developers/modules/agents/features/soul.md)).

Not a run. Nothing is planned, no query is written and nothing is recorded:
the preview judges how the agent sounds, so it reads no graph data and is told
to state none. It still goes through the agent's guardrails for **which model
may be called** — the Graph's and the agent's own — because a preview that
could reach a model a guardrail denies would be a way round the guardrail.
"""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.agents.schemas import SoulPreviewRequest, SoulPreviewResponse
from invana.apps.govern.managers import LensManager, LLMEndpointManager
from invana.apps.llm import LLMError
from invana.apps.llm.voice import check_traits, speak, voice_for
from invana.core.errors import ConflictError
from invana.core.settings import settings


class SoulManager:
    lenses = LensManager()
    endpoints = LLMEndpointManager()

    async def preview(self, session: AsyncSession, *, agent: Agent, payload: SoulPreviewRequest) -> SoulPreviewResponse:
        draft_traits = check_traits(payload.soul_traits)
        guardrails = await self.lenses.effective_guardrails(session, graph_id=agent.graph_id, agent_id=agent.id)
        # A 422 naming Agents → LLMs when the Graph offers no model, and the
        # guardrail's own sentence when it denies the one cast.
        provider = await self.endpoints.resolve(session, graph_id=agent.graph_id, effective=guardrails)
        try:
            current, draft = await asyncio.gather(
                speak(
                    provider=provider,
                    voice=voice_for(agent.soul, agent.soul_traits),
                    ask=payload.ask,
                    encryption_key=settings.encryption_key,
                ),
                speak(
                    provider=provider,
                    voice=voice_for(payload.soul, draft_traits),
                    ask=payload.ask,
                    encryption_key=settings.encryption_key,
                ),
            )
        except LLMError as exc:
            raise ConflictError(f"The preview could not be spoken — {provider.label}: {exc.message}") from exc
        return SoulPreviewResponse(ask=payload.ask, current=current.reply, draft=draft.reply, model=provider.address)

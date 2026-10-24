"""Publish a skill the way the product does: write the draft, draw it, publish.

Publish refuses a plan that was not drawn from the text being published, so a
test that only cares about what a second version does goes through a draw. The
model's half is replaced by what it would have returned — one sentence read as
*understand the question* — and everything after it is the real path.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import Envelope
from invana.apps.llm.draft import Candidate, DraftedPlaybook, DraftedSentence
from invana.apps.skills.models import Skill, SkillVersion
from invana.apps.skills.schemas import SkillVersionPublish
from invana.runtime.managers import SkillDraftManager
from invana.runtime.planning import resolve_plan

drafts = SkillDraftManager()
ENVELOPE = Envelope.from_spec({"allow": ["nl.translate"]})


async def draw(session: AsyncSession, *, skill: Skill) -> None:
    """Draw the open draft as one step, and fail loudly if nothing was written."""
    draft = await drafts.ensure_draft(session, skill=skill)
    sentence = DraftedSentence(
        span=draft.content or "Understand the question.",
        kind="step",
        candidates=(Candidate(task="nl.translate", label="Understand"),),
    )
    out = await drafts.apply_drawing(
        session,
        version_id=draft.id,
        drafted=DraftedPlaybook(sentences=[sentence]),
        envelope=ENVELOPE,
        validate=resolve_plan,
    )
    assert out.rejected is None and out.output["steps"] == 1, out.output


async def publish_drawn(
    session: AsyncSession, *, skill: Skill, payload: SkillVersionPublish, actor_id: str
) -> SkillVersion:
    """Write ``payload`` onto the draft, draw it, and publish it."""
    await drafts.write_draft(session, skill=skill, payload=payload)
    await draw(session, skill=skill)
    return await drafts.publish(session, skill=skill, payload=SkillVersionPublish(why=payload.why), actor_id=actor_id)

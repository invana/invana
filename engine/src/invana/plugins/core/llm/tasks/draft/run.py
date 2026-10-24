"""The ``plan.draft`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.apps.llm import LLMError
from invana.plugins.core.llm.shared import _exchange, _vocabulary
from invana.plugins.sdk.context import Out, RunVars, TaskContext, _provider_label, close_model, open_model
from invana.plugins.sdk.errors import TaskFailure


async def plan_draft(ctx: TaskContext, v: RunVars) -> Out:
    """Draw a skill's playbook as its plan — one sentence at a time.

    **Nothing is guessed.** The model returns the candidates each sentence has,
    and the three cases are counted rather than judged
    ([SK24](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
    one candidate is a step, none is a `form: human` step, and two or more
    **stops** — the question is recorded against the sentence and no plan is
    written until it is answered.

    The question is a row on the version, not a prompt on the run: it sits
    against the sentence in the editor, which is where the person who can
    answer it is looking, and it survives everything a reload takes with it
    ([SK26](docs/for-developers/modules/skills/features/authoring-a-skill.md)).

    The rows are written by one manager — ``SkillDraftManager``, which is where
    skills and plans are composed. This entry does the LLM call and nothing
    else, which is what keeps an entry to *one act*.
    """
    from invana.apps.llm.draft import draft_skill_plan
    from invana.runtime.managers.skill_draft import SkillDraftManager
    from invana.runtime.planning import resolve_plan

    envelope = v.envelope
    assert envelope is not None
    drafts = SkillDraftManager()
    version_id = str((ctx.step.args or {}).get("skill_version_id") or "")

    subject = await drafts.drawing(ctx.db, version_id=version_id)
    if subject is None:
        raise TaskFailure(cls="defect", cause="no_version", message="That draft no longer exists.", short="no draft")
    if v.provider is None:
        raise TaskFailure(
            cls="blocked",
            cause="no_provider",
            message="No LLM provider is bound to this agent, so the playbook cannot be drawn.",
            short="no provider",
        )

    crossing = await open_model(ctx, v)
    await ctx.progress(f"{_provider_label(v.provider)} · reading the playbook")
    try:
        drafted = await draft_skill_plan(
            provider=v.provider,
            name=subject.name,
            when_to_use=subject.when_to_use,
            content=subject.content,
            vocabulary=_vocabulary(envelope),
            plans=[p.model_dump() for p in await drafts.inlinable(ctx.db, graph_id=subject.graph_id)],
            answered=subject.answered,
            encryption_key=v.encryption_key,
            **({"timeout_s": v.timeout_s} if v.timeout_s is not None else {}),
        )
    except LLMError as exc:
        raise TaskFailure(
            cls="blocked", cause="llm_failed", message=exc.message, short="model error", raw=exc.message
        ) from exc
    v.llm_ms = (v.llm_ms or 0) + drafted.duration_ms
    await close_model(ctx, v, crossing, usage=drafted.usage, duration_ms=drafted.duration_ms)

    outcome = await drafts.apply_drawing(
        ctx.db,
        version_id=version_id,
        drafted=drafted,
        envelope=envelope,
        validate=resolve_plan,
        read_digest=subject.digest,
    )
    usage = drafted.usage
    # A refusal **settles**, exactly as a question does
    # ([SK31](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    # The draw did its job: it read the prose and found that what it names does
    # not hold together. Raising would put the reasons in a failure payload the
    # authoring surface never reads, and leave the author with a dead run and a
    # draft that silently drew nothing.
    return Out(
        detail=outcome.detail,
        input={"skill_version_id": version_id},
        output={**outcome.output, **_exchange(drafted)},
        tokens_in=usage.input_tokens if usage else None,
        tokens_out=usage.output_tokens if usage else None,
    )


run = plan_draft

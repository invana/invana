"""Seed the F04 boards that need a draft whose last draw left a line unmapped.

``agents.skill.unmapped`` and ``agents.skill.flow.unmapped`` draw *Mail the route
desk*: its second line is a style sentence, not an instruction, so the draw
reports it as unmapped. The engine keeps no column for that — it reads the
skill's newest draw run — so the draw run is the seed. Runs are pruned and
newer draws push an older one out of the window the engine reads; run this
right before a shoot (``reseed.py`` does). Run from the repo root:

    uv run --directory engine python ../scripts/agents-build/seed_f04.py
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

import invana.apps.annotations.models  # noqa: F401
import invana.apps.boards.models  # noqa: F401
import invana.apps.datasets.models  # noqa: F401
import invana.apps.flows.models  # noqa: F401
import invana.apps.graphs.models  # noqa: F401
import invana.apps.iam.models  # noqa: F401
import invana.apps.llm_providers.models  # noqa: F401
import invana.apps.sessions.models  # noqa: F401
import invana.apps.standards.models  # noqa: F401
import invana.apps.work.models  # noqa: F401
from invana.apps.skills.models import Skill, SkillVersion
from invana.core.db import create_db_engine, create_session_factory
from invana.runtime.models import RunRole, RunStatus, TaskRun

SKILL = "Mail the route desk"
MARK = {"seed": "f04"}


async def main() -> None:
    factory = create_session_factory(await create_db_engine())
    async with factory() as db:
        skill = (await db.execute(select(Skill).where(Skill.name == SKILL))).scalars().first()
        if skill is None:
            raise SystemExit(f"seed_f04: no skill named {SKILL!r}")
        draft = (
            (
                await db.execute(
                    select(SkillVersion)
                    .where(SkillVersion.skill_id == skill.id, SkillVersion.published_at.is_(None))
                    .order_by(SkillVersion.version.desc())
                )
            )
            .scalars()
            .first()
        )
        if draft is None:
            raise SystemExit("seed_f04: the skill has no draft")
        lines = [ln for ln in draft.content.splitlines() if ln.strip()]
        style = next((ln for ln in lines if "always" in ln or "prefer" in ln), lines[1])

        old = (
            (
                await db.execute(
                    select(TaskRun).where(
                        TaskRun.graph_id == skill.graph_id,
                        TaskRun.flow_key == "skill-draft",
                        TaskRun.parent_run_id.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        for run in old:
            if (run.params or {}).get("skill_version_id") == draft.id:
                await db.delete(run)
        await db.flush()

        now = datetime.now(UTC)
        run = TaskRun(
            graph_id=skill.graph_id,
            role=RunRole.plan.value,
            flow_key="skill-draft",
            status=RunStatus.succeeded.value,
            queued_at=now - timedelta(seconds=3),
            started_at=now - timedelta(seconds=3),
            finished_at=now,
            params={**MARK, "skill_version_id": draft.id},
        )
        db.add(run)
        await db.flush()
        db.add(
            TaskRun(
                graph_id=skill.graph_id,
                parent_run_id=run.id,
                role=RunRole.plan.value,
                seq=0,
                step_key="plan_draft",
                task_key="plan.draft",
                label="plan.draft",
                flow_key="skill-draft",
                status=RunStatus.succeeded.value,
                queued_at=now - timedelta(seconds=3),
                started_at=now - timedelta(seconds=3),
                finished_at=now,
                detail="drawn · 3 steps · 1 unmapped",
                output={"plan_id": draft.plan_id, "steps": 3, "unmapped": [style]},
            )
        )
        await db.commit()
        print(f"seed_f04: {SKILL} draft {draft.id}: unmapped {style!r}")


if __name__ == "__main__":
    asyncio.run(main())

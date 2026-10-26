"""What ``data.version.check`` and ``data.version.draft`` share: the dataset a step names, read as its run's author.

docs/for-developers/modules/platform/features/this-graphs-mcp-server.md. Both
functions take ``dataset`` as ``publisher/name`` and act as the person the run is
for — the token's holder when the call came over this Graph's MCP server — so the
dataset's own rules (only its owner pushes a draft) are the ones that apply. A
refusal from the datasets manager fails the step ``blocked``, carrying its words.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.managers import DatasetManager
from invana.apps.datasets.models import Dataset
from invana.core.auth.models import User
from invana.core.errors import InvanaError
from invana.plugins.sdk.context import RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure

datasets = DatasetManager()


def refused(exc: InvanaError, *, cause: str) -> TaskFailure:
    """A manager's refusal as the step's failure, its message kept."""
    message = str(exc.detail)
    return TaskFailure(cls="blocked", cause=cause, message=message, short=message[:60])


async def author(db: AsyncSession, v: RunVars) -> User:
    """The person the run acts for; a run with none cannot read a dataset."""
    user = await db.get(User, v.actor_id) if v.actor_id else None
    if user is None:
        raise TaskFailure(
            cls="blocked",
            cause="no_person",
            message="This step reads a dataset as a person, and its run has none.",
            short="no person",
        )
    return user


async def dataset_of(ctx: TaskContext, v: RunVars) -> tuple[Dataset, User]:
    """The dataset ``args.dataset`` names, as the run's author may read it."""
    ref = str((ctx.step.args or {}).get("dataset") or "").strip()
    publisher, _, name = ref.partition("/")
    if not publisher or not name:
        raise TaskFailure(
            cls="blocked",
            cause="no_dataset",
            message=f"{ref!r} is not a dataset address — name it as publisher/name.",
            short="no dataset",
        )
    user = await author(ctx.db, v)
    try:
        return await datasets.get(ctx.db, publisher=publisher, name=name, reader=user), user
    except InvanaError as exc:
        raise refused(exc, cause="dataset_not_found") from exc

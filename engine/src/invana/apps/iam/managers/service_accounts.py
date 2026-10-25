"""Service accounts — a person with no sign-in that owns tokens for scripts.

docs/for-developers/modules/identity-and-access/features/people-and-groups.md.
A service account is a ``users`` row with ``is_service_account``, an unusable
password and no email, created inside one Graph as a member holding ``viewer``.
Its username is global, like any username; only tokens act as it::

    row = await ServiceAccountManager().create(
        session, graph_id=g, payload=ServiceAccountCreate(username="nightly-load"), actor_id=me
    )

Who may call it is the route's guard (the ``iam`` area).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import GraphMember
from invana.apps.graphs.roles import GraphRole
from invana.apps.iam.managers.people import PeopleManager
from invana.apps.iam.querysets.people import PeopleQuerySet
from invana.apps.iam.schemas import PersonRow, ServiceAccountCreate
from invana.core.auth.models import User
from invana.core.errors import ConflictError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event

#: No bcrypt hash looks like this, so no password ever matches it.
UNUSABLE_PASSWORD = "!"


class ServiceAccountManager:
    """Stateless. The session is the first argument of every method."""

    qs = PeopleQuerySet()

    async def create(
        self, session: AsyncSession, *, graph_id: str, payload: ServiceAccountCreate, actor_id: str
    ) -> PersonRow:
        username = payload.username.strip().lower()
        if not username.replace("-", "").replace("_", "").isalnum():
            raise ValidationError("A username is letters, digits, dashes and underscores.")
        if await self.qs.username_taken(session, username=username):
            raise ConflictError(f"The username {username} is already taken.")
        user = User(
            username=username,
            email=None,
            password_hash=UNUSABLE_PASSWORD,
            first_name=username,
            is_service_account=True,
            preferences={"description": payload.description} if payload.description else {},
        )
        await self.qs.add(session, user)
        await self.qs.add(session, GraphMember(graph_id=graph_id, user_id=user.id, roles=[GraphRole.viewer.value]))
        await emit_event(
            session,
            action=actions.SERVICE_ACCOUNT_CREATE,
            target_kind=actions.TARGET_USER,
            target_id=user.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"username": username},
        )
        return (await PeopleManager().rows(session, graph_id=graph_id, user_id=user.id))[0]

"""IAM Tokens — list, mint and revoke the tokens a Graph sees.

docs/for-developers/modules/identity-and-access/features/tokens.md. A Graph
lists every live token bound to it and every profile token of one of its
members. A token minted here is **bound** to the Graph and may be **narrowed**:
its *Narrow to* statements become an inline policy named after the token and
attached to it, and the mint is refused when any of them asks for more than the
holder's own policies allow — a token is never wider than its holder.

The holder is the caller, or a service account member of this Graph when the
caller holds iam-admin. Revoking is the holder's act, or an iam-admin's; it
stamps the token and deletes its inline policy. Credential management needs a
signed-in session; the edge refuses a token-authenticated request before this
manager runs.

Usage::

    tokens = IamTokenManager()
    page = await tokens.page(session, graph=graph, params=params)
    created = await tokens.mint(session, graph=graph, payload=body, actor=user, actor_is_iam_admin=False)
    await tokens.revoke(session, graph=graph, token_id=created.id, actor=user, actor_is_iam_admin=False)
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.iam.managers.holdings import HoldingsManager
from invana.apps.iam.models import Policy, PolicyKind, PolicyStatus
from invana.apps.iam.querysets.holdings import HoldingsQuerySet
from invana.apps.iam.querysets.tokens import IamTokenQuerySet
from invana.apps.iam.schemas import (
    IAM_TOKEN_LIST,
    IamTokenCreate,
    IamTokenCreated,
    IamTokenRow,
    StatementRead,
    TokenHolder,
)
from invana.core.auth.models import PersonalAccessToken, User
from invana.core.auth.tokens import generate_personal_access_token, hash_token
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.core.lists import ListParams, Page, applied_filters
from invana.core.policy import Statement, StatementError, narrower_than, parse_statements, summary
from invana.core.settings import settings

_NOT_NAME = re.compile(r"[^a-z0-9]+")


def _aware(moment: datetime | None) -> datetime | None:
    if moment is not None and moment.tzinfo is None:
        return moment.replace(tzinfo=UTC)
    return moment


class IamTokenManager:
    """Stateless. The session is the first argument of every method."""

    qs = IamTokenQuerySet()
    holdings_qs = HoldingsQuerySet()
    holdings = HoldingsManager()

    # ── reading ──────────────────────────────────────────────────────────────

    async def page(self, session: AsyncSession, *, graph: Graph, params: ListParams) -> Page[IamTokenRow]:
        """One page of the live tokens this Graph lists, each with what it is narrowed to."""
        rows, info = await self.qs.page_for_graph(session, graph_id=graph.id, params=params)
        users = await self.qs.users_by_ids(session, [r.user_id for r in rows])
        policies = await self.qs.policies_by_ids(session, [r.policy_id for r in rows if r.policy_id])
        items = [self._row(r, users.get(r.user_id), policies.get(r.policy_id or "")) for r in rows]
        return Page[IamTokenRow].of(items, info, applied_filters(params, IAM_TOKEN_LIST))

    @staticmethod
    def _row(token: PersonalAccessToken, holder: User | None, policy: Policy | None) -> IamTokenRow:
        username = holder.username if holder is not None else "unknown"
        statements = parse_statements(policy.statements) if policy is not None else []
        expires_at = _aware(token.expires_at)
        return IamTokenRow(
            id=token.id,
            name=token.name,
            last_four=token.last_four,
            holder=TokenHolder(
                user_id=token.user_id,
                username=username,
                kind="service" if holder is not None and holder.is_service_account else "person",
            ),
            graph_bound=token.graph_id is not None,
            narrowed_to=f"inline · {summary(statements)}" if policy is not None else f"all of {username}'s",
            policy=policy.name if policy is not None else None,
            statements=[StatementRead(**s.as_dict(), layer=s.layer) for s in statements],
            expires_at=expires_at,
            last_used_at=token.last_used_at,
            created_at=token.created_at,
            expired=expires_at is not None and expires_at <= datetime.now(UTC),
        )

    # ── minting ──────────────────────────────────────────────────────────────

    async def _holder(self, session: AsyncSession, *, graph: Graph, holder_id: str | None, actor: User, admin: bool):
        """The caller, or a service account member of this Graph minted for by an iam-admin."""
        if holder_id is None or holder_id == actor.id:
            return actor
        holder = (await self.qs.users_by_ids(session, [holder_id])).get(holder_id)
        member = (
            await self.holdings_qs.member_roles(session, graph_id=graph.id, user_id=holder_id)
            if holder is not None
            else None
        )
        if holder is None or member is None:
            raise NotFoundError("No such member of this Graph.")
        if not holder.is_service_account:
            raise PermissionDeniedError("A token is minted for yourself or for a service account of this Graph.")
        if not admin:
            raise PermissionDeniedError("Minting a token for a service account needs the iam-admin role.")
        return holder

    def _statements(self, payload: IamTokenCreate) -> list[Statement]:
        try:
            return parse_statements([s.model_dump() for s in payload.statements])
        except StatementError as exc:
            raise ValidationError(str(exc)) from exc

    async def _policy_name(self, session: AsyncSession, *, graph_id: str, token_name: str) -> str:
        base = ("token-" + _NOT_NAME.sub("-", token_name.lower()).strip("-")).rstrip("-")[:56]
        taken = await self.qs.policy_names_like(session, graph_id=graph_id, prefix=base)
        name, n = base, 2
        while name in taken:
            name, n = f"{base}-{n}", n + 1
        return name

    async def mint(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        payload: IamTokenCreate,
        actor: User,
        actor_is_iam_admin: bool,
    ) -> IamTokenCreated:
        """Mint a token bound to this Graph and hand back its secret — the one time it is readable.

        Refused when the holder is not the caller or one of this Graph's service
        accounts, when the expiry is not one the deployment offers, when the
        holder is at the ceiling or already holds the name, and when a *Narrow to*
        statement asks for more than the holder's own policies allow.
        """
        holder = await self._holder(
            session, graph=graph, holder_id=payload.holder_id, actor=actor, admin=actor_is_iam_admin
        )
        name = payload.name.strip()
        if not name:
            raise ValidationError("Name a token so you can recognise it later.")
        choices = list(settings.auth_token_expiry_day_choices)
        if payload.expires_in_days is not None and payload.expires_in_days not in choices:
            raise ValidationError(f"A token expires in one of {', '.join(map(str, choices))} days, or never.")
        existing = await self.qs.live_for_user(session, user_id=holder.id)
        ceiling = settings.auth_max_personal_access_tokens
        if len(existing) >= ceiling:
            raise ConflictError(f"{holder.username} already holds {len(existing)} tokens, the maximum is {ceiling}.")
        if any(row.name == name for row in existing):
            raise ConflictError(f"{holder.username} already has a token named '{name}'.")

        statements = self._statements(payload)
        if statements:
            held = await self.holdings.policies_for(session, graph_id=graph.id, principal=("person", holder.id))
            missing = narrower_than(statements, [s for h in held for s in h.statements])
            if missing:
                raise ValidationError(
                    f"A token is never wider than its holder — {holder.username} is not allowed "
                    + "; ".join(missing)
                    + "."
                )

        secret = generate_personal_access_token()
        expires_at = (
            datetime.now(UTC) + timedelta(days=payload.expires_in_days) if payload.expires_in_days is not None else None
        )
        token = PersonalAccessToken(
            user_id=holder.id,
            name=name,
            token_hash=hash_token(secret),
            last_four=secret[-4:],
            expires_at=expires_at,
            graph_id=graph.id,
            created_by_id=actor.id,
        )
        policy: Policy | None = None
        if statements:
            policy = Policy(
                graph_id=graph.id,
                name=await self._policy_name(session, graph_id=graph.id, token_name=name),
                kind=PolicyKind.inline.value,
                status=PolicyStatus.saved.value,
                version=1,
                description=f"Narrows token {name!r}.",
                statements=[s.as_dict() for s in statements],
                owner_id=holder.id,
                created_by_id=actor.id,
                updated_by_id=actor.id,
            )
            await self.qs.add_inline(session, token=token, policy=policy, attached_by_id=actor.id)
        else:
            await self.qs.add(session, token)
        await emit_event(
            session,
            action=actions.TOKEN_CREATE,
            target_kind=actions.TARGET_TOKEN,
            target_id=token.id,
            actor_id=actor.id,
            graph_id=graph.id,
            details={
                "name": name,
                "holder": holder.username,
                "policy": policy.name if policy is not None else None,
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
        )
        row = self._row(token, holder, policy)
        return IamTokenCreated(**row.model_dump(), secret=secret)

    # ── revoking ─────────────────────────────────────────────────────────────

    async def revoke(
        self, session: AsyncSession, *, graph: Graph, token_id: str, actor: User, actor_is_iam_admin: bool
    ) -> None:
        """Stamp a token revoked and delete its inline policy — the holder's act, or an iam-admin's."""
        token = await self.qs.get_listed(session, graph_id=graph.id, token_id=token_id)
        if token is None:
            raise NotFoundError("Token not found.")
        if token.user_id != actor.id and not actor_is_iam_admin:
            raise PermissionDeniedError("Revoking another holder's token needs the iam-admin role.")
        token.revoked_at = datetime.now(UTC)
        policy_id, token.policy_id = token.policy_id, None
        if policy_id is not None:
            await self.qs.delete_policy(session, policy_id)
        await session.flush()
        await emit_event(
            session,
            action=actions.TOKEN_REVOKE,
            target_kind=actions.TARGET_TOKEN,
            target_id=token.id,
            actor_id=actor.id,
            graph_id=graph.id,
            details={"name": token.name, "holder_id": token.user_id},
        )

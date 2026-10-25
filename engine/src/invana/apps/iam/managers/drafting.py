"""*Draft with the assistant* — one sentence becomes a draft policy.

docs/for-developers/modules/identity-and-access/features/policies.md. The engine
asks the Graph's model once for statements in the grammar (``core/policy.py``),
checks every one, and saves a **draft** with ``drafted_by = assistant``, named
from the sentence. Nothing is held until a person saves and attaches it. A reply
outside the grammar is refused, naming the statement; a Graph with no model has
nothing to draft with::

    drafts = PolicyDraftManager()
    draft = await drafts.draft(session, graph_id=g, prompt="Fare Scout reads fares", actor_id=me)
"""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.iam.managed import MANAGED_NAMES
from invana.apps.iam.managers.policies import PolicyManager
from invana.apps.iam.models import Policy
from invana.apps.iam.querysets.policies import PolicyQuerySet
from invana.apps.iam.schemas import PolicyCreate, StatementIn
from invana.apps.llm import LLMError, complete_tool
from invana.apps.llm_providers.querysets import LLMModelQuerySet
from invana.core.errors import ConflictError, ValidationError
from invana.core.policy import LAYERS, StatementError, parse_statements
from invana.core.settings import settings

_MAX_NAME_WORDS = 5

DRAFT_TOOL: dict = {
    "type": "object",
    "properties": {
        "description": {"type": "string", "description": "One line: what the policy grants."},
        "statements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "effect": {"type": "string", "enum": ["allow"]},
                    "actions": {"type": "array", "items": {"type": "string"}, "minItems": 1},
                    "resources": {"type": "array", "items": {"type": "string"}, "minItems": 1},
                    "conditions": {"type": "object"},
                },
                "required": ["actions", "resources"],
            },
        },
    },
    "required": ["statements"],
}


def _system_prompt() -> str:
    layers = "\n".join(f"- {name}/… — {line}" for name, _, line in LAYERS)
    return (
        "You write access policies for a knowledge-graph platform. A policy is a list of statements; "
        "each statement ALLOWS some actions on some resources. There is no deny: whatever no statement "
        "allows is refused, so grant only what the sentence asks for.\n\n"
        "Actions are dotted function names and may use * as a glob — graph.read.*, graph.write.edits, "
        "llm.call (every model call), web.read_url, work.spawn_agent, work.delegate.\n"
        f"Resources open with their layer, then a path that may use *:\n{layers}\n"
        "Examples: graph/Fare/*, llm/*, third_party/web/example.com, agent/Fare Scout, project/*.\n"
        "A graph resource may carry one field after ' · ' (graph/Fare/* · price).\n\n"
        "Conditions are optional and only these three: fields {only: [names]} or {except: [names]}; "
        "depth {max: N} spawn levels; until: an ISO instant. Use nothing else."
    )


def slug_of(prompt: str) -> str:
    """``Fare Scout reads fares`` → ``fare-scout-reads-fares``."""
    words = re.findall(r"[a-z0-9]+", prompt.lower())[:_MAX_NAME_WORDS]
    return "-".join(words)[:48].strip("-") or "draft"


class PolicyDraftManager:
    """Stateless. The session is the first argument of every method."""

    qs = PolicyQuerySet()
    models_qs = LLMModelQuerySet()
    policies = PolicyManager()

    async def draft(self, session: AsyncSession, *, graph_id: str, prompt: str, actor_id: str | None) -> Policy:
        endpoints = await self.models_qs.endpoints_for_graph(session, graph_id)
        if not endpoints:
            raise ConflictError("This Graph has no model to draft with.")
        try:
            result = await complete_tool(
                provider=endpoints[0],
                system=_system_prompt(),
                messages=[{"role": "user", "content": f"Write the policy for: {prompt.strip()}"}],
                tool_schema=DRAFT_TOOL,
                tool_name="submit_policy",
                encryption_key=settings.encryption_key,
                operation="policy_draft",
            )
        except LLMError as exc:
            raise ConflictError(exc.message) from exc
        raw = result.input.get("statements")
        if not isinstance(raw, list) or not raw:
            raise ValidationError("The model's draft has no statement in the grammar.")
        try:
            parsed = parse_statements(raw)
        except StatementError as exc:
            raise ValidationError(f"The model's draft is outside the grammar — {exc}") from exc
        name = await self._free_name(session, graph_id=graph_id, base=slug_of(prompt))
        payload = PolicyCreate(
            name=name,
            kind="custom",
            description=str(result.input.get("description") or prompt.strip())[:500],
            statements=[StatementIn(**s.as_dict()) for s in parsed],
        )
        return await self.policies.create(
            session, graph_id=graph_id, payload=payload, actor_id=actor_id, drafted_by="assistant"
        )

    async def _free_name(self, session: AsyncSession, *, graph_id: str, base: str) -> str:
        taken = await self.qs.names_taken(session, graph_id=graph_id, prefix=base) | set(MANAGED_NAMES)
        if base not in taken:
            return base
        n = 2
        while f"{base}-{n}" in taken:
            n += 1
        return f"{base}-{n}"

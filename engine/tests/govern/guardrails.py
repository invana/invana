"""A Graph guardrail row for tests that need one in force without a published model behind it."""

from __future__ import annotations

from invana.apps.govern.guardrail import compile_rules, generated_name, key_for, parse_target
from invana.apps.govern.models import GRAPH_SCOPE, GuardrailAccess, Lens, LensKind


def graph_guardrail(
    graph_id: str, target: str = "*.*", access: GuardrailAccess = GuardrailAccess.read, leaves: bool = False
) -> Lens:
    """A Graph guardrail row, compiled as the manager would — without asking a published model for the target."""
    parsed = parse_target(target)
    return Lens(
        graph_id=graph_id,
        kind=LensKind.guardrail.value,
        scope=GRAPH_SCOPE,
        key=key_for(parsed),
        name=generated_name(parsed, access, leaves),
        target=parsed.text,
        access=access.value,
        leaves=leaves,
        allowed_in=[],
        rules=compile_rules(parsed, access, leaves),
    )

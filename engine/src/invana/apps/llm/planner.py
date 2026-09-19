"""Plan — the workflow one run runs, when no template fits.

The common case never reaches this module: *Plan* matches a template by intent
and costs no LLM call (docs/for-developers/modules/agents/spec.md). This is the other case — a
`compound` ask whose shape no library entry has — and it stays inside the envelope
(docs/for-developers/modules/ask/spec.md)
**D2** for the same reason the ``plan`` task does: the model proposes a
**document**, and the interpreter validates it against the envelope before
anything is dispatched.

The grammar has nowhere to put code. A step is a task key, a label, and args
that are either literals or ``${steps.X.y}`` path lookups — so "the model wrote
the workflow" never means "the model wrote an expression we then evaluate".
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from invana.apps.llm import LLMError, complete_tool
from invana.apps.llm.schemas import Exchange, TokenUsage
from invana.apps.llm_providers.models import LLMProvider

PLAN_TOOL = {
    "type": "object",
    "properties": {
        "rationale": {"type": "string", "description": "One sentence: why this shape answers the ask."},
        "steps": {
            "type": "array",
            "description": "The ordered steps to run. Every task must come from the allowed list.",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Short unique id, e.g. 'translate_a'."},
                    "task": {"type": "string", "description": "One of the allowed task keys."},
                    "label": {"type": "string", "description": "What the step's row says, e.g. 'Translate A'."},
                    "ask": {
                        "type": "string",
                        "description": 'For a translate step: the single sub-question it should translate. Else "".',
                    },
                    "binds": {
                        "type": "string",
                        "description": 'Optional ${steps.<earlier id>.<field>} reference this step consumes. Else "".',
                    },
                },
                "required": ["id", "task", "label", "ask", "binds"],
            },
        },
    },
    "required": ["rationale", "steps"],
}


@dataclass(slots=True)
class ProposedPlan:
    steps: list[dict] = field(default_factory=list)
    rationale: str = ""
    usage: TokenUsage | None = None
    #: The call as a reader reads it — drawn as the step dashboard's Output
    #: band (SR42). Not a declared output: a plan cannot bind a raw prompt.
    exchange: Exchange = field(default_factory=Exchange)
    duration_ms: float = 0.0


def _vocabulary_lines(vocabulary: Sequence[Mapping[str, Any]]) -> str:
    """The allowed tasks, each with what must precede it and what it produces.

    **This is the catalogue's own declaration, not a second copy of it**
    (docs/for-developers/orchestration.md § 0.6). The planner reads `requires`
    while drafting rather than being refused and redrafting, and it can only
    write a `${steps.x.y}` that exists because the outputs are on the page.
    """
    lines = []
    for entry in sorted(vocabulary, key=lambda e: str(e.get("key"))):
        parts = [f"  {entry.get('key')}"]
        if entry.get("requires"):
            parts.append(f"after: {', '.join(entry['requires'])}")
        if entry.get("outputs"):
            parts.append("outputs: " + ", ".join(f"{k}:{v}" for k, v in sorted(entry["outputs"].items())))
        lines.append(" · ".join(parts))
    return "\n".join(lines) or "  (none)"


def _system_prompt(*, vocabulary: Sequence[Mapping[str, Any]], max_steps: int, pins: dict) -> str:
    pin_lines = "\n".join(f"  {task}: {args}" for task, args in sorted(pins.items())) if pins else "  (none)"
    return (
        "You compose a workflow that answers ONE question. You do not answer it — you decide the "
        "ordered steps a runtime will execute.\n\n"
        f"Allowed tasks (use nothing else), with what each needs before it and what it "
        f"produces:\n{_vocabulary_lines(vocabulary)}\n"
        f"Maximum steps: {max_steps}\n"
        f"Arguments already fixed by policy (do not set these):\n{pin_lines}\n\n"
        "Rules:\n"
        "- Every step needs a unique short id and a human label; the label is what the user watches.\n"
        "- A task listed with 'after' must have those tasks earlier in the plan; a plan that "
        "breaks this is rejected before anything runs.\n"
        "- A step may reference an EARLIER step's output as ${steps.<id>.<field>} in 'binds' — never a "
        "later one, never itself, and only a field listed under that task's outputs.\n"
        "- Keep it as short as the ask allows. A workflow with steps nobody needs is a worse answer.\n"
        "- The last step should verify the result served the ask when verify_result is allowed."
    )


async def generate_plan(
    *,
    provider: LLMProvider,
    intent: dict,
    prompt: str,
    vocabulary: Sequence[Mapping[str, Any]],
    max_steps: int,
    pins: dict,
    encryption_key: str,
    repair_errors: list[str] | None = None,
    timeout_s: float = 60.0,
) -> ProposedPlan:
    """Ask for a plan; hand back validation errors once on a repair.

    ``repair_errors`` is the whole rejection list rather than the first
    problem — the one repair is worth more when the model can see everything
    that was wrong with the last attempt (docs/for-developers/modules/ask/features/when-it-cannot-answer.md's posture,
    one level up).
    """
    messages: list[dict] = [
        {
            "role": "user",
            "content": (
                f"Question: {prompt}\n\n"
                f"Intent: {intent.get('kind')} — {intent.get('summary')}\n"
                f"Types involved: {', '.join(intent.get('refs') or []) or 'unknown'}\n"
                f"A good answer looks like: {', '.join(intent.get('expects') or []) or 'unspecified'}"
            ),
        }
    ]
    if repair_errors:
        messages.append(
            {
                "role": "user",
                "content": "Your previous plan was rejected:\n- " + "\n- ".join(repair_errors) + "\nFix all of them.",
            }
        )

    result = await complete_tool(
        provider=provider,
        system=_system_prompt(vocabulary=vocabulary, max_steps=max_steps, pins=pins),
        messages=messages,
        tool_schema=PLAN_TOOL,
        tool_name="submit_plan",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
        operation="plan",
    )
    raw = result.input.get("steps") or []
    if not isinstance(raw, list) or not raw:
        raise LLMError("The model did not produce a plan for that question.")

    steps: list[dict] = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        args: dict = {}
        ask = str(item.get("ask") or "").strip()
        if ask:
            args["ask"] = ask
        binds = str(item.get("binds") or "").strip()
        if binds:
            # One named binding keeps the tool schema flat; the validator still
            # checks it resolves to an earlier step.
            args["input"] = binds
        steps.append(
            {
                "id": str(item.get("id") or f"step_{i}"),
                "task": str(item.get("task") or ""),
                "label": str(item.get("label") or ""),
                "args": args,
            }
        )
    return ProposedPlan(
        steps=steps,
        rationale=str(result.input.get("rationale") or ""),
        usage=result.usage,
        exchange=result.exchange,
        duration_ms=result.duration_ms,
    )

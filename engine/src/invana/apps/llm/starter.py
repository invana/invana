"""The assistant's starter set — eval cases proposed from a subject's text
(docs/for-developers/modules/skills/features/evals.md).

One forced tool call reads a skill's or an agent's instructions and writes a
handful of questions a person would ask it, each with the rule checks that can
be stated without reading the graph. Nothing here decides whether a case is
kept: the caller writes every one as ``proposed``, and a person accepts it.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.apps.llm import LLMError, complete_tool
from invana.apps.llm.schemas import TokenUsage
from invana.apps.llm_providers.endpoint import LLMEndpoint

#: The most cases one proposal writes.
MAX_PROPOSED = 5
#: The checks a proposal may name — the ones that need no record ids or world names.
PROPOSABLE_CHECKS = ("cites_records", "cannot_answer", "guardrail_holds")

STARTER_TOOL = {
    "type": "object",
    "properties": {
        "cases": {
            "type": "array",
            "maxItems": MAX_PROPOSED,
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string", "description": "A question a person would ask, in their words."},
                    "checks": {
                        "type": "array",
                        "items": {"type": "string", "enum": list(PROPOSABLE_CHECKS)},
                        "description": "cites_records when the answer must cite records; cannot_answer when the "
                        "instructions say this is out of reach; guardrail_holds when it tests a limit.",
                    },
                },
                "required": ["question", "checks"],
            },
        }
    },
    "required": ["cases"],
}

_SYSTEM = (
    "You write regression questions for a knowledge-graph assistant. Read its instructions and propose up to "
    f"{MAX_PROPOSED} questions that, together, cover what it promises to answer and at least one it should refuse. "
    "Ask in a user's words. Do not invent record ids or names the instructions do not give."
)


@dataclass(frozen=True, slots=True)
class Proposed:
    cases: list[dict]
    model_version: str
    usage: TokenUsage


async def propose_cases(
    *, provider: LLMEndpoint, instructions: str, encryption_key: str, timeout_s: float = 60.0
) -> Proposed:
    """Propose starter cases from ``instructions``; raises ``LLMError`` on a reply with none."""
    result = await complete_tool(
        provider=provider,
        system=_SYSTEM,
        messages=[{"role": "user", "content": f"Instructions:\n{instructions}"}],
        tool_schema=STARTER_TOOL,
        tool_name="submit_cases",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
        operation="propose_evals",
    )
    cases = []
    for raw in (result.input.get("cases") or [])[:MAX_PROPOSED]:
        question = str(raw.get("question") or "").strip() if isinstance(raw, dict) else ""
        if not question:
            continue
        kinds = [k for k in raw.get("checks") or [] if k in PROPOSABLE_CHECKS]
        cases.append({"question": question, "checks": [{"kind": k} for k in dict.fromkeys(kinds)]})
    if not cases:
        raise LLMError("The assistant proposed no cases.")
    return Proposed(cases=cases, model_version=provider.model_id, usage=result.usage)

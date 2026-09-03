"""Built-in workflows as data (RFC-051 § 3).

A workflow is the ordered list of tasks that turns an ask into an answer. Each
step names itself (``label`` — what the step row shows) and carries its retry
policy (RFC-052 § 3.1: the spec declares, the runtime executes). The MVP ships
three, seeded here in code; authoring is out of scope.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class Retry:
    max_attempts: int = 1
    # Failure classes that may retry (RFC-052 § 2) — never exception types.
    on: frozenset[str] = frozenset()
    initial_ms: int = 500
    max_ms: int = 10_000
    jitter: bool = True

    def delay_ms(self, attempt: int, rand: float) -> float:
        """Exponential backoff for the retry after ``attempt`` failures, with jitter."""
        base = min(self.initial_ms * (2 ** (attempt - 1)), self.max_ms)
        return base * (0.5 + rand) if self.jitter else float(base)


@dataclass(frozen=True, slots=True)
class Step:
    task_key: str
    label: str
    retry: Retry = field(default_factory=Retry)


@dataclass(frozen=True, slots=True)
class Workflow:
    key: str
    steps: tuple[Step, ...]

    def index_of(self, task_key: str) -> int:
        return next(i for i, s in enumerate(self.steps) if s.task_key == task_key)


_EXECUTE_RETRY = Retry(max_attempts=3, on=frozenset({"transient"}))

NL_QUERY = Workflow(
    key="nl-query",
    steps=(
        Step("translate_thought", "Understand"),
        Step("validate_query", "Validate"),
        Step("execute_graph_query", "Execute", retry=_EXECUTE_RETRY),
        Step("shape_for_canvas", "Project"),
    ),
)

# A typed query, and every re-run: no translation.
QL_QUERY = Workflow(
    key="ql-query",
    steps=(
        Step("validate_query", "Validate"),
        Step("execute_graph_query", "Execute", retry=_EXECUTE_RETRY),
        Step("shape_for_canvas", "Project"),
    ),
)

# A modeller session authors a model draft (RFC-031) instead of running a query.
MODELLER_GENERATE = Workflow(
    key="modeller-generate",
    steps=(
        Step("understand_ask", "Understand"),
        Step("propose_model", "Propose"),
        Step("validate_proposal", "Validate"),
    ),
)

WORKFLOWS: dict[str, Workflow] = {w.key: w for w in (NL_QUERY, QL_QUERY, MODELLER_GENERATE)}

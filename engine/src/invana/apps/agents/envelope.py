"""The envelope, and the validator that keeps a planned workflow inside it.

docs/for-developers/modules/ask/spec.md **D2** rejected workflow-as-code because a spec drives dispatch. A plan
the *model* writes is authored too — by the model — so it stays safe the same
way D2's ``plan`` task does: **the model proposes, the interpreter disposes**
(docs/for-developers/modules/agents/spec.md).

Two documents, one grammar:

``Envelope``
    ``agents.workflow_spec`` — set by the agent's author. Names the tasks any
    plan may contain (``allow``), the args no plan may rebind (``pins``), the
    library workflows a *Plan* step may select (``templates``), and the budget
    ceilings. **It does not name preconditions**: a step's ``requires`` is
    declared on its catalogue entry, so the planner reads it while drafting
    instead of being refused and redrafting
    (docs/for-developers/orchestration.md §0.6).

``Plan``
    ``runs.plan`` — written per ask by the *Plan* step, either by matching
    a template (no LLM) or by generating one. Validated against the envelope
    **before dispatch**, never at step 6.

The grammar is inert data on purpose: ``${steps.X.y}`` is a path lookup, not an
expression, so there is nowhere for a model to put code (docs/for-developers/modules/agents/spec.md).
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Protocol

# ``${steps.<step_id>.<path.to.value>}`` — the whole binding grammar.
_BINDING = re.compile(r"^\$\{steps\.([A-Za-z0-9_]+)\.([A-Za-z0-9_.]+)\}$")


class CatalogueEntry(Protocol):
    """The slice of a catalogue declaration the validator reads.

    Structural, so this module imports nothing from ``invana.runtime`` — the
    catalogue is band 3 and the envelope is band 2. The runtime hands its own
    declaration down; nothing here reaches up for it.
    """

    @property
    def requires(self) -> tuple[str, ...]:
        """Step keys a plan naming this one must already order before it."""

    def declares(self, output: str) -> bool:
        """Whether ``${steps.<this>.<output>}`` has anything to bind to."""


class PlanRejected(Exception):
    """A plan failed validation against its envelope.

    Raised by :func:`validate_plan` and turned into a step failure of the
    *planning* step by the runtime, with the one-repair policy applied — the
    same posture taken in docs/for-developers/modules/ask/features/when-it-cannot-answer.md for an invalid generated
    query, one level up.
    """

    def __init__(self, errors: list[str]) -> None:
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass(frozen=True, slots=True)
class PlanStep:
    """One step of a plan, in the § 3.1 shape."""

    id: str
    task: str
    label: str
    args: dict[str, Any] = field(default_factory=dict)
    #: The plan node's own retry policy, when it declares one. ``tasks.retry``
    #: has existed since M2 and ``steps_of`` has always exported it, but nothing
    #: read it — a plan could state a retry policy, render it to YAML, and have
    #: it silently ignored at dispatch (task-model-migration § 6.5).
    retry: dict[str, Any] | None = None
    #: The ``tasks`` row this step came from, when it came from the library.
    #: Null on a generated plan, which has no rows yet. It is carried through
    #: validation and pinning so ``TaskRun.task_id`` can name the node that ran
    #: (docs/for-developers/modules/workflows/features/the-library.md **LB12**).
    task_id: str | None = None

    @classmethod
    def parse(cls, raw: Any, *, index: int) -> PlanStep:
        if not isinstance(raw, dict):
            raise PlanRejected([f"step {index}: not an object"])
        task = raw.get("task") or raw.get("task_key")
        if not isinstance(task, str) or not task:
            raise PlanRejected([f"step {index}: missing 'task'"])
        label = raw.get("label")
        if not isinstance(label, str) or not label:
            # A step with no label has no row on the card — the plan would run
            # invisibly, which is the one thing promise #3 does not allow.
            raise PlanRejected([f"step {index} ({task}): missing 'label'"])
        args = raw.get("args") or {}
        if not isinstance(args, dict):
            raise PlanRejected([f"step {index} ({task}): 'args' is not an object"])
        task_id = raw.get("task_id")
        retry = raw.get("retry")
        return cls(
            id=str(raw.get("id") or f"{task}_{index}"),
            task=task,
            label=label,
            args=args,
            retry=retry if isinstance(retry, dict) and retry else None,
            task_id=task_id if isinstance(task_id, str) and task_id else None,
        )

    def as_dict(self) -> dict:
        out = {"id": self.id, "task": self.task, "label": self.label, "args": self.args}
        # Only when set, so a generated plan's snapshot keeps the shape it had.
        if self.retry:
            out["retry"] = self.retry
        if self.task_id:
            out["task_id"] = self.task_id
        return out


@dataclass(frozen=True, slots=True)
class Envelope:
    """What any plan under this agent may contain."""

    allow: frozenset[str]
    # Args the envelope fixes. A plan may not rebind these — ``read_only: true``
    # on ``execute_graph_query`` is the one that matters, and it is why a data
    # canvas can never be written from Studio.
    pins: dict[str, dict[str, Any]]
    templates: frozenset[str]
    # Where the agent starts. ``understand`` / ``plan`` mean it plans (M3);
    # anything else means the envelope's own ``steps`` are the plan (M1).
    entry: str | None
    steps: tuple[PlanStep, ...]
    max_steps: int
    max_replans: int
    max_clarifications: int

    @classmethod
    def from_spec(cls, spec: dict | None, *, budget: dict | None = None) -> Envelope:
        spec = spec or {}
        budget = budget or {}
        raw_steps = spec.get("steps") or []
        steps = tuple(PlanStep.parse(s, index=i) for i, s in enumerate(raw_steps))
        pins = {k: v for k, v in (spec.get("pins") or {}).items() if isinstance(v, dict)}
        # An envelope with static steps but no explicit allow-list allows
        # exactly what it declares — the degenerate case named in docs/for-developers/modules/agents/spec.md.
        allow = spec.get("allow")
        allow_set = frozenset(allow) if allow else frozenset(s.task for s in steps)
        return cls(
            allow=allow_set,
            pins=pins,
            templates=frozenset(spec.get("templates") or []),
            entry=spec.get("entry"),
            steps=steps,
            max_steps=int(spec.get("max_steps") or budget.get("max_steps") or 24),
            max_replans=int(spec.get("max_replans") or budget.get("max_replans") or 1),
            max_clarifications=int(spec.get("max_clarifications") or budget.get("max_clarifications") or 3),
        )

    @property
    def plans(self) -> bool:
        """Whether this agent composes its plan per ask (M3) or is static (M1)."""
        return self.entry in {"understand", "plan"}

    def pinned_args(self, task: str) -> dict[str, Any]:
        return dict(self.pins.get(task) or {})


def validate_plan(
    plan_steps: list[Any],
    envelope: Envelope,
    *,
    catalogue: Mapping[str, CatalogueEntry],
) -> list[PlanStep]:
    """Check a proposed plan against the envelope and the catalogue. Raises
    :class:`PlanRejected`.

    Every check tabulated in docs/for-developers/modules/agents/spec.md, run at dispatch rather than at save
    time — the validator is the same one because the grammar is the same.
    Errors accumulate so the model gets the whole list back on its one repair,
    not the first problem over and over.

    ``catalogue`` is passed in rather than imported: it lives in band 3 and this
    module is band 2 (building-engine/the-runtime-package.md §1). It answers the
    two questions the envelope cannot — **what must precede this step**, and
    **what may be bound out of it**.
    """
    errors: list[str] = []

    if not plan_steps:
        raise PlanRejected(["the plan has no steps"])
    if len(plan_steps) > envelope.max_steps:
        # Rejected, never truncated: half a plan answers a different question.
        raise PlanRejected([f"the plan has {len(plan_steps)} steps; the envelope allows {envelope.max_steps}"])

    steps = [PlanStep.parse(s, index=i) for i, s in enumerate(plan_steps)]

    # Task by step id, filled as we walk — so a binding resolves against the
    # entry of the step it actually names, not against the name of a step.
    task_of: dict[str, str] = {}
    seen: set[str] = set()
    ran: set[str] = set()
    for i, step in enumerate(steps):
        if step.task not in envelope.allow:
            errors.append(f"step {i} '{step.id}': task '{step.task}' is not in the envelope's allow-list")
        if step.id in seen:
            errors.append(f"step {i}: duplicate step id '{step.id}'")

        entry = catalogue.get(step.task)
        if entry is None and step.task in envelope.allow:
            # Allowed by the envelope but absent from the closed set: the plan
            # names something nothing can dispatch.
            errors.append(f"step {i} '{step.id}': task '{step.task}' is not in the catalogue")

        # `requires` is the catalogue's, not the envelope's — one source, and
        # the planner read the same line while drafting.
        for required in entry.requires if entry else ():
            if required not in ran:
                errors.append(f"step {i} '{step.id}': '{step.task}' requires '{required}' to run before it")

        pinned = envelope.pinned_args(step.task)
        for key, value in pinned.items():
            if key in step.args and step.args[key] != value:
                errors.append(
                    f"step {i} '{step.id}': '{key}' is pinned to {value!r} by the envelope and cannot be rebound"
                )

        for key, value in step.args.items():
            if not isinstance(value, str):
                continue
            match = _BINDING.match(value)
            if match is None:
                if value.startswith("${"):
                    errors.append(f"step {i} '{step.id}': '{key}' is not a valid ${{steps.X.y}} binding")
                continue
            ref, path = match.group(1), match.group(2)
            if ref == step.id:
                errors.append(f"step {i} '{step.id}': '{key}' binds to itself")
                continue
            if ref not in seen:
                # `seen` holds only the steps *before* this one, so this catches
                # both forward references and references to nothing.
                errors.append(f"step {i} '{step.id}': '{key}' binds to '{ref}', which does not run before it")
                continue
            source = catalogue.get(task_of.get(ref, ""))
            if source is not None and not source.declares(path):
                # An undeclared output is an undocumented API. Refusing here is
                # what makes the declaration the contract rather than a comment.
                errors.append(
                    f"step {i} '{step.id}': '{key}' binds to '{ref}.{path}', "
                    f"which '{task_of[ref]}' does not declare as an output"
                )

        seen.add(step.id)
        task_of[step.id] = step.task
        ran.add(step.task)

    if errors:
        raise PlanRejected(errors)
    return steps


def apply_pins(steps: list[PlanStep], envelope: Envelope) -> list[PlanStep]:
    """Overlay the envelope's pinned args onto a validated plan.

    Validation guarantees no step *contradicts* a pin; this adds the ones the
    plan simply left out, so ``read_only: true`` holds even for a plan that
    never mentioned it.
    """
    return [
        PlanStep(
            id=s.id,
            task=s.task,
            label=s.label,
            args={**s.args, **envelope.pinned_args(s.task)},
            retry=s.retry,
            task_id=s.task_id,
        )
        for s in steps
    ]

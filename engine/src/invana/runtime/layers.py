"""The bands a plan touches — one vocabulary, read by every surface that draws one.

A plan **declares** what it will engage; a run **records** what it did engage;
a lens **governs** what it may. Those are three tenses of the same six bands
([LB17](docs/for-developers/modules/workflows/features/the-library.md)), so
they are one mapping here rather than one per reader — two spellings of one
idea is the drift that lets a bind check, a Flow tab and the library disagree
about what a step touches.

It lives in ``runtime`` because the mapping is off the **catalogue**, which is
band 3: the bound an entry spends is what decides the band, and an app may not
read the catalogue.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

from invana.apps.govern.addressing import Layer
from invana.apps.task_plans.models import Task, TaskForm
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.catalogue.registry import Bound

#: What a node's bound means on the **six-band** strip a flow is drawn as
#: ([SK16](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
#: One mapping, sent on the node — never computed in Studio, which would be a
#: second place to keep in step with the catalogue.
#:
#: The band is a governed :class:`~invana.apps.govern.addressing.Layer`, not a
#: string of its own. The strip and the lens are the same six bands read in two
#: tenses — *declared* here, *governed* there
#: ([BN10](docs/for-developers/modules/skills/features/bindings.md)).
LAYER_OF_BOUND: dict[str, Layer] = {
    Bound.graph_read.value: Layer.graph_data,
    Bound.graph_write.value: Layer.graph_data,
    Bound.schema_write.value: Layer.graph_data,
    Bound.ingest.value: Layer.graph_data,
    Bound.llm.value: Layer.llm,
    Bound.network.value: Layer.third_party,
    Bound.plan_write.value: Layer.agent,
    Bound.work_write.value: Layer.agent,
    Bound.none.value: Layer.agent,
}

#: How a band is written where a person reads it. The address grammar's
#: underscores are an identifier's, not a label's.
LAYER_LABEL: dict[Layer, str] = {
    Layer.graph_data: "graph data",
    Layer.llm: "llm",
    Layer.third_party: "third party",
    Layer.cache: "cache",
    Layer.human: "human",
    Layer.agent: "agent",
}


def band_for(*, form: str, step_key: str | None) -> Layer:
    """The governed band a node sits in.

    ``human`` is a **form**, not a bound — a person is not something the
    envelope ceilings — so it is read first. An unknown step key falls to the
    spine rather than inventing a layer: the catalogue is closed, so this can
    only happen to a plan written against a step that has since been removed.
    """
    if form == TaskForm.human.value:
        return Layer.human
    entry = CATALOGUE.get(step_key or "")
    if entry is None:
        return Layer.agent
    return LAYER_OF_BOUND.get(entry.bound.value, Layer.agent)


def layer_for(*, form: str, step_key: str | None) -> str:
    """The same band, spelled for the strip that draws it."""
    return LAYER_LABEL[band_for(form=form, step_key=step_key)]


#: The strip's order, so two surfaces never disagree about which band is first.
LAYER_ORDER: tuple[str, ...] = tuple(
    LAYER_LABEL[layer]
    for layer in (Layer.graph_data, Layer.llm, Layer.third_party, Layer.cache, Layer.human, Layer.agent)
)

#: The five a rule may govern, in the strip's order. The spine is not one of
#: them ([governance §2](docs/for-developers/governance.md)): a plan does not
#: *declare* the runtime, it is dispatched by it.
GOVERNED_ORDER: tuple[str, ...] = tuple(label for label in LAYER_ORDER if label != LAYER_LABEL[Layer.agent])

#: What one step of a band amounts to, in the reader's words. ``third party``
#: counts **crossings** rather than steps because the boundary is the fact a
#: reader is weighing, and it is per dispatch.
_NOUN: dict[str, str] = {
    "graph data": "step",
    "llm": "step",
    "third party": "crossing",
    "cache": "step",
    "human": "step",
    "agent": "step",
}


def ordered_layers(layers: Iterable[str]) -> list[str]:
    """The bands present, in the strip's order and without repetition."""
    seen = set(layers)
    return [layer for layer in LAYER_ORDER if layer in seen]


def declared_bands(tasks: Sequence[Task]) -> list[dict]:
    """Every governed band, with what this plan declares in it.

    **All five, always.** A band a plan does not touch is a fact worth printing
    — *this plan reads no graph data* is what a reader is checking for — and a
    band that vanished when empty would make *nothing declared* and *nothing
    loaded* look alike.

    ``cache`` is the standing empty one: no catalogue entry spends it, so no
    plan can declare it. It is drawn dark rather than dropped, for the reason
    above.
    """
    counts: dict[str, int] = dict.fromkeys(GOVERNED_ORDER, 0)
    for task in tasks:
        label = layer_for(form=task.form, step_key=task.step_key)
        if label in counts:
            counts[label] += 1
    return [
        {
            "layer": label,
            "declared": counts[label] > 0,
            "steps": counts[label],
            # An em dash, not "0 steps": the row is saying *nothing here*, and a
            # zero reads as a measurement of something that was looked for.
            "summary": _plural(counts[label], _NOUN[label]) if counts[label] else "—",
        }
        for label in GOVERNED_ORDER
    ]


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")
